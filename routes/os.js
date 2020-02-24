const Router = require("koa-router");
const router = new Router();
const csv = require("../utils/csv");
const Celler = require("../mongo/schema/celler");

router.get("/updateceller", async (ctx, next) => {
  const csv_data = await csv.reader("carsold_all.csv");
  let timestamp = Date.now(); //时间戳

  csv_data.forEach(async d => {
    timestamp++;
    const celler_fmt = {
      celler_id: timestamp,
      name: d["销售顾问"],
      cate: d["销售划分"]
    };
    await new Celler(celler_fmt).save().catch(err => {
      console.log(err.message);
    });
  });

  await next();
});

module.exports = router;
