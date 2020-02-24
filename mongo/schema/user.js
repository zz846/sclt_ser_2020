const mgse = require("mongoose");
const c_name = "Users";
const bcrypt = require("bcryptjs");
//const moment = require("moment")

const schema = mgse.Schema(
  {
    uid: { type: Number, require: true, dropDups: true, unique: true }, //登录ID
    name: { type: String }, //用户名
    key: { type: String }, //密码
    state: { type: Boolean, default: true }, //状态，默认true，启用，false则为禁用
    createday: { type: Date, default: Date.now },
    rights: { type: Array } //权限
  },
  { collection: c_name }
);

//新建用户，数据预处理，UID分配，密码加盐
schema.pre("save", async function() {
  const model = mgse.model(c_name, schema);
  let uid = 1000; //初始值，如果没有用户则以此为准
  let latest_user = await model.findOne().sort({ _id: -1 }); //降序排列，找到最近添加的用户
  if (latest_user) {
    //存在用户
    uid = latest_user.uid + 1; //覆盖默认ID值，以当前最新用户的ID+1
  }
  const salt = await bcrypt.genSalt(10); //生成盐
  this.uid = uid; //设置uid
  this.key = bcrypt.hashSync(this.key, salt); //加密
});

module.exports = mgse.model(c_name, schema);
