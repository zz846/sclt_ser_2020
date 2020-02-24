//装饰与订单关联
const mgse = require("mongoose")
const coname = "Deco_order"
const moment = require("moment")

const schema = mgse.Schema({
    vin: {//车架号
        type: String,
        dropDups: true,
        require,
        unique: true
    },
    createdt: {//订单日期
        type: Date, default: new Date()
    },
    order_id: {//订单ID
        type: String,
        require: true
    }
}, { collection: coname })

module.exports = mgse.model(coname, schema)