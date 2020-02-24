const Router = require("koa-router");
const Tag = require("../mongo/schema/tag");
const NowStore = require("../mongo/schema/carstore/nowstore");

const router = new Router();

//为了提高查询效率而创建的一个所有带有指定标签的车架号列表，用于在生成库存明细的时候筛选掉大部分数据的比对结果
const all_car_has_tag = async tags => {
    let vins_set = new Set();
    for (const d of tags) {
        const car_tag = await Tag.find({ tag_id: d.id });

        car_tag.forEach(tag => {
            tag.vins.forEach(vin => {
                vins_set.add(vin.vin);
            })
        })
    }
    return Array.from(vins_set);
}

// 单条标签记录对象
router.post("/getinfo", async ctx => {
    ctx.body = { code: 200, data: await Tag.findOne({ tag_id: ctx.request.body.info.tag_id }) };
})

//更新标签内容
router.post("/update", async ctx => {
    const info = ctx.request.body.info;
    const tag = await Tag.findOne({ name: info.name });

    if (tag) {//查找到同名标签
        if (tag.tag_id != info.tag_id) {//同名，且不是自身
            ctx.body = { code: 403, msg: "同名标签已存在，请重新命名" }
        } else {
            await Tag.updateOne({ tag_id: info.tag_id }, { name: info.name, content: info.content })
            ctx.body = { code: 200 }
        }
    } else {
        await Tag.updateOne({ tag_id: info.tag_id }, { name: info.name, content: info.content })
        ctx.body = { code: 200 }
    }
})

//真实删除标签
router.post("/del_tag", async ctx => {
    await Tag.deleteOne({ tag_id: ctx.request.body.info.tag_id });
    ctx.body = { code: 200 }
})

//删除车上附加的标签
router.post("/car_tag_del", async ctx => {
    const tag_id = ctx.request.body.info.tag_id;
    const vin = ctx.request.body.info.vin;

    const tag = await Tag.findOne({ tag_id: tag_id });
    tag.vins.forEach((d, i) => {
        if (d.vin == vin) {
            tag.vins.splice(i, 1)
        }
    })

    await Tag.updateOne({ tag_id: tag_id }, tag);
    ctx.body = { code: 200 }
})

//添加标签到车上
router.post("/car_tag_add", async ctx => {
    const tag_id = ctx.request.body.info.tag_id;
    const vin = ctx.request.body.info.vin;

    const tag = await Tag.findOne({ tag_id: tag_id });
    tag.vins.push({ vin: vin });

    await Tag.updateOne({ tag_id: tag_id }, tag);
    ctx.body = { code: 200 }
})


//单车上的可用标签和已用标签
router.post("/sincar", async ctx => {
    const tags_on = await cartags_on(ctx.request.body.info.vin);
    const tags_off = await cartags_off(ctx.request.body.info.vin);

    ctx.body = { code: 200, data: { vin: ctx.request.body.info.vin, tags_on, tags_off } };
})

//添加标签
router.post("/add", async ctx => {
    const info = ctx.request.body.info;
    const tag = await Tag.findOne({ name: info.name });

    if (tag) {//查找到同名标签
        ctx.body = { code: 403, msg: "同名标签已存在，请重新命名" }
    } else {
        await new Tag({ tag_id: Date.now(), name: info.name, content: info.content }).save();
        ctx.body = { code: 200 }
    }
})

const getList = async (qstr) => {
    let andArr = [];
    let tags = [];

    if (qstr.name.length > 0) {
        andArr.push({ name: { $regex: `${qstr.name}$` } })
    }

    if (andArr.length == 0) {
        tags = await Tag.find()
    } else {
        tags = await Tag.find({ $and: andArr })
    }

    return tags;

}

//标签列表
router.post("/list", async ctx => {
    const info = ctx.request.body.info;
    let result = await getList(info);
    ctx.body = { code: 200, data: result };
})

//获取单车已用标签
const cartags_on = async  vin => {
    const tags = await Tag.find({ vins: { $elemMatch: { vin: vin } } });
    return tags;
}

//获取单车可用标签
const cartags_off = async  vin => {
    const all_tags = await Tag.find();//获取全部标签
    const tags_on = await cartags_on(vin);//获取已用标签
    //排除掉已用，剩下的就是可用标签
    tags_on.forEach(tag_on => {
        tag_on.vins = [];
        all_tags.forEach(all_tag => {
            all_tag.vins = [];
            if (all_tag.tag_id == tag_on.tag_id) {
                all_tag.tag_id = 0;
            }
        })
    })

    return all_tags.filter(d => {
        return d.tag_id != 0;
    });
}

//获取单车标签接口
router.post("/cartags_on", async ctx => {
    const vin = ctx.request.body.info.vin;
    ctx.body = { code: 200, data: await CarTags_on(vin) };
})

//获取当前车辆库存中存在的所有标签
router.post("/nowstoretags", async ctx => {
    const cars = await NowStore.find();
    let tags_map = new Map();

    for (const car of cars) {//循环车辆库存
        const car_tags = await cartags_on(car.vin);
        if (car_tags.length > 0) {//循环单车标签数据
            car_tags.forEach(d => {
                tags_map.set(d.tag_id, d.name)
            })
        }
    }

    let data = [];

    tags_map.forEach((val, key) => {//循环标签
        data.push({ id: key, val: val })
    })

    ctx.body = {
        code: 200, data: data
    }

})
module.exports = { router, cartags_on, all_car_has_tag };