const mgse = require("mongoose");
const cname = "Cellers";
//销售顾问数据原型
/*没有使用用户表作为销售顾问数据来源
首先是为了数据隔离，其次是独立出来不会造成为了添加销售顾问而添加系统用户的情况
*/
const schema = mgse.Schema(
  {
    celler_id: {
      type: String,
      require: true
    },
    cate: {
      //分类
      type: String,
      default: ""
    },
    uid: {
      //可绑定到用户ID
      type: Number,
      default: 0
    },
    name: {
      //销售顾问姓名
      type: String,
      dropDups: true,
      require,
      unique: true
    },
    group: {
      //成员分组，默认1，都在一组
      type: Number,
      default: 1
    },
    createdt: {
      //创建时间
      type: Date,
      default: Date.now()
    },
    state: {
      //状态
      type: Boolean,
      default: true
    }
  },
  {
    collection: cname
  }
);
module.exports = mgse.model(cname, schema);
