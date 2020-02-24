const mgse = require("mongoose");
const cname = "NowStore";

const schema = mgse.Schema(
  {
    vin: {
      type: String,
      dropDups: true,
      require,
      unique: true
    },
    posi1: {
      type: String
    },
    posi2: {
      type: String
    },
    movedt: {
      type: Date,
      default: Date.now()
    }
  },
  { collection: cname }
);

module.exports = mgse.model(cname, schema);
