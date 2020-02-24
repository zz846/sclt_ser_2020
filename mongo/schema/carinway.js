const mgse = require("mongoose")
const cname = "CarInWay"

const schema = mgse.Schema({
    vin: {
        //车架号
        type: String, dropDups: true, require, unique: true
    },
    type_id: {
        type: String
    },
    clr: {
        type: String
    },
    vn: {
        type: String
    },
    way_state: {
        type: String
    },
    state1: {
        type: String
    },
    state2: {
        type: String
    }
}, { collection: cname })

module.exports = mgse.model(cname, schema);