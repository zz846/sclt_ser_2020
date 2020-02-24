//竞品车型对象
const mgse = require("mongoose");
const cname = "SimiCar"
const schema = mgse.Schema({
    createdt: { type: Date, default: Date.now() },
    stype: String,//我方车型
    brand: String,//竞品品牌
    type: String,//车型
    weak: String,//弱点
    strong: String,//强项
}, { collection: cname })

module.exports = mgse.model(cname, schema);