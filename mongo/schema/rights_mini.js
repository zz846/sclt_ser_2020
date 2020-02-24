const mgse = require("mongoose");
const cname = "RightsMini";

const schema = mgse.Schema(
  {
    createdt: { type: Date, default: Date.now() },
    cate: { type: String },
    au_id: { type: String },
    val: { type: String }
  },
  { collection: cname }
);

module.exports = mgse.model(cname, schema);
