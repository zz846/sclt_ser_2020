const mgse = require("mongoose")
const cname = "CarHistory"

const schema = mgse.Schema({
    createdt: { type: Date, default: Date.now() },
    vin: { type: String },
    dt: { type: Date, default: Date.now() },
    cate: { type: String },
    msg: { type: String },
    opid: { type: String },
    oper: { type: String }
}, { collection: cname })

module.exports = mgse.model(cname, schema)