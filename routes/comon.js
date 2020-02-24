const Router = require("koa-router");
const Carsold = require("../mongo/schema/carsold");
const Types_in = require("../mongo/schema/salary/types_in");
const class2inside = require("../mongo/schema/salary/class2inside");
const csv = require("../utils/csv");
const Specialsold = require("../mongo/schema/salary/specialsold");
const Deco_item = require("../mongo/schema/deco_item");
const Deco_order_item = require("../mongo/schema/deco_orders_items");
const rights = require("../mongo/schema/rights");
const rights_mini = require("../mongo/schema/rights_mini");
const CarHistory = require("../mongo/schema/carhistory");
const Celler = require("../mongo/schema/celler");
const CarSource = require("../mongo/schema/carsource");
const Cartype = require("../mongo/schema/cartype");
const Car = require("../mongo/schema/car");
const CarOrder = require("../mongo/schema/carorder");

const router = new Router();

router.get("/add_new_right", async ctx => {
  //const cate = "客流管理";
  //  await new rights({ cate, item_id: 1026, item_val: "cf_follow_view", item_text: "回访监督" }).save();
  ctx.body = { code: 200 }
})


//解决之前导入销售造成的没有成本数据后遗症
// router.get("/update_cb", async  ctx => {
//   const data = [
//     { name: "阳光全车膜", cb: 340, js: 680 },
//     { name: "阳光车身膜", cb: 150, js: 300 },
//     { name: "阳光前挡膜", cb: 190, js: 380 },
//     { name: "下护板", cb: 100, js: 200 },
//     { name: "舒适型全包脚垫", cb: 180, js: 250 },
//     { name: "原厂行车记录仪（6月活动）", cb: 245, js: 550 },
//     { name: "手编冰丝座垫（定制）", cb: 245, js: 550 },
//     { name: "头枕", cb: 20, js: 25 },
//     { name: "AJ日式竹碳包", cb: 8, js: 10 },
//     { name: "诗蒂香水-新苹果", cb: 8, js: 10 },
//     { name: "抱枕", cb: 48, js: 60 },
//     { name: "方向套-威利斯尔方向套-PU皮", cb: 30, js: 30 },
//     { name: "原厂底盘装甲", cb: 198, js: 380 },
//     { name: "手提式干粉灭火器(1Kg)", cb: 48, js: 60 },
//     { name: "原厂倒车影像", cb: 499, js: 499 },
//     { name: "小苹果行车记录仪(夜视)", cb: 180, js: 380 },
//     { name: "车衣-单层通用（轿车）", cb: 60, js: 80 },
//     { name: "后备箱垫皮革", cb: 90, js: 150 },

//   ];

//   for (const d of data) {
//     await Deco_order_item.updateMany({ name: d.name }, { cb: d.cb });
//   }

//   ctx.body = { code: 200 }
// })

//通过订单号查询订单明细
router.post("/orderinfo_by_order_id", async ctx => {
  let aggArr = [];
  aggArr.push({
    $match: {
      car_order_id: ctx.request.body.info.car_order_id
    }
  })

  aggArr.push({
    $lookup: {
      from: "Cartype",
      localField: "type_id",
      foreignField: "type_id",
      as: "typeinfo"
    }
  })

  let data = (await CarOrder.aggregate(aggArr))[0];
  data = {
    stype: data.typeinfo[0].stype,
    price: data.typeinfo[0].price,
    ltype: data.typeinfo[0].ltype,
    clr: data.clr,
    zspay: data.zspay,
    ajpay: data.ajpay,
    carpay: data.carpay,
    opay: data.opay,
    odt: require("../utils/utils").longdate(data.odt),
    name: data.name,
    tips: data.tips,
    idcode: data.idcode,
    address: data.address,
    tel: data.tel,
    carpay: data.carpay,
    payway1: data.payway1,
    payway2: data.payway2,
    cate: data.cate,
    celler_id: data.celler_id,
    state: data.state
  };
  ctx.body = { code: 200, data: data }
})

