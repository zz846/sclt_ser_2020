const mgse = require("mongoose")
const cname = "CarOrderLink"

const schema = mgse.Schema({
    createdt: {
        type: Date,
        default: Date.now()
    },
    vin: {
        type: String
    },
    order_id:
    {
        type: String
    }
}, { collection: cname })

module.exports = mgse.model(cname, schema)