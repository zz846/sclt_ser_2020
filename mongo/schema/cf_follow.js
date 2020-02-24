const mgse = require("mongoose");
const cname = "CfFollow";
const schema = mgse.Schema({
    dt: { type: Date, default: new Date() },
    level: String,
    content: String,
    dtnext: { type: Date, default: new Date() },
    celler_id: String,
    state: String,
    cf_id: String
}, { collection: cname })

module.exports = mgse.model(cname, schema)