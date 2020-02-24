const mgse = require("mongoose")
const cname = "CallCar_willcall"

const schema = mgse.Schema({
    stype: { type: String },
    ltype: { type: String },
    code: { type: String },
    clr: { type: String },
    dealer: { type: String },
    dealer_code: { type: String },
    num: { type: Number }
}, { collection: cname })

module.exports = mgse.model(cname, schema)