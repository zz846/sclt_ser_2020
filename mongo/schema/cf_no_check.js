//新的没有被管理人员审核的回访
const mgse = require("mongoose");
const cname = "CfNoCheck"

const schema = mgse.Schema({
    createdt: { type: Date, default: new Date() },
    cf_id: String
}, { collection: cname })

module.exports = mgse.model(cname, schema)