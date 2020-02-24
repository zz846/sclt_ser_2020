//车辆销售
const mgse = require("mongoose")
const cname = "Carsold"

const schema = mgse.Schema({
    vin: {//车架号 同时也是链接到车辆表的键
        type: String,
        dropDups: true,
        require,
        unique: true
    },
    type_id: {//车型ID链接到车型表
        type: String
    },
    cate: {//分类 比如 展厅，网点
        type: String
    },
    celler_id: {//链接到销售顾问表
        type: String
    },
    solddt: {//销售日期
        type: Date,
        default: Date.now()
    },
    orderdt: {//订单日期
        type: Date,
        default: Date.now()
    },
    customer: {//购车姓名
        type: String,
        default: ""
    },
    tel: {//电话
        type: String,
        default: ""
    },
    idcode: {//身份证号
        type: String,
        default: ""
    },
    address: {//地址
        type: String,
        default: ""
    },
    price_car: {//车款
        type: Number,
        default: 0
    },
    price_deco: {//装饰款
        type: Number,
        default: 0
    },
    price_anjie: {//按揭手续费
        type: Number,
        default: 0
    },
    order_id: {//链接到装饰订单ID
        type: String
    },
    payway_1: {
        type: String
    },
    payway_2: {
        type: String
    },
    tips: {
        type: String,
        default: ""
    }
}, { collection: cname })

module.exports = mgse.model(cname, schema)