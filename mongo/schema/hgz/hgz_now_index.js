const mgse = require("mongoose")
const cname = "Hgz_now_index"

const schema = mgse.Schema({
    stype_id: { type: String, default: Date.now() },
    stype: { type: String },
    now_index: { type: Number }
}, {
    collection: cname
})

module.exports = mgse.model(cname, schema)