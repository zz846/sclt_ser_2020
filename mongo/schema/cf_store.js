const mgse = require("mongoose");
const cname = "CfStore"
const schema = mgse.Schema({
    name: String,
    level: { type: String, default: "H" },
    state: { type: String, default: "跟进中" },
    tel: String,
    payway: { type: String, default: "" },
    stype: String,
    price: { type: Number, default: 0 },
    clr: { type: String, default: "" },
    simicar: { type: Array, default: [] },//竞品，这里决定把竞品对象深度开发一下
    hascar: { type: String, default: "" },//当前用车
    zhihuan: { type: String, default: "" },//协助置换
    celler_id: String,//跟进人员
    accdt: { type: Date, default: new Date() },//接受该客流的日期
    linkdtfir: { type: Date, default: "" },//首次联系日期
    linkdtnear: { type: Date, default: "" },//最近联系日期
    linkdtnext: { type: Date, default: "" },//下次联系日期
    sc: { type: String, default: "" },
    sc1: { type: String, default: "" },
    cf_id: { type: String, default: Date.now() }//自定义ID字段，不使用自动ID
}, { collection: cname })

module.exports = mgse.model(cname, schema)