const mgse = require("mongoose")
const cname = "NowStoreKeyMove"
const schema = mgse.Schema({
    createdt: { type: String, default: Date.now() },
    vin: { type: String },
    movedt: { type: Date, default: Date.now() },
    celler_id: { type: String },
    celler: { type: String },
    remenber: { type: String }
}, { collection: cname })


module.exports = mgse.model(cname, schema)