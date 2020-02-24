const mgse = require("mongoose")
const cname = "CarMoveOut"

const schema = mgse.Schema({
    movedt: { type: Date },
    vin: { type: String },
    posi: { type: String }
}, { collection: cname })

module.exports = mgse.model(cname, schema)