//通过车架号查询车型和颜色参数
router.post("/typeinfo_by_vin", async ctx => {
  let aggArr = [];

  aggArr.push({
    $match: {
      vin: ctx.request.body.info.vin
    }
  })

  aggArr.push({
    $lookup: {
      from: "Cartype",
      localField: "type_id",
      foreignField: "type_id",
      as: "typeinfo"
    }
  })

  ctx.body = { code: 200, data: (await Car.aggregate(aggArr))[0] }
})

//更新上报日期 点款日期 合格证编号
router.get("/update_car_other_info", async ctx => {
  const csv_data = await csv.reader("csv/other_info.csv");

  for (const d of csv_data) {
    await Car.updateOne({ vin: d.vin }, { hgz: d.hgz, dolreport: d.dol, payall: d.payfull, pdt: d.pdt, arrdt: d.arrdt });
  }

  ctx.body = { code: 200 }

})

//通过ltype 车辆配置匹配其他参数
router.post("/fitdatabyltype", async ctx => {
  const types = await Cartype.find({ ltype: ctx.request.body.info.ltype });

  if (types.length == 0) {
    ctx.body = { code: 500 }
  } else {
    ctx.body = { code: 200, data: types }
  }
})

//车辆来源列表
router.post("/car_source", async ctx => {
  let set = new Set();

  const source = await CarSource.find();
  source.forEach(d => {
    set.add(d.val);
  })

  ctx.body = { code: 200, data: Array.from(set) }
})

//尴尬
router.post("/cellerid2name", async ctx => {
  ctx.body = await Celler.findOne({ celler_id: ctx.request.body.info.cellerid });
})

//查询车辆历史
router.post("/carhistory", async ctx => {
  ctx.body = await CarHistory.find({ vin: ctx.request.body.vin });
})

//格式化微权限对象 未采用
router.get("/minirights", async ctx => {
  const rights = [
    { au_id: 1000, cate: "订单", val: "更新订单" },
    { au_id: 1001, cate: "订单", val: "其他权限" }
  ];

  for (const d of rights) {
    await new rights_mini(d).save();
  }
  ctx.body = { code: 200 };
});

//格式化权限对象
router.post("/rightslist", async ctx => {
  let data = await rights.find().catch(err => { });
  let re_map = new Map();
  data.forEach(d => {
    if (re_map.get(d.cate) == undefined) {
      //未定义的分类，则定义
      re_map.set(d.cate, [
        {
          id: d._id,
          iid: d.item_id,
          val: d.item_val,
          text: d.item_text,
          state: 0
        }
      ]);
    } else {
      //已存在的分类，则添加到分类下
      re_map.get(d.cate).push({
        id: d._id,
        iid: d.item_id,
        val: d.item_val,
        text: d.item_text,
        state: 0
      });
    }
  });

  let re = [];
  let i = 0;
  re_map.forEach((val, key) => {
    re.push({ id: i, cate: key, items: val });
    i++;
  });
  ctx.body = re;
});

