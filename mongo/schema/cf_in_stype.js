const mgse = require("mongoose")
const cname = "CfInStype"

const schema = mgse.Schema({
    createdt: { type: Date, default: Date.now() },
    stype: String
}, { collection: cname })

module.exports = mgse.model(cname, schema);