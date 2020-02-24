const mgse = require("mongoose");
const cname = "CarInWayIsIn"

const schema = mgse.Schema({
    vin: { type: String }
}, {
    collection: cname
})

module.exports = mgse.model(cname, schema)