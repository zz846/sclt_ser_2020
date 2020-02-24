const Router = require("koa-router");
const Celler = require("../mongo/schema/celler");
const router = new Router();

router.post("/getcellerlist", async ctx => {
  const pms = () => {
    return new Promise((res, rej) => {
      Celler.find({ state: true });
    });
  };

  const body = await pms();
  ctx.body = body;
});

router.post("/mutelist", async (ctx, next) => {
  const pms = () => {
    return new Promise((res, rej) => {
      Celler.find(
        {
          $and: [
            { state: false },
            { name: { $regex: ctx.request.body.cellername } }
          ]
        },
        (err, doc) => {
          res({ code: 200, data: doc });
        }
      );
    });
  };

  const body = await pms();
  ctx.body = body;
  await next();
});

//启用销售人员
router.post("/active", async (ctx, next) => {
  const id = ctx.request.body.id;
  const pms = () => {
    return new Promise((res, rej) => {
      Celler.updateOne({ _id: id }, { state: true }, (err, doc) => {
        res(doc);
      });
    });
  };
  const re = await pms();
  ctx.body = { code: 200 };
});

//禁用销售人员
router.post("/mute", async (ctx, next) => {
  const id = ctx.request.body.id;
  const pms = () => {
    return new Promise((res, rej) => {
      Celler.updateOne({ _id: id }, { state: false }, (err, doc) => {
        res(doc);
      });
    });
  };
  const re = await pms();
  ctx.body = { code: 200 };
});

//获取展厅人员列表
router.post("/manlist/:cate", async (ctx, next) => {
  const pms = () => {
    return new Promise((res, rej) => {
      Celler.find({ state: true, cate: ctx.params.cate }, (err, doc) => {
        res({ code: 200, data: doc });
      });
    });
  };

  const body = await pms();
  ctx.body = body;
  await next();
});

//获取销售人员列表
router.post("/list", async (ctx, next) => {
  const pms = () => {
    return new Promise((res, rej) => {
      Celler.find(
        {
          $and: [
            { state: true },
            { name: { $regex: ctx.request.body.cellername } }
          ]
        },
        (err, doc) => {
          res({ code: 200, data: doc });
        }
      );
    });
  };

  const body = await pms();
  ctx.body = body;
  await next();
});

//添加新销售人员
router.post("/add", async (ctx, next) => {
  const d = ctx.request.body;
  let newCeller = new Celler(d);

  await newCeller.save();

  ctx.body = { code: 200 };
  await next();
});

module.exports = router;
