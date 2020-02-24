const Router = require("koa-router");
const router = new Router();
const Cf_in_stype = require("../mongo/schema/cf_in_stype");
const CfNoFit = require("../mongo/schema/cf_no_fit");
const CfIsFit = require("../mongo/schema/cf_is_fit");
const CfStore = require("../mongo/schema/cf_store");
const SimiCar = require("../mongo/schema/simicar");
const CfFollow = require("../mongo/schema/cf_follow");
const Cellers = require("../mongo/schema/celler");
const CfNoCheck = require("../mongo/schema/cf_no_check");
const { shortdate } = require("../utils/utils");
const jwt = require("jsonwebtoken");

//管理人员对于已跟进客户的查阅
router.post("/cf_do_check", async ctx => {
    const info = ctx.request.body.info;
    await CfNoCheck.deleteOne({ cf_id: info.cf_id });
    ctx.body = { code: 200 }
})

//客户重分配
router.post("/cf_reshare", async ctx => {
    const info = ctx.request.body.info;
    const token = ctx.request.body.token;

    //如果用户的名字在展厅销售顾问的列表中，则强制限定查询范围仅为自己的数据
    const cellers = (await Cellers.find({ cate: "展厅", state: true })).map(d => {
        return d.name;
    });

    const user = jwt.verify(token, require("../config").secret);
    if (cellers.includes(user.name)) {
        ctx.body = { code: 300, msg: "权限不足，操作失败" }
    } else {
        const cf_ids = info.cf_ids;
        const celler_id = info.celler_id;
        for (const d of cf_ids) {
            await CfStore.updateOne({ cf_id: d }, { celler_id: celler_id });
        }
        ctx.body = { code: 200 }
    }
})

//查询跟进记录
router.post("/get_cf_follow_sin", async ctx => {
    const info = ctx.request.body.info;

    let aggArr = [];
    aggArr.push({
        $match: { cf_id: info.cf_id }
    })

    aggArr.push({
        $lookup: {
            from: "Cellers",
            localField: "celler_id",
            foreignField: "celler_id",
            as: "cellerinfo"
        }
    })

    ctx.body = { code: 200, data: (await CfFollow.aggregate(aggArr)).sort(d => d.dt) }
})

//添加回访记录
router.post("/add_follow", async ctx => {
    const info = ctx.request.body.info;
    info.dt = new Date();
    await new CfFollow(info).save();
    //更新客户级别
    await CfStore.updateOne({ cf_id: info.cf_id }, { level: info.level, state: info.state, linkdtnear: info.dt, linkdtnext: info.dtnext });

    //检查是否存在首次回访记录
    const cf = await CfStore.findOne({ cf_id: info.cf_id });
    if (cf.linkdtfir == null) {
        await CfStore.updateOne({ cf_id: info.cf_id }, { linkdtfir: info.dt });
    }

    //回访之后，添加到未记录客流表，之后具有审核回访记录权限的用户可以通过这个表来查询新回复未记录的客流
    const cf_no_check = await CfNoCheck.findOne({ cf_id: info.cf_id });
    if (!cf_no_check) {//不存在于未审核表则添加记录
        new CfNoCheck({ cf_id: info.cf_id }).save();
    }

    ctx.body = { code: 200 }
})

//更新客户数据
router.post("/update_cf_sin", async ctx => {
    const info = ctx.request.body.info;
    const obj = {
        level: info.level,
        payway: info.payway,
        price: info.price,
        clr: info.clr,
        hascar: info.hascar,
        zhihuan: info.zhihuan,
        sc: info.sc,
        sc1: info.sc1,
        name: info.name,
        tel: info.tel,
        stype: info.stype,
    };
    await CfStore.updateOne({ cf_id: info.cf_id }, obj);

    ctx.body = { code: 200 }
})

//查询单个客户
router.post("/get_cf_store_sin", async ctx => {
    const info = ctx.request.body.info;

    let aggArr = [];
    aggArr.push({
        $match: { cf_id: info.cf_id }
    })

    aggArr.push({
        $lookup: {
            from: "Cellers",
            localField: "celler_id",
            foreignField: "celler_id",
            as: "cellerinfo"
        }
    })

    ctx.body = { code: 200, data: (await CfStore.aggregate(aggArr))[0] }
})

