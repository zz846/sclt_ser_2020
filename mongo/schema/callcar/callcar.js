const mgse = require("mongoose");
const cname = "CallCar"

const schema = mgse.Schema({
    vin: { type: String },
    bonus: { type: Number, default: 0 },
    reserve: { type: Number, default: 0 },
    calldt: { type: Date },
    kpdt: { type: String, default: "" },
    fpcode: { type: String, default: "" },
    state: { type: String }
}, { collection: cname })

module.exports = mgse.model(cname, schema);