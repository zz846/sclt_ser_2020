const mgse = require("mongoose")
const cname = "CallCar_cancall"

const schema = mgse.Schema({
    stype: { type: String },
    ltype: { type: String },
    clr: { type: String },
    vsc: { type: String },
    price: { type: Number },
    order_pe: { type: Number },
    shift_pe: { type: Number },
    Calloff: { type: Number },
    suc: { type: Number },
    nocall: { type: Number }
}, { collection: cname })

module.exports = mgse.model(cname, schema)

