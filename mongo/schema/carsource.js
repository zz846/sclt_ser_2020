const mgse = require("mongoose")
const cname = "CarSource"

const schema = mgse.Schema({
    createdt: { type: Date, default: Date.now() },
    val: { type: String },
}, { collection: cname })

module.exports = mgse.model(cname, schema)