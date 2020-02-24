const mgse = require("mongoose")
const cname = "DOSS_history"

//DOSS上报历史记录，每一次,每一次
const schema = mgse.Schema({
    createdt: { type: Date, default: Date.now() },
    vin: { type: String },
    dt: { type: Date, default: new Date() },//变更日期
    code: { type: Number },//变更代码 
    /* code: 
    0   上报        已销售车辆正常上报  +1
    1   虚报        未销售车辆上报      +1
    2   申请退车                      0
    3   已退回                         -1
    */
}, { collection: cname })

module.exports = mgse.model(cname, schema)