//查询跟进客户列表
router.post("/get_cf_store_list", async ctx => {
    const info = ctx.request.body.info;
    const token = ctx.request.body.token;

    let no_check = (await CfNoCheck.find()).map(d => {
        return d.cf_id;
    });//新的回访记录

    let andArr = [], aggArr = [];
    const dt1 = new Date(shortdate(info.dt1) + " 00:00");
    const dt2 = new Date(shortdate(info.dt2) + " 23:59");

    switch (info.plan_state) {
        case "今日未回访":
            andArr.push({ state: { $eq: "跟进中" } });
            andArr.push({ linkdtnext: { $gte: dt1 } });
            andArr.push({ linkdtnext: { $lte: dt2 } });
            break;
        case "今日已回访":
            andArr.push({ state: { $eq: "跟进中" } });
            andArr.push({ linkdtnear: { $gte: dt1 } });
            andArr.push({ linkdtnear: { $lte: dt2 } });
            break;
        // case "逾期计划":
        //     andArr.push({ state: { $eq: "跟进中" } });
        //     andArr.push({ linkdtnext: { $lte: dt2 } });
        //     break;
        case "终止回访":
            andArr.push({ state: { $ne: "跟进中" } });
            andArr.push({ linkdtnear: { $gte: dt1 } });
            andArr.push({ linkdtnear: { $lte: dt2 } });
            break;
        case "未跟进":
            andArr.push({ linkdtfir: null })
            break;
    }

    info.stype != "" ? andArr.push({ stype: info.stype }) : "";
    info.level != "" ? andArr.push({ level: info.level }) : "";
    info.celler_id != "" ? andArr.push({ celler_id: info.celler_id }) : "";
    info.sc != "" ? andArr.push({ sc: info.sc }) : "";
    info.sc1 != "" ? andArr.push({ sc1: info.sc1 }) : "";
    info.cfname != "" ? andArr.push({ name: { $regex: info.cfname } }) : "";
    info.tel != "" ? andArr.push({ tel: { $regex: info.tel + "" } }) : "";
    info.rec_state == "未记录" ? andArr.push({ cf_id: { $in: no_check } }) : "";

    //如果用户的名字在展厅销售顾问的列表中，则强制限定查询范围仅为自己的数据
    const cellers = (await Cellers.find({ cate: "展厅", state: true })).map(d => {
        return d.name;
    });

    const user = jwt.verify(token, require("../config").secret);
    if (cellers.includes(user.name)) {
        const celler = await Cellers.findOne({ name: user.name, state: true });
        andArr.push({ celler_id: celler.celler_id });
    }

    aggArr.push({
        $match: { $and: andArr }
    })

    aggArr.push({
        $lookup: {
            from: "Cellers",
            localField: "celler_id",
            foreignField: "celler_id",
            as: "cellerinfo"
        }
    })

    const data = await CfStore.aggregate(aggArr);

    ctx.body = { code: 200, data }
})

//给销售顾问的自主添加客流接口
router.post("/add_new_cf", async ctx => {
    const info = ctx.request.body.info;
    const token = ctx.request.body.token;
    //const staff = jwt.verify(token, require("../config").secret);

    const find_dup = await CfStore.findOne({ tel: info.tel });
    if (find_dup) {
        ctx.body = { code: 300, msg: "电话号码已存在，无法添加" };
    } else {
        const obj = {
            name: info.name,
            tel: info.tel,
            stype: info.stype,
            celler_id: info.celler_id,//跟进人员
        };

        await new CfStore(obj).save();
        ctx.body = { code: 200 }
    }
})

//未启用的竞品相关接口
router.post("/get_simi", async  ctx => {
    const info = ctx.request.body.info;
    ctx.body = { code: 200, data: (await SimiCar.find({ stype: info.stype })) };
})

router.post("/get_stype", async ctx => {
    const stypes = await Cf_in_stype.find();
    let set = new Set();
    stypes.forEach(d => {
        set.add(d.stype);
    })
    ctx.body = { code: 200, data: Array.from(set) };
})

