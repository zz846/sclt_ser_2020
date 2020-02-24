const Router = require("koa-router");
const NowStore = require("../mongo/schema/carstore/nowstore");
const CarInWay = require("../mongo/schema/carinway");


const router = new Router();

//车型配置列表
router.post("/ltypelist", async ctx => {
    const par = ctx.request.body;
    let set = new Set();

    const stores = await NowStore.aggregate([
        {
            $lookup: {
                from: "Car",
                localField: "vin",
                foreignField: "vin",
                as: "carinfo"
            }
        },
        {
            $lookup: {
                from: "Cartype",
                localField: "carinfo.type_id",
                foreignField: "type_id",
                as: "typeinfo"
            }
        },
        {
            $match: {
                $and: [
                    { "typeinfo.stype": par.stype },
                    { "typeinfo.price": par.price }
                ]
            }
        },
    ])
    stores.forEach(d => {
        set.add(d.typeinfo[0].ltype)
    })

    //在途数据
    const car_inway = await CarInWay.aggregate([
        {
            $lookup: {
                from: "Cartype",
                localField: "type_id",
                foreignField: "type_id",
                as: "typeinfo"
            }
        }, {
            $match: {
                $and: [
                    { "typeinfo.stype": par.stype },
                    { "typeinfo.price": par.price }
                ]
            }
        }
    ])

    car_inway.forEach(d => {
        set.add(d.typeinfo[0].ltype)
    })

    ctx.body = { data: Array.from(set) }

})

module.exports = router;