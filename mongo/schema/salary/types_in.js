const mgse = require("mongoose");
const cname = "SalaryTypeIn";

/*
内部政策导入表中的车型
*/
const schema = mgse.Schema(
  {
    type_id:{type:String},//车型ID，由于无法使用 objectid进行 aggregate 而改变的策略
    stype: { type: String, default: "" }, //主车型
    ltype: { type: String, dropDups: true, require, unique: true }, //内部车型
    price: { type: Number } // 价格
  },
  { collection: cname }
);

module.exports = mgse.model(cname, schema);