router.post("/add_stype", async ctx => {
    const info = ctx.request.body.info;
    if (!(await Cf_in_stype.findOne({ stype: info.stype }))) {
        await new Cf_in_stype({ stype: info.stype }).save();
    }

    ctx.body = { code: 200 }
})

router.post("/del_stype", async ctx => {
    const info = ctx.request.body.info;
    await Cf_in_stype.deleteMany({ stype: info.stype });
    ctx.body = { code: 200 }
})

//客户离店
router.post("/cf_go", async ctx => {
    const info = ctx.request.body.info;
    const data = await CfNoFit.updateOne({ _id: info._id }, { go_dt: new Date() });

    ctx.body = { code: 200, data };
})

//选中单个用户
router.post("/sel_cf_fit", async ctx => {
    const info = ctx.request.body.info;
    const data = await CfNoFit.findById(info._id);
    ctx.body = { code: 200, data }
})

//获取未补全的用户列表
router.post("/get_new_cf", async ctx => {
    const data = await CfNoFit.aggregate([
        {
            $lookup: {
                from: "Cellers",
                localField: "celler_id",
                foreignField: "celler_id",
                as: "cellerinfo"
            }
        }
    ])
    ctx.body = { code: 200, data };
})

router.post("/add_cf", async ctx => {
    const info = ctx.request.body.info;
    await new CfNoFit(info).save();
    ctx.body = { code: 200 }
})

router.post("/del_cf", async ctx => {
    const info = ctx.request.body.info;
    await CfNoFit.deleteOne({ _id: info._id });
    ctx.body = { code: 200 }
})

const add_cfs = async info => {
    const obj = {
        go_dt: info.go_dt,
        mans: info.mans,
        come_dt: info.come_dt,
        state: info.state,
        stype: info.stype,
        celler_id: info.celler_id,
        tel: info.tel + '',
        in_state: info.in_state,
        level: info.level,
        sc: info.sc,
        sc1: info.sc1,
        dcc: info.dcc,
        drive: info.drive,
        cfname: info.cfname,
        content: info.content
    };

    await new CfIsFit(obj).save();//保存到已补全记录
    //长度等于11，并且没有在有效客流库中的客户，级别也不为N
    const no_have = (await CfStore.findOne({ tel: obj.tel })) ? false : true;

    //放入有效客流数据库中限定条件：电话长度够11位，客户级别不为 N F （无意向，战败），不存在现有记录
    if (obj.tel.length == 11 && obj.level != "F" && no_have) {
        const cfstore_obj = {
            name: obj.cfname,
            tel: obj.tel,
            stype: obj.stype,
            accdt: new Date(),//接受客流的日期
            celler_id: obj.celler_id,
            level: obj.level,
            sc: obj.sc,
            sc1: obj.sc1
        };

        await new CfStore(cfstore_obj).save();
    }

    await CfNoFit.deleteOne({ _id: info._id });//删除未补全记录
}

router.post("/add_cf_fit", async ctx => {
    let info = ctx.request.body.info;
    await add_cfs(info);
    ctx.body = { code: 200 }
})

router.post("/del_cf_fit", async ctx => {

})

//查询已补全的前台客流明细
router.post("/get_fit_cf_list", async ctx => {
    const info = ctx.request.body.info;
    let andVal = [], aggArr = [];
    const dt1 = new Date(shortdate(info.dt1) + " 00:00");
    const dt2 = new Date(shortdate(info.dt2) + " 23:59");
    andVal.push({ come_dt: { $gte: dt1 } });
    andVal.push({ come_dt: { $lte: dt2 } });

    info.stype != "" ? andVal.push({ stype: info.stype }) : "";
    info.celler_id != "" ? andVal.push({ celler_id: info.celler_id }) : "";

    aggArr.push({ $match: { $and: andVal } });
    aggArr.push({
        $lookup: {
            from: "Cellers",
            localField: "celler_id",
            foreignField: "celler_id",
            as: "cellerinfo"
        }
    })

    const data = await CfIsFit.aggregate(aggArr);
    ctx.body = { code: 200, data };
})
module.exports = { router };