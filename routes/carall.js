const Router = require("koa-router");
const router = new Router();
const CarAll = require("../mongo/schema/car");
const Cartype = require("../mongo/schema/cartype");
const { shortdate } = require("../utils/utils");

router.post("/sincarinfo_update", async ctx => {
    const info = ctx.request.body.info;
    const cartype = await Cartype.findOne({ ltype: info.typeinfo[0].ltype });

    await CarAll.updateOne({ vin: info.vin }, { pdt: info.pdt, arrdt: info.arrdt, type_id: cartype.type_id, clr: info.clr, fdjcode: info.fdjcode });

    ctx.body = { code: 200 }

})

//单车参数查询
router.post("/sincarinfo", async ctx => {
    const info = ctx.request.body.info;

    let aggArr = [];

    aggArr.push({
        $match: { vin: info.vin }
    })

    //融合车型
    aggArr.push({
        $lookup: {
            from: "Cartype",
            localField: "type_id",
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

    //融合库存
    aggArr.push({
        $lookup: {
            from: "NowStore",
            localField: "vin",
            foreignField: "vin",
            as: "storeinfo"
        }
    })

    //融合钥匙
    aggArr.push({
        $lookup: {
            from: "NowStoreKeyMove",
            localField: "vin",
            foreignField: "vin",
            as: "keyinfo"
        }
    })

    //融合指定订单对应表
    aggArr.push({
        $lookup: {
            from: "CarOrderLink",
            localField: "vin",
            foreignField: "vin",
            as: "linkinfo"
        }
    })

    //融合指定订单
    aggArr.push({
        $lookup: {
            from: "CarOrder",
            localField: "linkinfo.order_id",
            foreignField: "car_order_id",
            as: "orderinfo"
        }
    })

    //融合指定订单的销售顾问
    aggArr.push({
        $lookup: {
            from: "Cellers",
            localField: "orderinfo.celler_id",
            foreignField: "celler_id",
            as: "linkordercellerinfo"
        }
    })

    //let data=await CarAll.aggregate(aggArr);
    ctx.body = { code: 200, data: (await CarAll.aggregate(aggArr)) };
})

//模糊查询到可匹配的车架号
router.post("/vin_search", async ctx => {
    const vin_parts = ctx.request.body.info.vin_parts;
    const data = await CarAll.find({ vin: { $regex: `${vin_parts}$` } })
    const set = new Set();
    data.forEach(d => {
        set.add({ value: d.vin });
    })

    ctx.body = { code: 200, data: Array.from(set) };
})


//创建总到车明细
const alllist_v1 = async info => {
    let aggArr = [];
    //限定到车日期
    const dt1 = new Date(shortdate(info.dt1) + " 00:00");
    const dt2 = new Date(shortdate(info.dt2) + " 23:59");

    let matchAndArr = [];
    matchAndArr.push({ arrdt: { $lte: dt2 } });
    matchAndArr.push({ arrdt: { $gte: dt1 } });

    if (info.vin != "") {
        matchAndArr.push({ vin: { $regex: `${info.vin}$` } });
    }

    aggArr.push({
        $match: {
            $and: matchAndArr
        }
    })

    aggArr.push({
        $lookup: {
            from: "Cartype",
            localField: "type_id",
            foreignField: "type_id",
            as: "typeinfo"
        }
    }
    )

    if (info.stype != "") {
        aggArr.push({
            $match: {
                "typeinfo.stype": info.stype
            }
        })
    }

    if (info.price != "") {
        aggArr.push({
            $match: {
                "typeinfo.price": info.price
            }
        })
    }

    if (info.ltype != "") {
        aggArr.push({
            $match: {
                "typeinfo.ltype": info.ltype
            }
        })
    }

    return await CarAll.aggregate(aggArr);
}

//到车明细
router.post("/getCarAllList", async ctx => {
    const data = await alllist_v1(ctx.request.body.info);
    data.forEach(d => {
        d.arrdt = shortdate(d.arrdt);
        d.pdt = shortdate(d.pdt);
    })

    data.sort((v1, v2) => {//按照到车日期降序排列
        return (new Date(v2.arrdt) - new Date(v1.arrdt));
    })

    ctx.body = { code: 200, data };
})

module.exports = { router };
