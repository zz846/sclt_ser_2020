const mgse = require("mongoose");
const cname = "Rights";

const schema = mgse.Schema(
  {
    cate: {
      type: String //主分类名称
    },
    item_id: {
      //项目ID
      type: Number,
      require
    },
    item_val: {
      //项目值
      type: String,
      require
    },
    item_text: {
      //文本值
      type: String,
      require
    }
  },
  { collection: cname }
);

module.exports = mgse.model(cname, schema);
