const mgse = require("mongoose");
const cname = "CfIsFit";

const schema = mgse.Schema({
    go_dt: { type: String },
    come_dt: { type: Date },
    mans: Number,
    state: String,
    stype: String,
    celler_id: String,
    tel: String,
    in_state: String,
    level: String,
    sc: String,
    sc1: String,
    dcc: String,
    drive: String,
    cfname: String,
    content: String
}, { collection: cname })

module.exports = mgse.model(cname, schema)