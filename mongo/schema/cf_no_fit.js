const mgse = require("mongoose")
const cname = "CfNoFit"
const schema = mgse.Schema({
    come_dt: { type: Date },
    go_dt: { type: String, default: "" },
    state: String,
    mans: Number,
    stype: String,
    celler_id: String
}, { collection: cname })

module.exports = mgse.model(cname, schema)