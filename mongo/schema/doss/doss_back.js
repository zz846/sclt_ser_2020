const mgse = require("mongoose");
const cname = "DOSS_back"

const schema = mgse.Schema({
    creatdt: { type: Date, default: new Date() },
    vin: { type: String },
    reportdt: { type: String, default: new Date() },
    backdt: { type: String, default: "" }
}, { collection: cname })

module.exports = mgse.model(cname, schema)