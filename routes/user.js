const Router = require("koa-router");
const Users = require("../mongo/schema/user");
const Rights = require("../mongo/schema/rights");
const bcrypt = require("bcryptjs");

const router = new Router();

//用户修改密码
router.post("/updatepwd", async (ctx, next) => {
  const d = ctx.request.body;
  const salt = await bcrypt.genSalt(10); //生成盐
  Users.updateOne({ uid: d.uid }, { key: bcrypt.hashSync(d.pwd, salt) }, err => {
    if (err) {
      console.log(err);
    }
  });
  ctx.body = { code: 200 };
  await next();
});

//用户注册
router.post("/reg", async (ctx, next) => {
  const d = ctx.request.body;
  const new_user = new Users(d);
  await new_user.save();
  let latest_user = await Users.findOne().sort({ _id: -1 });
  ctx.body = { uid: latest_user.uid };
  await next();
});

//通过用户ID来创建权限对象，这个对象用于动态创建header
router.post("/headerView", async ctx => {
  const uid = ctx.request.body.uid;
  //查询指定用户
  const user = await Users.findOne({
    uid: uid
  }).catch(err => {});
  //查询所有权限
  const allRights = await Rights.find({}).catch(err => {});
  let map = new Map();
  allRights.forEach(d => {
    if (user.rights.includes(d._id)) {
      if (map.get(d.cate) == undefined) {
        //项目未记录，则首先set
        map.set(d.cate, [{ id: d._id, val: d.item_val, text: d.item_text }]);
      } else {
        map.get(d.cate).push({ id: d._id, val: d.item_val, text: d.item_text });
      }
    }
  });

  let re = [],
    i = 0;

  map.forEach((val, key) => {
    re.push({ id: i, name: key, items: val });
    i++;
  });

  ctx.body = re;
});

//查询指定用户ID的权限
router.post("/getUserAu", async ctx => {
  await Users.findOne({ uid: ctx.request.body.uid })
    .then(re => {
      ctx.body = re.rights;
    })
    .catch(err => {});
});

//权限删除，添加
router.post("/au", async ctx => {
  const uid = ctx.request.body.uid;
  const auid = ctx.request.body.auid;

  const user = await Users.findOne({ uid: uid }).catch(err => {});
  if (ctx.request.body.t == "add") {
    //授权
    user.rights.push(auid);
  } else {
    //取消
    user.rights.forEach((d, i) => {
      if (d == auid) {
        user.rights.splice(i, 1);
      }
    });
  }

  await Users.updateOne({ uid: uid }, { rights: user.rights })
    .then(doc => {
      ctx.body = doc;
    })
    .catch(err => {
      ctx.body = err;
    });
});

router.post("/usermanlist", async ctx => {
  ctx.body = await Users.find({ state: true });
});

module.exports = router;
