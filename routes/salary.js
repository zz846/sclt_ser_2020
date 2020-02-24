const Router = require("koa-router");
const csv = require("../utils/csv");
const Car_month = require("../mongo/schema/salary/car_month");
const class2inside = require("../mongo/schema/salary/class2inside");
const types_in = require("../mongo/schema/salary/types_in");
const Carsold = require("../mongo/schema/carsold");
const Cellers = require("../mongo/schema/celler");
const CellerTag = require("../mongo/schema/salary/tag");

const router = new Router();

//统计列表
router.post("/salarycountlist", async ctx => {
  ctx.body = await countAllSoldData(
    await getALLSoldData(ctx.request.body.year, ctx.request.body.month, "")
  );
});

//筛选出两个月内的所有销售，然后禁用其他销售顾问及网点名称
router.get("/mute_cellers", async ctx => {
  let aggArr = [];

  aggArr.push({
    $match: {
      $and: [
        {
          solddt: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 2))
          }
        },
        { solddt: { $lte: new Date() } }
      ]
    }
  });

  aggArr.push({
    $lookup: {
      from: "Cellers",
      localField: "celler_id",
      foreignField: "celler_id",
      as: "cellerinfo"
    }
  });

  const data = await Carsold.aggregate(aggArr);
  let celler_set = new Set();

  data.forEach(d => {
    celler_set.add(d.cellerinfo[0].name);
  });

  //全部禁用
  await Cellers.updateMany({}, { state: false }).catch(err => { });

  //启用查找到的近两月销售顾问
  for (const cellername of celler_set) {
    await Cellers.updateOne({ name: cellername }, { state: true });
  }

  ctx.body = { code: 200 };
});

