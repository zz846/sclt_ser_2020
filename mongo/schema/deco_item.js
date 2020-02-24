const mgse = require("mongoose");
const coname = "Deco_item";
//装饰项目原型
const schema = mgse.Schema(
  {
    name: {
      //名称 不可重复
      type: String,
      require,
      dropDups: true,
      unique: true
    },
    deco_id: {
      //装饰ID
      type: String
    },
    scode: {
      //短码，快速查询码
      type: String,
      require
    },
    cb: {
      //成本价 财务核算用
      type: Number,
      default: 0
    },
    js: {
      //结算价 销售提成用
      type: Number,
      default: 0
    },
    state: {
      //状态 true 可用 false 禁用
      type: Boolean,
      default: true
    },
    cate: {
      //分类
      type: String
    },
    createdt: {
      //创建日期
      type: Date,
      default: Date.now()
    },
    classcode: {
      //厂家代码，如果有的话
      type: String
    },
    brand: {
      //品牌
      type: String
    }
  },
  { collection: coname }
);

module.exports = mgse.model(coname, schema);
