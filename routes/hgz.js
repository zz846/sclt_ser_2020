const Router = require("koa-router");
const Hgz_now_index = require("../mongo/schema/hgz/hgz_now_index");

const router = new Router();

router.post("/getnowindex", async ctx => {
    if (ctx.request.body.info.stype == "") {
        ctx.body = { code: 500 };
    }

    const info = await Hgz_now_index.find({ stype: ctx.request.body.info.stype });
    if (info.length > 0) {
        ctx.body = { code: 200, now_index: info[0].now_index * 1 + 1 };
    } else {
        ctx.body = { code: 201, now_index: 1 };
    }
})

//入库的时候编号自增
addindex = async (stype) => {
    console.log(stype);
    const info = await Hgz_now_index.find({ stype: stype });
    if (info.length > 0) {//找到车型
        await Hgz_now_index.updateOne({ stype: info[0].stype }, { now_index: info[0].now_index + 1 })
    } else {//未找到车型
        await new Hgz_now_index({ stype: stype, now_index: 1 }).save();
    }
}

module.exports = { router, addindex };