//
router.post("/outputsalary", async ctx => {
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

const getALLSoldData = async (year, month, celler_id) => {
  const dt = new Date(year, month, 0);
  let cellerids_set = new Set();

  if (celler_id.length > 0) {
    //限定了某一个销售顾问
    cellerids_set.add(celler_id);
  } else {
    //通过销售顾问ID限制查询销售范围，只查询设置了销售目标的销售顾问，这样的好处就是直接用目标列表来控制明细
    const cellers = await CellerTag.find({
      year: year,
      month: month
    }).catch(err => { });
    cellers.map(d => {
      cellerids_set.add(d.celler_id);
    });
  }

  const dt1 = new Date(
    dt.getFullYear() + "-" + (dt.getMonth() + 1) + "-" + "1 00:00:00"
  );
  const dt2 = new Date(
    dt.getFullYear() +
    "-" +
    (dt.getMonth() + 1) +
    "-" +
    dt.getDate() +
    " 23:59:59"
  );

  let aggArr = [];
  aggArr.push({
    //销售日期筛选
    $match: {
      $and: [
        { solddt: { $gte: dt1 } },
        { solddt: { $lte: dt2 } },
        { celler_id: { $in: Array.from(cellerids_set) } }
      ]
    }
  });

  aggArr.push({
    $lookup: {
      from: "Specialsold",
      localField: "vin",
      foreignField: "vin",
      as: "soldme"
    }
  });

  //融合销售人员信息
  aggArr.push({
    $lookup: {
      from: "Cellers",
      localField: "celler_id",
      foreignField: "celler_id",
      as: "cellerinfo"
    }
  });

  //融合车辆装饰订单
  aggArr.push({
    $lookup: {
      from: "Deco_order",
      localField: "vin",
      foreignField: "vin",
      as: "decoorder"
    }
  });

  //融合装饰明细
  aggArr.push({
    $lookup: {
      from: "Deco_order_item",
      localField: "decoorder.order_id",
      foreignField: "order_id",
      as: "decoinfo"
    }
  });

  //融合车辆信息
  aggArr.push({
    $lookup: {
      from: "Car",
      localField: "vin",
      foreignField: "vin",
      as: "carinfo"
    }
  });

  //融合车型信息
  aggArr.push({
    $lookup: {
      from: "Cartype",
      localField: "carinfo.type_id",
      foreignField: "type_id",
      as: "typeinfo"
    }
  });

  let data = await Carsold.aggregate(aggArr); //选出销售数据

  let policy_aggArr = [];
  policy_aggArr.push({
    $match: {
      $and: [{ year: year }, { month: month }]
    }
  });

  policy_aggArr.push({
    $lookup: {
      from: "SalaryTypeIn",
      localField: "ltype",
      foreignField: "ltype",
      as: "typein_info"
    }
  });

  policy_aggArr.push({
    $lookup: {
      from: "SalaryTypeClass2Insde",
      localField: "typein_info.type_id",
      foreignField: "intypeid",
      as: "type_link"
    }
  });

  policy_aggArr.push({
    $lookup: {
      from: "Cartype",
      localField: "type_link.classtypeid",
      foreignField: "type_id",
      as: "class_type_info"
    }
  });

  const policy = await Car_month.aggregate(policy_aggArr); //选出加工过的政策数据

  if (policy.length == 0) {
    //如果找不到相应的政策数据就直接退回了
    return { code: 401 };
  }

  let map = new Map();

  policy.map(d => {
    //由于这个匹配的起源是来自于导入的当月政策表，是从内部车型向官方车型匹配的，因此会产生的问题就是有些内部车型可能并没有销售
    //没有销售的车型不会在匹配车型处进行提示，因为这是无意义参数，所以就会出现由内向外匹配的时候找不到官方车型的情况，抛弃这些无意义的值
    if (d.type_link.length > 0) {
      // type_link 跟 class_type_info的长度是一致的
      let re = {};
      re.man_percentage = d.man_percentage;
      re.net_percentage = d.net_percentage;
      re.sold_limit = d.sold_limit;
      re.percentage_limit = d.percentage_limit;

      d.class_type_info.map(info => {
        map.set(info.ltype, re);
      });
    }
  });

  // //拼接到主数据
  data = data.map(d => {
    if (map.get(d.typeinfo[0].ltype) != undefined) {
      d.policy = map.get(d.typeinfo[0].ltype);
    }

    //格式化日期
    d.solddt = require("../utils/utils").longdate(d.solddt);
    d.orderdt = require("../utils/utils").longdate(d.orderdt);
    //计算单车提成
    if (d.cate == "展厅") {
      d.policy.percentage = d.policy.man_percentage;
    } else {
      d.policy.percentage = d.policy.net_percentage;
    }

    //计算特殊奖励
    if (d.soldme.length > 0) {
      if (d.cate == "展厅") {
        d.soldme[0].pay = d.soldme[0].payceller;
      } else {
        d.soldme[0].pay = d.soldme[0].paynet;
      }
    } else {
      d.soldme.push({ pay: 0 });
    }

    //计算成本合计，结算价合计
    d.cb_sum = 0;
    d.js_sum = 0;
    if (d.decoinfo.length > 0) {
      d.decos = d.decoinfo.map(d => {
        return { name: d.name, js: d.js, cb: d.cb, count: d.count };
      });

      d.decos.map(item => {
        d.cb_sum = d.cb_sum + item.cb * item.count;
        d.js_sum = d.js_sum + item.js * item.count;
      });
    } else {
      d.decos = "";
    }

    //计算总产值和净产值
    /*
    逻辑描述：
    总产值=销售限价额度-实际优惠额度
    比如90000的车，可以优惠30000，实际优惠了27000送装饰，那么总产值就是3000
    当全款的情况下，优惠了32000，那么总产值就是-2000
    当按揭的情况下，优惠了32000，收3000手续费，那么需要用手续费先填2000的坑
    */
    d.price_anjie_left = 0;
    //总产值=结算额度-市场价+销售价格
    d.zhongchanzhi =
      d.policy.percentage_limit -
      d.typeinfo[0].price +
      d.price_car;

    //中心思想是如果是优惠的现金，那是实打实的真金白银，所以需要用手续费现金来填
    //如果是赠送的装饰之类的，就有很大的操作空间，

    //总产值
    if (d.zhongchanzhi < 0) {
      //如果为负，则判断是否有手续费
      if (Math.abs(d.zhongchanzhi) >= d.price_anjie) {
        //总产值亏损大于等于按揭款，按揭款填平
        //d.zhongchanzhi = d.zhongchanzhi + d.price_anjie;
        d.price_anjie_left = 0;
      } else {
        //总产值亏损小于按揭款，总产值填平，按揭款扣除抵扣部分成为剩余按揭款
        //d.zhongchanzhi = 0;
        d.price_anjie_left = d.price_anjie + d.zhongchanzhi;//按揭款为+ 总产值为-
      }
    }

    d.jingchanzhi = d.zhongchanzhi - d.js_sum;

    return d;
  });

  data.year = year;
  data.month = month;
  return data;
};

const countAllSoldData = async data => {
  //基础数据无内容则直接返回
  if (data.code == 401) {
    return data;
  }

  //选出销售人员的目标数据，然后通过循环基础数据求和之后拼接到目标数据对象
  let tags = await CellerTag.find({
    year: data.year,
    month: data.month
  }).catch(err => { });

  //  第一次加工，是因为原对象是一个mongoose 的 doc，不可以改变其结构，不能附加其他内容，所以取出数据转成普通JSON
  tags = tags.map(d => {
    return {
      name: "",
      celler_id: d.celler_id,
      sold: { tag: d.soldtag, done: 0, rate: 0, pay: 0 },
      special: { tag: d.specialtag, done: 0, pay: 0 },
      anjie: { tag: d.anjietag, done: 0 },
      anjiepay: { tag: d.anjietag * d.anjie, done: 0, pay: 0 },
      zcz: { done: 0, tag: d.soldtag * require("../config").salary.zcz_car },
      jcz: { done: 0, pay: 0 },
      paysum: 0
    };
  });

  //第二次加工，将每个销售顾问的销售分配到对应的sold数组中
  tags = tags.map(tag => {
    tag.soldinfo = [];
    data.forEach(sold => {
      if (sold.celler_id == tag.celler_id) {
        tag.soldinfo.push(sold);
      }
    });
    return tag;
  });

  //第三次加工，开始每种项目求和
  tags = tags.map(tag => {
    tag.soldinfo.forEach(sold => {
      tag.name = sold.cellerinfo[0].name;
      //实际交车
      tag.sold.done++;

      //特殊车提成
      if (sold.soldme[0].pay > 0) {
        tag.special.done++; //计算特殊车型数
        tag.special.pay = tag.special.pay + sold.soldme[0].pay; //计算特殊车奖励
      }

      //按揭车数量
      if (sold.price_anjie > 0) {
        tag.anjie.done++;
      }

      //单车提成，这时候还没有计算交车比例
      tag.sold.pay = tag.sold.pay + sold.policy.percentage;

      //按揭收款 使用的是冲抵了超额优惠后的剩余按揭款
      tag.anjiepay.done = tag.anjiepay.done + sold.price_anjie_left;

      //按揭款提成
      tag.anjiepay.pay =
        tag.anjiepay.done * require("../config").salary.aj_rate;

      //总产值
      tag.zcz.done = tag.zcz.done + sold.zhongchanzhi;
      //净产值
      tag.jcz.done = tag.jcz.done + sold.jingchanzhi;

      if (tag.jcz.done > 0) {
        tag.jcz.pay = tag.jcz.done * require("../config").salary.jcz_rate;
      } else {
        tag.jcz.pay = 0;
      }
      //总提成
      tag.paysum =
        tag.sold.pay + tag.special.pay + tag.anjiepay.pay + tag.jcz.pay;
    });

    tag.soldinfo = [];
    return tag;
  });

  //最终整理，计算比例等
  tags = tags.map(tag => {
    tag.sold.rate = Math.round((tag.sold.done / tag.sold.tag) * 100);

    //单车提车

    if (tag.sold.rate > 100) {
      tag.sold.rate = 100;
    }
    tag.sold.pay = Math.round((tag.sold.rate / 100) * tag.sold.pay);

    //给比例加上百分号
    tag.sold.rate = tag.sold.rate + "%";
    return tag;
  });

  return tags;
};

//工资明细
router.post("/salarylist", async ctx => {
  ctx.body = await getALLSoldData(
    ctx.request.body.year,
    ctx.request.body.month,
    ctx.request.body.celler_id
  );
});

//匹配车辆
router.post("/doftitype", async ctx => {
  await new class2inside(ctx.request.body)
    .save()
    .then(re => {
      ctx.body = { code: 200 };
    })
    .catch(err => {
      ctx.body = { code: 500, err: err.message };
    });
});

//导入车辆现价提成表
router.get("/car_month", async ctx => {
  const csv_data = await csv.reader("csv/car_month.csv");
  const year = 2019,
    month = 12;

  await Car_month.deleteMany({ year: year, month: month }).catch(err => { }); //删除对应年月的记录，然后再添加
  let timestamp = Date.now();

  for (const d of csv_data) {
    await new Car_month({
      year: year,
      month: month,
      stype: d["车系"],
      ltype: d["车型"],
      m_price: d["指导价"], //市场价
      man_percentage: d["展厅/DCC提成"], //展厅销售提成
      net_percentage: d["二网提成"], //网点销售提成
      sold_limit: d["销售权限"], //销售限价
      percentage_limit: d["提成结算价"] //提成限价
    })
      .save()
      .catch(err => { });

    await new types_in({
      type_id: timestamp,
      stype: d["车系"],
      ltype: d["车型"],
      price: d["指导价"]
    })
      .save()
      .catch(err => { });

    timestamp++;
  }

  ctx.body = { code: 200 };
});

//删除目标
router.post("/deltag", async ctx => {
  const pms = () => {
    return new Promise((res, rej) => {
      const mgse_obj = { _id: ctx.request.body._id };
      CellerTag.deleteOne(mgse_obj, (err, doc) => {
        if (err) {
          rej(err);
        } else {
          res(doc);
        }
      });
    });
  };

  ctx.body = await pms();
});

//目标列表
router.post("/taglist", async ctx => {
  const mgse_obj = {
    year: ctx.request.body.year,
    month: ctx.request.body.month
  };
  let data = await CellerTag.aggregate([
    { $match: mgse_obj },
    {
      $lookup: {
        from: "Cellers",
        localField: "celler_id",
        foreignField: "celler_id",
        as: "cellerinfo"
      }
    }
  ]);

  ctx.body = { data };
});

//添加目标
router.post("/addtag", async ctx => {
  const info = ctx.request.body.info;

  const findtag = await CellerTag.findOne({ year: info.year, month: info.month, celler_id: info.celler_id });
  if (!findtag) {
    await new CellerTag(info).save();
    ctx.body = { code: 200 }
  } else {
    ctx.body = { code: 500 }
  }
});

module.exports = router;
