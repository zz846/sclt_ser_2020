//车辆
const mgse = require("mongoose");
const cname = "Car";

const schema = mgse.Schema(
  {
    vin: {
      //车架号
      type: String,
      dropDups: true,
      require,
      unique: true
    },
    fdjcode: {
      //发动机号
      type: String
    },
    clr: {
      //颜色
      type: String
    },
    type_id: {
      //车型ID链接到车型表
      type: String
    },
    pdt: {
      //生产日期
      type: Date,
      default: Date.now()
    },
    arrdt: {
      //入库日期
      type: Date,
      default: Date.now()
    },
    dolreport: {
      //上报DOL系统日期 为空则未上报 有值则输出值
      type: String,
      default: ""
    },
    payall: {
      //点款日期
      type: String,
      default: ""
    },
    source: {
      //车辆来源
      type: String
    },
    hgz:{
      type:Number
    }
  },
  {
    collection: cname
  }
);

module.exports = mgse.model(cname, schema);
