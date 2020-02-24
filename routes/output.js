const Router = require("koa-router");
const router = new Router();
const csv = require("../utils/csv");

//通用导出接口
router.post("/output", async ctx => {
    const info = ctx.request.body;
    const filename = Date.now();
    await csv
        .writer(info.json, info.fields, filename + ".csv")
        .then(re => {
            ctx.body = { code: 200, filename: filename + ".csv" };
        })
        .catch(err => {
            ctx.body = { code: 500, err: err.message };
        });
});

module.exports = router;