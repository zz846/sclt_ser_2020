const Router = require("koa-router")
const router = new Router();
const { shortdate } = require("../utils/utils");
const Carsold = require("../mongo/schema/carsold");
const Carstore = require("../mongo/schema/carstore/nowstore");

//两个月内存在的销售顾问列表
const cellerlist = async (cate, monthrange = 2) => {
    const dt = new Date().setMonth(new Date().getMonth() - monthrange);
    let aggArr = [];
    aggArr.push({
        $match: {
            $and: [
                { cate: cate },
                { solddt: { $lte: new Date() } },
                { solddt: { $gte: new Date(dt) } }
            ]
        }
    })

    aggArr.push({
        $lookup: {
            from: "Cellers",
            localField: "celler_id",
            foreignField: "celler_id",
            as: "cellerinfo",
        }
    })

    const soldinfo = await Carsold.aggregate(aggArr);
    const map = new Map();
    soldinfo.forEach(d => {
        const key = d.cellerinfo[0].celler_id;
        const val = d.cellerinfo[0].name;
        map.set(key, val);
    })

    let re = [];
    map.forEach((v, k) => {
        re.push({ id: k, name: v });
    })
    return re;
}

//两个月内存在的车辆列表
const typelist = async (monthrange = 2) => {
    const dt = new Date().setMonth(new Date().getMonth() - monthrange);
    let aggArr = [];
    aggArr.push({
        $match: {
            $and: [
                { solddt: { $lte: new Date() } },
                { solddt: { $gte: new Date(dt) } }
            ]
        }
    })

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
    const soldinfo = await Carsold.aggregate(aggArr);
    const map = new Map();
    soldinfo.forEach(d => {
        const key = d.typeinfo[0].type_id;
        const val = d.typeinfo[0].stype;
        map.set(key, val);
    })

    let re = [];
    map.forEach((v, k) => {
        re.push({ id: k, val: v });
    })
    return re;
}

/*这里的统计有一点不同的是，由于是用于图表，比如当天所有的数据，可能10个销售里面只有2个有交车，这时候
从图表的呈现来看，假如是柱状图，就会是两根巨大无比的矩形，这个对于美观会有很大的影响，所以
需要一个销售顾问列表，把没有数据的设为0即可，而不是不显示，其他方面的数据也是这样呈现
*/
router.post("/day_sold", async ctx => {

    const info = ctx.request.body.info;
    const cellers = await cellerlist(info.cate);
    const stypes = await typelist();
    const dt1 = new Date(shortdate(info.dt1) + " 00:00");
    const dt2 = new Date(shortdate(info.dt2) + " 23:59");

    let aggArr = [], andArr = [];

    andArr.push({ solddt: { $lte: dt2 } });
    andArr.push({ solddt: { $gte: dt1 } });
    andArr.push({ cate: info.cate })

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

    const soldlist = await Carsold.aggregate(aggArr);
    ctx.body = { code: 200, data: { cellers, soldlist, stypes } }
})

/*
库存*/
router.post("/day_store", async ctx => {
    let aggArr = [];

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

    let storelist = await Carstore.aggregate(aggArr);
    ctx.body = { code: 200, data: { storelist } }
})

module.exports = { router };