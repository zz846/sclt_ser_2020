const mgse = require("mongoose");
const cname = "Specialsold";

//特殊奖励车
const schema = mgse.Schema(
  {
    createdt: {
      type: Date,
      default: Date.now()
    },
    vin: {
      type: String,
      dropDups: true,
      require,
      unique: true
    },
    payceller: {
      //奖励销售顾问
      type: Number,
      default: 0
    },
    paynet: {
      //奖励网点
      type: Number,
      default: 0
    }
  },
  { collection: cname }
);

module.exports = mgse.model(cname, schema);
