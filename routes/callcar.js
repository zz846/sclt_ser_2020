const Router = require("koa-router");
const csv = require("../utils/csv");
const Cancall = require("../mongo/schema/callcar/cancall");
const Willcall = require("../mongo/schema/callcar/willcall");
const Cartype = require("../mongo/schema/cartype");
const router = new Router();
const { shortdate } = require("../utils/utils");
const CallCar = require("../mongo/schema/callcar/callcar");

// router.get("/update_paycat", async ctx => {
//     const csv_data = await csv.reader("/csv/paycar.csv");
//     await CallCar.deleteMany();
//     for (const d of csv_data) {
//         await new CallCar(d).save();
//     }

//     ctx.body={code:200}
// })

const get_callcarlist = async info => {
    let aggArr = [], andArr = [];
    const dt1 = new Date(shortdate(info.dt1) + " 00:00");
    const dt2 = new Date(shortdate(info.dt2) + " 23:59");

    andArr.push({ calldt: { $lte: dt2 } });
    andArr.push({ calldt: { $gte: dt1 } });

    if (info.vin != "") {
        andArr.push({ vin: { $regex: `${info.vin}$` } });
    }

    if (info.state != "" && info.state == "已开票") {
        andArr.push({ fpcode: { $ne: '' } });
    }

    if (info.state != "" && info.state == "未开票") {
        andArr.push({ fpcode: '' });
    }

    aggArr.push({
        $match:
            { $and: andArr }
    })

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
            as: "store_typeinfo"
        }
    })

    aggArr.push({
        $lookup: {
            from: "CarInWay",
            localField: "vin",
            foreignField: "vin",
            as: "wayinfo"
        }
    })

    aggArr.push({
        $lookup: {
            from: "Cartype",
            localField: "wayinfo.type_id",
            foreignField: "type_id",
            as: "way_typeinfo"
        }
    })

    return await CallCar.aggregate(aggArr);
}

//CALL车列表
router.post("/callcarlist", async ctx => {
    const info = ctx.request.body.info;
    let data = await get_callcarlist(info);
    //这里需要处理一下，因为车辆可能是在途，可能是在库，所以车型的获取源是不同的，这里判断一下然后反馈成统一的对象，不需要客户端去判断

    data.forEach(d => {
        d.store_typeinfo.length > 0 ? d.typeinfo = d.store_typeinfo : d.typeinfo = d.way_typeinfo;
        d.store_typeinfo = [];
        d.way_typeinfo = [];
        d.carinfo = [];
    })

    ctx.body = { code: 200, data };
})

//导入备用金表
//备用金不会出现一台车多条记录这种情况，所以跟奖金相比简单得多
router.post("/import_reserve", async ctx => {
    const data = await csv.reader("/csv/" + ctx.request.body.info.filename);

    for (const d of data) {
        const record = await CallCar.findOne({ vin: d['车架号(VIN#)'] });
        if (record) {//记录存在，则更新
            await CallCar.updateOne({ vin: d["车架号(VIN#)"] }, { calldt: d["SO时间"], reserve: d["金额(元)"], kpdt: d["开票时间"], fpcode: d["发票号码"] })
        } else {//不存在，则新建
            await new CallCar({ vin: d["车架号(VIN#)"], calldt: d["SO时间"], reserve: d["金额(元)"], kpdt: d["开票时间"], fpcode: d["发票号码"] }).save();
        }
    }

    ctx.body = { code: 200 }
})

//导入奖金表
/*
奖金可能会出现多次，但是
*/
router.post("/import_bonus", async ctx => {
    const data = await csv.reader("/csv/" + ctx.request.body.info.filename);
    let map = new Map();
    for (const d of data) {//循环CSV内数据，合计每台车的奖金金额，虽然随着时间的推移数据会变化，但是同一台的CALL车时间是不变的，就算有多条奖金使用数据，在一个表格内也是完整的
        map.get(d["VIN"]) == undefined ? map.set(d["VIN"], d["金额"] * 1) : map.set(d["VIN"], map.get(d["VIN"]) * 1 + d["金额"] * 1);//合计每台车的奖金额度

        const record = await CallCar.findOne({ vin: d["VIN"] });//查找车架号是否存在记录
        if (record) {//已有记录
            await CallCar.updateOne({ vin: d['VIN'] }, { fpcode: d["Billing No."], kpdt: d["开票日期"] });
        } else {//没有记录，添加新记录
            await new CallCar({ vin: d["VIN"], fpcode: d["Billing No."], kpdt: d["开票日期"] }).save();//这时候因为奖金没有统计完，所以只会添加一个为0的金额，之后再来更新
        }

    }

    let arr = [];
    map.forEach((v, k) => {
        arr.push({ vin: k, bonus: v });
    })

    for (const d of arr) {
        await CallCar.updateOne({ vin: d.vin }, { bonus: d.bonus });//真正的奖金金额更新到对象
    }

    ctx.body = { code: 200 }
})

//从csv导入
const import_from_csv = async ctx => {
    return await csv.reader("/csv/" + ctx.request.body.info.filename)
}

//从ppter抓取数据导入
const import_from_ppt = ctx => {
    return ctx.request.body.info;
}

//导入线上可CALL表
router.post("/import_cancall", async ctx => {
    let data = [];
    if (ctx.request.body.info.filename) {
        data = await import_from_csv(ctx);
    } else {
        data = import_from_ppt(ctx);
    }

    await Cancall.deleteMany();//清空表
    let type_id = Date.now();

    for (const info of data) {
        if (info.nocall > 0) {//当未CALL车大于零的时候才进行执行
            info.clr = info.clr.split(";")[0];//简化颜色
            info.price = info.price.replace(/,/g, '');//格式化价格
            info.ltype = info.ltype.trim();
            await new Cancall(info).save();
            //这个操作是因为目前为止并没有把下周将CALL车辆的更新操作作为前置条件，所以新车型的出现也会产生在可CALL车上
            if (!await Cartype.findOne({ ltype: info.ltype })) {//在车型库中查找是否存在，不存在则添加
                await new Cartype({ type_id: type_id, stype: "未匹配", ltype: info.ltype }).save();
                type_id++;
            }
        }
    }

    ctx.body = { code: 200 };
})

//导入下周将CALL
router.post("/import_willcall", async ctx => {
    const data = await csv.reader("/csv/" + ctx.request.body.info.filename);

    await Willcall.deleteMany();
    let type_id = Date.now();
    for (const info of data) {
        info.clr = info.clr.split(";")[0];
        info.ltype = info.ltype.trim();
        await new Willcall(info).save();
        if (!await Cartype.findOne({ ltype: info.ltype })) {//由于下周CALL车一般是最早出现新车型的位置，所以在这个环节查找是否存在ltype，没有的话会添加进去
            await new Cartype({ type_id: type_id, stype: "未匹配", ltype: info.ltype }).save();
            type_id++;
        }
    }

    ctx.body = { code: 200 };
})

module.exports = router;
