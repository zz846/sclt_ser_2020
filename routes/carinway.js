const Router = require("koa-router");
const router = new Router();
const CarInWay = require("../mongo/schema/carinway");
const csv = require("../utils/csv");
const CarType = require("../mongo/schema/cartype");
const NowStore = require("../mongo/schema/carstore/nowstore");
const CarInWayIsIn = require("../mongo/schema/CarInWayIsIn");
const Car = require("../mongo/schema/car");
const Hgz_now_index = require("../mongo/schema/hgz/hgz_now_index");
const Car_source = require("../mongo/schema/carsource");

//单车入库
router.post("/car_in", async ctx => {
    const info = ctx.request.body.info;
    await new NowStore({ vin: info.vin, movedt: info.indt, posi1: info.now_posi1, posi2: info.now_posi2 }).save();//插入当前车辆库存
    await new Car({ vin: info.vin, pdt: info.birdt, arrdt: info.indt, type_id: info.typeinfo[0].type_id, fdjcode: info.fdjcode, clr: info.clr, source: info.source, hgz: info.hgz }).save();//插入总车辆数据
    await CarInWay.deleteOne({ vin: info.vin });//删除在途

    if (info.hgz == 1) {//只有当第一次出现的车型入库的时候，合格证编号会从1开始，因此需要插入一下编号记录
        await new Hgz_now_index({ stype: info.typeinfo[0].stype, now_index: 1 }).save();
    } else {
        const nowtype = await Hgz_now_index.findOne({ stype: info.typeinfo[0].stype });
        await Hgz_now_index.updateOne({ stype: info.typeinfo[0].stype }, { now_index: nowtype.now_index + 1 });
    }

    //判断车辆来源是否存在，不存在则添加
    const sc = await Car_source.findOne({ val: info.source });
    if (!sc) {
        await new Car_source({ val: info.source }).save();
    }

    ctx.body = { code: 200 }
})

//查询完整车架号的参数
router.post("/sin_car_info", async ctx => {
    const vin = ctx.request.body.info.vin;

    let aggArr = [];
    aggArr.push({
        $match: {
            vin: vin
        }
    })

    aggArr.push({
        $lookup: {
            from: "Cartype",
            localField: "type_id",
            foreignField: "type_id",
            as: "typeinfo"
        }
    })

    const car = await CarInWay.aggregate(aggArr);
    ctx.body = { code: 200, data: car };

})

//从在途车辆中模糊查找车架号列表
router.post("/vin_search", async ctx => {
    const vin_parts = ctx.request.body.info.vin_parts;
    const data = await CarInWay.find({ vin: { $regex: `${vin_parts}$` } })
    const set = new Set();
    data.forEach(d => {
        set.add({ value: d.vin });
    })

    ctx.body = { code: 200, data: Array.from(set) };
})

//边入库边删除
router.post("/isin_del", async ctx => {
    await CarInWayIsIn.deleteOne({ vin: ctx.request.body.info.vin });
    ctx.body = { code: 200 }
})

//已入库的在途明细
router.post("/isinlist", async ctx => {
    const data = await CarInWayIsIn.find();
    ctx.body = {
        data: data.map(d => {
            return d.vin
        })
    }
})

//导入在途车辆.csv
const import_from_csv = async ctx => {
    let data_csv = await csv.reader(`/csv/${ctx.request.body.info.filename}`);

    data_csv.forEach(d => {//这个字段可能会有空格，厂家的傻逼也不知道是干啥吃的，你空你妈呢
        d.ltype = d.ltype.trim();
        d.vin = d.vin.trim();
        d.way_state = d.way_state.trim();
        d.state1 = d.state1.trim();
        d.state2 = d.state2.trim();
    })

    return data_csv;
}

//导入在途车辆.csv
const import_from_ppt = async ctx => {
    return ctx.request.body.info;
}

router.post("/import", async ctx => {
    let data_import = [];
    if (ctx.request.body.info.filename) {
        data_import = await import_from_csv(ctx);
    } else {
        data_import = await import_from_ppt(ctx);
    }
    const type_set = new Set();
    let type_id = Date.now();

    //添加新的车型，但是这些车型不会有 主车型 内部型号 外部型号 价格 ，将会有单独的统计用来整理这些新车型的数据
    for (const d of data_import) {
        //检查车型，不够就加
        const check_type = await CarType.findOne({ ltype: d.ltype });
        if (!check_type) {//没有车型记录，并且没有在本次的添加中
            if (!type_set.has(d.ltype)) {
                await new CarType({ type_id: type_id, stype: '', ltype: d.ltype, typecode_pri: '', typecode_pub: "", price: 0 }).save();
                type_id++;
                type_set.add(d.ltype)
                console.log("[carinway] import: add new type:" + d.ltype);
            }
        }
    }

    //添加车型完成之后，确保所有的车型都能在系统中找到对应的数据，然后全部选出，形成map，连接到当前的在途数据上
    const all_types = await CarType.find();
    let all_types_map = new Map();
    all_types.forEach(d => {
        all_types_map.set(d.ltype, d.type_id)
    })

    //清理在途数据
    await CarInWay.deleteMany();
    await CarInWayIsIn.deleteMany();

    //选出当前库存，在途跟当前库存可能有重合，所以需要把这部分已经入库的 车辆单独提出来
    const now_stores = await NowStore.find();
    let now_stores_vins_set = new Set();
    now_stores.forEach(d => {
        now_stores_vins_set.add(d.vin);
    })

    //重新插入数据
    for (const car of data_import) {

        if (now_stores_vins_set.has(car.vin)) {
            await new CarInWayIsIn({//已经入库的车辆，保存到待入库
                vin: car.vin
            }).save();
        } else {
            await new CarInWay({//没有入库的车辆，放到在途
                type_id: all_types_map.get(car.ltype),
                clr: car.clr.split(";")[0],
                vin: car.vin,
                vn: car.vn,
                way_state: car.way_state,
                state1: car.state1,
                state2: car.state2
            }).save()
        }

    }

    ctx.body = { code: 200 }
})

