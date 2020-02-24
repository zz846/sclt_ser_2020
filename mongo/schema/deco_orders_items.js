//订单中的详细装饰项目
const mgse = require("mongoose")
const cname = "Deco_order_item"

const schema = mgse.Schema({
    order_id: {//订单号
        type: String
    },
    name: {//名称
        type: String, require
    },
    cb: {//成本价 财务核算用
        type: Number, default: 0
    },
    js: {//结算价 销售提成用
        type: Number, default: 0
    },
    count: {//数量
        type: Number,
        default: 1
    }
}, { collection: cname })

module.exports = mgse.model(cname, schema)