const Router = require("koa-router");
const router = new Router();
const Deco = require("../mongo/schema/deco_item");
const csv = require('../utils/csv');

router.get('/input', async (ctx, next) => {
    const data = await csv.reader('deco.csv');
    let data_fmt = [];
    data.map((d, i) => {
        const deco_data = { name: d['名称'], cb: d['成本'], js: d['结算'], scode: d['短码'] };

        //已在schema设置不可重复，所以没有判断直接保存，重复报错异常捕获后静音
        //这样做的好处是在修改跟新增的时候都不需要判断了直接就会由schema来阻止重复
        const deco_save = new Deco(deco_data);
        deco_save.save((err, doc) => {
            if (err) {//重复值会报错需要捕获
            }
        });
    })

    ctx.body = { code: 200 }
})

//启用项目
router.post('/mute', async (ctx, next) => {
    const pms = () => {
        return new Promise((res, rej) => {
            const deco = Deco.findByIdAndUpdate({ _id: ctx.request.body.id }, { state: false }, (err, doc) => {
                if (err) {
                    return rej(err)
                } else {
                    return res(doc)
                }
            });
        })
    }
    const re = await pms();
    ctx.body = { code: 200, data: re };
    await next();
})

//禁用项目
router.post('/active', async (ctx, next) => {
    const pms = () => {
        return new Promise((res, rej) => {
            const deco = Deco.findByIdAndUpdate({ _id: ctx.request.body.id }, { state: true }, (err, doc) => {
                if (err) {
                    return rej(err)
                } else {
                    return res(doc)
                }
            });
        })
    }
    const re = await pms();
    ctx.body = { code: 200, data: re };
    await next();
})


//更新装饰项目
router.post('/update', async (ctx, next) => {
    const d = ctx.request.body;

    const pms = () => {
        return new Promise((res, rej) => {
            Deco.findByIdAndUpdate(d.id, d.info, (err, doc) => {
                if (err) {
                    return rej(err)
                }
                res(doc)
            })
        })
    }

    await pms();
    ctx.body = { code: 200 }
    await next()
})


//添加新装饰项目
router.post('/add', async (ctx, next) => {
    const d = ctx.request.body;

    const newDeco = new Deco(d);
    await newDeco.save();
    ctx.body = { code: 200 }
})

router.post('/info', async (ctx, next) => {
    const pms = () => {
        return new Promise((res, rej) => {
            Deco.findById(ctx.request.body.deid, (err, doc) => {
                if (err) {
                    return rej(err)
                } else {
                    return res(doc)
                }
            })
        })
    }

    const re = await pms();
    ctx.body = { code: 200, data: re }
})

//查询列表
router.post('/list', async (ctx, next) => {
    querymethods = {};
    let querystr = ctx.request.body.querystr;//条件可能为空
    let onlyactive = ctx.request.body.onlyactive;//仅限激活的项目

    if (querystr.length > 0) {//条件不为空
        if (onlyactive) {//仅限激活项目
            querymethods = {
                $and: [
                    {
                        $or: [
                            { name: { $regex: querystr } },
                            { scode: { $regex: querystr } }
                        ]
                    }, { state: true }
                ]
            }
        } else {//所有项目
            querymethods = {
                $or: [
                    { name: { $regex: querystr } },
                    { scode: { $regex: querystr } }
                ]
            }
        }
    }
    else {//条件为空
        if (onlyactive) {//仅限激活项目
            querymethods = {
                state: true
            }
        }
    }

    const pms = () => {
        return new Promise((res, rej) => {
            Deco.find(querymethods, (err, doc) => {
                if (err) {
                    return rej(err)
                } else {
                    return res(doc);
                }
            })
        })
    }

    const re = await pms();
    ctx.body = { code: 200, data: re };
    await next();
})

module.exports = router;