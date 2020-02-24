const mgse = require("mongoose");
const cname = "CarOrder";

const schema = mgse.Schema(
  {
    car_order_id: { type: String },
    type_id: { type: String },
    clr: { type: String },
    name: { type: String, trim: true, default: "" },
    idcode: { type: String, trim: true, default: "" },
    tel: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    odt: { type: Date },
    opay: { type: Number, default: 0 },
    carpay: { type: Number, default: 0 },
    payway1: { type: String, default: "" },
    payway2: { type: String, default: "" },
    zspay: { type: Number, default: 0 },
    ajpay: { type: Number, default: 0 },
    cate: { type: String },
    celler_id: { type: String },
    state: { type: String,default:"有效订单" },//硬编码，容易找不到原因的写作方式
    deco_order_id: { type: String, default: "0" }, // 装饰订单ID
    tips: { type: String, default: "" },//网点快速订单用的备注项
    order_type: { type: Number, default: 0 },//订单分类，展厅订单0 网点快速订单1
  },
  { collection: cname }
);

module.exports = mgse.model(cname, schema);
