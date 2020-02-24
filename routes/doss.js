const Router = require("koa-router")
const router = new Router();
const DOSS_history = require("../mongo/schema/doss/history");
const Car = require("../mongo/schema/car");
const CarSold = require("../mongo/schema/carsold");
const { shortdate, longdate } = require("../utils/utils");
const DOSS_back = require("../mongo/schema/doss/doss_back");
const CarHistory = require("../mongo/schema/carhistory");
const jwt = require("jsonwebtoken")

//退车明细，包括申请退车中以及退车完成未上报的
router.post("/doss_back_list", async ctx => {
    const info = ctx.request.body.info;
    let andArr = [], aggArr = [];

    aggArr.push({
        $lookup: {
            from: "Car",
            localField: "vin",
            foreignField: "vin",
            as: "carinfo"
        }
    })

    aggArr.push({
        $lookup: {
            from: "Cartype",
            localField: "carinfo.type_id",
            foreignField: "type_id",
            as: "typeinfo"
        }
    })

    //融合销售
    aggArr.push({
        $lookup: {
            from: "Carsold",
            localField: "vin",
            foreignField: "vin",
            as: "soldinfo"
        }
    })

    //融合销售顾问
    aggArr.push({
        $lookup: {
            from: "Cellers",
            localField: "soldinfo.celler_id",
            foreignField: "celler_id",
            as: "cellerinfo"
        }
    })

    info.stype != "" ? andArr.push({ "typeinfo.stype": info.stype }) : "";
    info.price != "" ? andArr.push({ "typeinfo.price": info.price }) : "";
    info.ltype != "" ? andArr.push({ "typeinfo.ltype": info.ltype }) : "";

    andArr.length > 0 ? aggArr.push({ $match: { $and: andArr } }) : "";

    const data = await DOSS_back.aggregate(aggArr);

    ctx.body = { code: 200, data: data };
})

//已销售未上报明细
router.post("/sold_no_doss_list", async ctx => {
    const info = ctx.request.body.info;
    const cars = await Car.find({ dolreport: "" });//无DOL记录的车辆

    let aggArr = [];

    aggArr.push({
        $match: { vin: { $in: cars.map(d => { return d.vin }) } }
    })

    //融合车辆
    aggArr.push({
        $lookup: {
            from: "Car",
            localField: "vin",
            foreignField: "vin",
            as: "carinfo"
        }
    })

    aggArr.push({
        $lookup: {
            from: "Cellers",
            localField: "celler_id",
            foreignField: "celler_id",
            as: "cellerinfo"
        }
    })

    //融合车型
    aggArr.push({
        $lookup: {
            from: "Cartype",
            localField: "carinfo.type_id",
            foreignField: "type_id",
            as: "typeinfo"
        }
    })
    //筛选车型
    let andArr = [];
    if (info.stype != "") {
        andArr.push({ "typeinfo.stype": info.stype });
    }
    if (info.price != "") {
        andArr.push({ "typeinfo.price": info.price });
    }
    if (info.ltype != "") {
        andArr.push({ "typeinfo.ltype": info.ltype });
    }

    if (andArr.length > 0) {
        aggArr.push({ $match: { $and: andArr } });
    }

    const car_no_dolreport = await CarSold.aggregate(aggArr);
    car_no_dolreport.sort((v1, v2) => {
        return new Date(v1.solddt) - new Date(v2.solddt);
    })
    ctx.body = { code: 200, data: car_no_dolreport };
})

//添加DOSS历史
router.post("/add_doss_history", async ctx => {
    const info = ctx.request.body.info;
    const staff = jwt.verify(ctx.request.body.token, require("../config").secret);
    const str = ['交车上报', '虚报', "申请退车", "退车完成"];

    const car = await Car.findOne({ vin: info.vin });
    if (car.dolreport == "") {//无上报日期，则添加一个，这个标记仅仅是首次上报DOSS日期记录，而且作为已售未报DOSS的标记
        await Car.updateOne({ vin: info.vin }, { dolreport: longdate(info.dt) });
    }

    if (info.code == 2) {//用户操作为申请退车
        await new DOSS_back({ vin: info.vin, reportdt: info.dt }).save();
    }

    if (info.code == 3) {//用户操作为退车完成
        await DOSS_back.updateOne({ vin: info.vin }, { backdt: info.dt });
    }

    if (info.code == 0 || info.code == 1) {//用户操作为上报，则从退车未报中删除
        await DOSS_back.deleteOne({ vin: info.vin });
    }

    await new DOSS_history(info).save();
    await new CarHistory({ vin: info.vin, cate: "DOSS", msg: `DOSS状态切换为 ${str[info.code]}`, opid: staff.uid, oper: staff.name }).save();
    ctx.body = { code: 200 }
})

//获取单个车架号当前最新的状态
router.post("/sin_car_code", async ctx => {
    let data = await DOSS_history.find({ vin: ctx.request.body.info.vin });
    data.sort((v1, v2) => {
        return new Date(v1.dt) - new Date(v2.dt);
    })

    ctx.body = { code: 200, data: data.length > 0 ? { code: data[data.length - 1].code } : { code: -1 } }
})


//获取单个车架号的所有DOSS操作记录
router.post("/sin_car_history", async ctx => {
    let data = await DOSS_history.find({ vin: ctx.request.body.info.vin });
    data.sort((v1, v2) => {
        return new Date(v1.dt) - new Date(v2.dt);
    })
    ctx.body = { code: 200, data }
})

//把DOSS上报日期从 car 转移到 doss history
router.get("/update_doss_history", async ctx => {
    await DOSS_history.deleteMany();//清空

    const cars = await Car.find();//查找出所有的car
    for (const d of cars) {
        if (d.dolreport != "") {
            await new DOSS_history({ vin: d.vin, dt: new Date(d.dolreport), code: 0 }).save();
        }
    }

    ctx.body = { code: 200 }
})

//指定日期范围内的doss上报
router.post("/getDossReport", async ctx => {
    const info = ctx.request.body.info;

    const dt1 = new Date(shortdate(info.dt1) + " 00:00");
    const dt2 = new Date(shortdate(info.dt2) + " 23:59");
    let matchAndArr = [];
    matchAndArr.push({ dt: { $lte: dt2 } });
    matchAndArr.push({ dt: { $gte: dt1 } });
    if (info.code !== "") {
        matchAndArr.push({ code: info.code });
    }

    let aggArr = [];
    aggArr.push({
        $match: { $and: matchAndArr }
    });

    aggArr.push({
        $lookup: {
            from: "Car",
            localField: "vin",
            foreignField: "vin",
            as: "carinfo"
        }
    });

    aggArr.push({
        $lookup: {
            from: "Cartype",
            localField: "carinfo.type_id",
            foreignField: "type_id",
            as: "typeinfo"
        }
    })

    aggArr.push({
        $lookup: {
            from: "Carsold",
            localField: "vin",
            foreignField: "vin",
            as: "soldinfo"
        }
    })

    aggArr.push({
        $lookup: {
            from: "Cellers",
            localField: "soldinfo.celler_id",
            foreignField: "celler_id",
            as: "cellerinfo"
        }
    })

    let data = await DOSS_history.aggregate(aggArr);

    data.sort((v1, v2) => {//操作日期排序
        return new Date(v1.dt) - new Date(v2.dt);
    })
    ctx.body = { code: 200, data };
})

module.exports = { router };