//刷新总权限列表
router.post("/urights", async ctx => {
  await rights.deleteMany({});

  let i = 1000;
  const rights_arr = [
    {
      cate: "销售",
      item_id: i,
      item_val: "carsold_detail_query",
      item_text: "查询明细"
    },
    {
      cate: "销售",
      item_id: i + 1,
      item_val: "carsold_detail_au",
      item_text: "添加 / 更新"
    },
    {
      cate: "工资核算",
      item_id: i + 2,
      item_val: "salary_check_data",
      item_text: "目标管理"
    },
    {
      cate: "工资核算",
      item_id: i + 3,
      item_val: "salary_count_query_output",
      item_text: "数据统计"
    },
    {
      cate: "工资核算",
      item_id: i + 4,
      item_val: "salary_query_output",
      item_text: "查询明细"
    },
    {
      cate: "工资核算",
      item_id: i + 5,
      item_val: "salary_data_import",
      item_text: "数据导入"
    },
    {
      cate: "库存",
      item_id: i + 10,
      item_val: "newcarenter",
      item_text: "入库 / 出库"
    },
    {
      cate: "库存",
      item_id: i + 11,
      item_val: "carstorelist",
      item_text: "查询明细"
    },
    {
      cate: "库存",
      item_id: i + 12,
      item_val: "carmanage",
      item_text: "车辆管理"
    },
    {
      cate: "库存",
      item_id: i + 13,
      item_val: "inwaycarmanage",
      item_text: "在途车辆"
    },
    {
      cate: "库存",
      item_id: i + 14,
      item_val: "caralllist",
      item_text: "总到车明细"
    },
    {
      cate: "订单",
      item_id: i + 15,
      item_val: "orderlist",
      item_text: "查询明细"
    },
    {
      cate: "订单",
      item_id: i + 16,
      item_val: "ordermanage",
      item_text: "订单管理"
    },
    {
      cate: "数据管理",
      item_id: i + 1000,
      item_val: "decomain",
      item_text: "装饰项目"
    },
    {
      cate: "数据管理",
      item_id: i + 1001,
      item_val: "cellermain",
      item_text: "销售顾问"
    },
    {
      cate: "数据管理",
      item_id: i + 1002,
      item_val: "reg",
      item_text: "用户注册"
    },
    {
      cate: "数据管理",
      item_id: i + 1003,
      item_val: "rights",
      item_text: "权限管理"
    }
  ];

  for (const d of rights_arr) {
    await new rights(d).save().catch(err => { });
  }

  ctx.body = { code: 200 };
});

//通过价格查找未匹配的车型
router.post("/nofitintype", async ctx => {
  const d = ctx.request.body;
  const data = await Types_in.find({ price: d.price });
  ctx.body = data;
});

//移除重点推送车辆
router.get("/remove_soldme", async ctx => {
  const data = await csv.reader("重点推送取消.csv");
  for (const d of data) {
    Specialsold.findOne({ vin: d["VIN"] }, (err, doc) => {
      if (doc) {
        //找到车架号，更新它
        Specialsold.deleteOne({ vin: d["VIN"] }, (err, doc) => { });
      }
    });
  }

  ctx.body = { code: 200 };
});

//导入重点推送车辆
router.get("/import_soldme", async ctx => {
  const data = await csv.reader("csv/重点推送.csv");
  for (const d of data) {
    Specialsold.findOne({ vin: d["VIN"] }, async (err, doc) => {
      if (doc) {
        //找到车架号，更新它
        Specialsold.updateOne(
          { vin: d["VIN"] },
          { payceller: d["展厅"], paynet: d["网点"] },
          (err, doc) => { }
        );
      } else {
        //找不到，保存新记录
        await new Specialsold({
          vin: d["VIN"],
          payceller: d["展厅"],
          paynet: d["网点"]
        })
          .save()
          .catch(err => { });
      }
    });
  }

  ctx.body = { code: 200 };
});

//整理使用过的装饰项目并更新装饰数据表
router.get("/updatedeco/:month", async ctx => {
  const todate = new Date().setMonth(new Date().getMonth() - ctx.params.month);
  let aggArr = [];
  //基础数据 按照日期筛选的销售记录
  aggArr.push({
    $match: {
      $and: [
        { solddt: { $lt: new Date() } },
        { solddt: { $gt: new Date(todate) } }
      ]
    }
  });

  //融合装饰订单
  aggArr.push({
    $lookup: {
      from: "Deco_order",
      localField: "vin",
      foreignField: "vin",
      as: "decoorder"
    }
  });

  //融合装饰项目
  aggArr.push({
    $lookup: {
      from: "Deco_order_item",
      localField: "decoorder.order_id",
      foreignField: "order_id",
      as: "decoinfo"
    }
  });

  let data = await Carsold.aggregate(aggArr);
  let deco_set = new Set();
  for (const main_arr of data) {
    for (const deco of main_arr.decoinfo) {
      deco_set.add(deco.name);
    }
  }

  let obj = [];
  deco_set.forEach(d => {
    obj.push({ name: d });
  });

  csv.writer(obj, ["name"], Date.now() + ".csv");
  ctx.body = { code: 200 };
});

