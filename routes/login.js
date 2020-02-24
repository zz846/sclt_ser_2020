const Router = require("koa-router");
const router = new Router();
const User = require("../mongo/schema/user");
const bcrypt = require("bcryptjs");

//用户登录
router.post("/in", async (ctx, next) => {
  const d = ctx.request.body;
  const user = await User.findOne({ uid: d.uid, state: true });
  if (user) {
    //存在用户
    const check = await bcrypt.compare(d.key, user.key);
    if (check) {
      //对比密码
      const payload = {
        uid: user.uid,
        name: user.name,
        au: user.rights
      };
      ctx.body = { code: 200, user: payload }; //密码正确
    } else {
      ctx.body = { code: 500 }; //密码错误
    }
  } else {
    ctx.body = { code: 404 }; //不存在客户
  }

  await next();
});

module.exports = router;