const carinwaydata = async (queryArr = "") => {
    let aggArr = [];
    aggArr.push({
        $lookup: {
            from: "Cartype",
            localField: "type_id",
            foreignField: "type_id",
            as: "typeinfo"
        }
    })

    if (queryArr != "") {
        aggArr.push(queryArr)
    }

    return await CarInWay.aggregate(aggArr);
}

//获取在途车辆的主要车型
router.post("/carinway_stypelist", async ctx => {
    const info = await carinwaydata();
    let set = new Set();
    info.forEach(d => {
        set.add(d.typeinfo[0].stype)
    })
    ctx.body = { code: 200, data: Array.from(set) }
})

//获取车型数据中的配置
router.post("/carinway_ltypelist", async ctx => {
    const info = await carinwaydata({ $match: { "typeinfo.stype": ctx.request.body.stype } });
    let set = new Set();
    info.forEach(d => {
        set.add(d.typeinfo[0].ltype)
    })
    ctx.body = { code: 200, data: Array.from(set) }

})

//获取车型数据中的颜色
router.post("/carinway_clrlist", async ctx => {
    const info = await carinwaydata();
    let set = new Set();
    info.forEach(d => {
        set.add(d.clr)
    })
    ctx.body = { code: 200, data: Array.from(set) }
})

//获取在途状态列表
router.post("/carinway_statelist", async ctx => {
    const info = await carinwaydata();
    let set = new Set();
    info.forEach(d => {
        set.add(d.way_state)
    })
    ctx.body = { code: 200, data: Array.from(set) }
})


//获取车型数据中的车型配置
router.post("/car_ltypelist", async ctx => {
    const info = await CarType.find({ stype: ctx.request.body.stype });
    let set = new Set();
    info.forEach(d => {
        set.add(d.ltype)
    })

    ctx.body = { code: 200, data: Array.from(set) }
})

//获取车型数据中的主要车型
router.post("/car_stypelist", async ctx => {
    const info = await CarType.find();
    let set = new Set();
    info.forEach(d => {
        set.add(d.stype)
    })
    ctx.body = { code: 200, data: Array.from(set) }
})

//更新车型参数
router.post("/updatecarinfo", async ctx => {
    const info = ctx.request.body.data;
    const type = await CarType.updateOne({ ltype: info.ltype }, { stype: info.stype, typecode_pri: info.code_pri, typecode_pub: info.code_pub, price: info.price })
    ctx.body = { code: 200 };
})

//查找指定车型ltype的代码 主要车型 价格 参数
router.post("/findtypeinfo", async ctx => {
    ctx.body = { data: await CarType.findOne({ ltype: ctx.request.body.ltype }) };

})

//获取待整理的新车型列表
router.post("/getNewLtypes", async ctx => {
    //主车型为空 或  价格为空 或 内部代码为空 或  厂家代码为空
    const data = await CarType.find({ $or: [{ stype: '' }, { price: '' }, { typecode_pri: '' }, { typecode_pub: '' }] });
    let set = new Set();
    data.forEach(d => {
        set.add(d.ltype);
    })

    let types = [];
    for (const d of set) {
        types.push({ val: d })
    }

    if (set.size > 0) {

        ctx.body = { code: 200, data: types };
    } else {
        ctx.body = { code: 403 }
    }
})

//在途总数据明细，可能会用于其他项目的筛选取得反馈值
const getList = async () => {
    let aggArr = [];

    aggArr.push({
        $lookup: {
            from: "Cartype",
            localField: "type_id",
            foreignField: "type_id",
            as: "typeinfo"
        }
    })

    return await CarInWay.aggregate(aggArr);
}

//获取在途车辆列表
router.post("/carinwaylist", async ctx => {

    const info = ctx.request.body.data;
    const arr = [];
    if (info.stype != "") {
        arr.push({ 'typeinfo.stype': info.stype });
    }

    if (info.ltype != "") {
        arr.push({ 'typeinfo.ltype': info.ltype });
    }

    if (info.clr != "") {
        arr.push({ clr: info.clr });
    }

    if (info.state != "") {
        arr.push({ way_state: info.state });
    }

    if (arr.length > 0) {
        ctx.body = await carinwaydata({ $match: { $and: arr } });
    } else {
        ctx.body = await carinwaydata();

    }
})

module.exports = router;