//导入整理好的装饰项目数据
router.get("/ipt_decos", async ctx => {
  await Deco_item.deleteMany({});

  console.log("data clear");
  const data = await csv.reader("decos.csv");
  for (const d of data) {
    await new Deco_item({
      cb: d["成本"],
      js: d["结算"],
      name: d["name"],
      scode: d["短码"]
    })
      .save()
      .catch(err => { });
  }
  console.log("Deco_item updated.");

  const items = await Deco_order_item.find().exec();

  for (const item of items) {
    //遍历全部的装饰明细
    for (const d of data) {
      //遍历装饰项目数据
      if (item.name == d["name"]) {
        //如果名称相同，则更新其结算价和成本价
        await item.updateOne({
          cb: d["成本"],
          js: d["结算"],
          scode: d["短码"]
        });
      }
    }
  }

  console.log("Deco_order_item updated.");
});

//从最近两个月的销售车型中统计没有匹配的官方车型
router.post("/nofittype", async ctx => {
  const todate = new Date().setMonth(new Date().getMonth() - 2);
  let agg_obj = [];

  //取得车型匹配表中的官方车型ID
  let typefit = await class2inside.find({});
  const fit_ids = typefit.map(d => {
    return d.classtypeid;
  });

  //匹配销售日期
  agg_obj.push({
    $match: {
      $and: [
        {
          solddt: { $lte: new Date() }
        },
        {
          solddt: { $gte: new Date(todate) }
        }
      ]
    }
  });

  //融合car表，取得carinfo
  agg_obj.push({
    $lookup: {
      from: "Car",
      localField: "vin",
      foreignField: "vin",
      as: "carinfo"
    }
  });

  //融合cartype表，取得cartypeinfo
  agg_obj.push({
    $lookup: {
      //拼接车型参数
      from: "Cartype",
      localField: "carinfo.type_id",
      foreignField: "type_id",
      as: "cartypeinfo"
    }
  });

  agg_obj.push({
    $match: {
      "cartypeinfo.type_id": { $nin: fit_ids } // 排除掉已匹配的官方车型ID
    }
  });

  //获取到了最大的完整数据
  let data = await Carsold.aggregate(agg_obj);

  let types = new Set();
  let types_arr = [];

  data.forEach(d => {
    if (!types.has(d.cartypeinfo[0].ltype)) {
      //新的车型
      types_arr.push({
        type: d.cartypeinfo[0].ltype,
        id: d.cartypeinfo[0].type_id,
        price: d.cartypeinfo[0].price
      });
      types.add(d.cartypeinfo[0].ltype); //添加到set
    }
  });
  ctx.body = types_arr;
});

//查找几个月内销售车辆的车型
const get_type_in_sold = async (month, price) => {
  const todate = new Date().setMonth(new Date().getMonth() - month);
  let agg_obj = [];

  agg_obj.push({
    $match: {
      $and: [
        {
          solddt: { $lt: new Date() }
        },
        {
          solddt: { $gt: new Date(todate) }
        }
      ]
    }
  });

  agg_obj.push({
    $lookup: {
      from: "Car",
      localField: "vin",
      foreignField: "vin",
      as: "carinfo"
    }
  });

  agg_obj.push({
    $lookup: {
      //拼接车型参数
      from: "Cartype",
      localField: "carinfo.type_id",
      foreignField: "type_id",
      as: "cartypeinfo"
    }
  });

  let data = await Carsold.aggregate(agg_obj);

  if (price != 0) {
    data = data.filter(d => {
      return d.cartypeinfo[0].price == price;
    });
  }

  let types = new Set();
  let types_arr = [];

  data.forEach(d => {
    if (!types.has(d.cartypeinfo[0].ltype)) {
      //新的车型
      types_arr.push({
        type: d.cartypeinfo[0].ltype,
        id: d.cartypeinfo[0].type_id
      });
      types.add(d.cartypeinfo[0].ltype); //添加到set
    }
  });
  return types_arr;
};

//查询指定几个月内销售车辆的车型列表
router.get("/type_in_sold/:month/:price", async ctx => {
  ctx.body = {
    data: await get_type_in_sold(ctx.params.month, ctx.params.price)
  };
});

module.exports = router;
