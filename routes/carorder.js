const Router = require("koa-router");
const CarType = require("../mongo/schema/cartype");
const CarOrder = require("../mongo/schema/carorder");
const Deco_order = require("../mongo/schema/deco_orders");
const Deco_order_item = require("../mongo/schema/deco_orders_items");
const utils = require("../utils/utils");
const OrderLink = require("../mongo/schema/orderlink")
const CarOrderLink = require("../mongo/schema/orderlink")
const csv = require("../utils/csv");
const Celler = require("../mongo/schema/celler");

const router = new Router();

router.post("/fast_order_info", async ctx => {

  let aggArr = [];
  aggArr.push({
    $match: { car_order_id: ctx.request.body.info.car_order_id }
  })

  //融合车型
  aggArr.push({
    $lookup: {
      from: "Cartype",
      localField: "type_id",
      foreignField: "type_id",
      as: "typeinfo"
    }
  })

  //融合销售顾问
  aggArr.push({
    $lookup: {
      from: "Cellers",
      localField: "celler_id",
      foreignField: "celler_id",
      as: "cellerinfo"
    }
  })

  const orderinfo = await CarOrder.aggregate(aggArr);
  const data = {
    stype: orderinfo[0].typeinfo[0].stype,
    price: orderinfo[0].typeinfo[0].price,
    ltype: orderinfo[0].typeinfo[0].ltype,
    clr: orderinfo[0].clr,
    odt: orderinfo[0].odt,
    cate: orderinfo[0].cellerinfo[0].cate,
    celler: orderinfo[0].cellerinfo[0].name,
    celler_id: orderinfo[0].cellerinfo[0].celler_id,
    tips: orderinfo[0].tips,
    car_order_id: orderinfo[0].car_order_id
  };
  ctx.body = { code: 200, data: data };
})

//导入展厅订单
router.get("/import_celler", async ctx => {
  await CarOrder.deleteMany();//清空订单表

  const csv_data = await csv.reader("csv/order_from_celler.csv");//读取到数据
  let deco_order_id = Date.now(), car_order_id = Date.now();

  //生成销售顾问名称 ID 对照表
  const cellers = await Celler.find({ state: true });//限定查找范围为使用中的销售顾问，包含展厅和网点
  let cellers_map = new Map();
  cellers.forEach(d => {
    cellers_map.set(d.name, d.celler_id);
  })

  // 生成车型配置 ID 对照表
  const cattypes = await CarType.find();
  let cartypes_map = new Map();
  cattypes.forEach(d => {
    cartypes_map.set(d.ltype, d.type_id);
  })


  for (const d of csv_data) {

    if (d["赠送装饰"].length > 0) {// 带有装饰项目
      deco_order_id++;
      const decos = d["赠送装饰"].split("^").filter(d => {
        return d != ""//去掉空的项目
      });

      for (const d of decos) {
        const vals = d.split(":");
        await new Deco_order_item({ cb: 0, js: vals[3], count: 1, order_id: deco_order_id, name: vals[0] }).save();
      }
    }

    await new CarOrder({
      name: d["姓名"],
      idcode: d["身份证"],
      tel: d["电话"],
      address: d["地址"],
      opay: d["定金"],
      carpay: d["总金额"],
      zspay: d["装饰款"],
      ajpay: d["按揭手续费"],
      deco_order_id: deco_order_id,//尚未处理
      clr: d["颜色"],
      odt: utils.longdate(d["订车日期"]),
      payway1: d["支付方式"],
      payway2: d["方式关联"],
      cate: d["销售划分"],
      celler_id: cellers_map.get(d["销售顾问"]),
      state: "有效订单",
      type_id: cartypes_map.get(d["配置"].trim()),
      car_order_id: car_order_id,
      order_type: 0
    }).save();//保存记录

    car_order_id++;
  }

  ctx.body = { code: 200, msg: "done" }
})

//指定订单给车辆
router.post("/dolinkorder", async ctx => {
  const order_id = ctx.request.body.order_id;
  const vin = ctx.request.body.vin;
  //删除已有的绑定订单号
  await OrderLink.deleteMany({ order_id: order_id }).catch(err => { })
  //删除已有的绑定车架号
  await OrderLink.deleteMany({ vin: vin }).catch(err => { })

  await new OrderLink({ order_id: order_id, vin: vin }).save();

  ctx.body = { code: 200 }
})

//这是提供给订单统计用的数据，所以经过了简化，不融合冗余的数据
const getOrderCountList = async order_type => {
  let aggArr = [];

  aggArr.push({
    $match: { order_type: order_type }
  })

  aggArr.push({
    $match: {//限定了有效订单，无效订单不参与统计
      state: "有效订单"
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

  aggArr.push({
    $lookup: {
      from: "Cellers",
      localField: "celler_id",
      foreignField: "celler_id",
      as: "cellerinfo"
    }
  })

  return await CarOrder.aggregate(aggArr)
}

//通过车型代码和颜色查找可匹配的订单
router.post("/findOrderByTypeidAndClr", async ctx => {
  let aggArr = [];
  aggArr.push({
    $match: { type_id: ctx.request.body.type_id, clr: ctx.request.body.clr, state: "有效订单" }
  })

  aggArr.push({
    $lookup: {
      from: "Cellers",
      localField: "celler_id",
      foreignField: "celler_id",
      as: "cellerinfo"
    }
  })

  aggArr.push({
    $lookup: {
      from: "CarOrderLink",
      localField: "car_order_id",
      foreignField: "order_id",
      as: "linkinfo"
    }
  })

  await CarOrder.aggregate(aggArr).then(doc => {
    ctx.body = { code: 200, data: doc };
  }).catch(err => {
    ctx.body = { code: 500 }
  })
})


router.post("/order_fast_count", async ctx => {
  const data = await getOrderCountList(1);
  let re = [];
  //获取销售顾问姓名作为行头
  let celler_set = new Set();
  //获取所有存在车型作为列头
  let stype_set = new Set();

  data.forEach(d => {//首次循环，获取两个SET数据 ,行列
    celler_set.add(d.cellerinfo[0].name);
    stype_set.add(d.typeinfo[0].stype);
  })

  let celler = Array.from(celler_set);
  let stype = Array.from(stype_set);

  let sums = stype.map(d => {
    return { stype: d, val: 0 };
  });

  celler.forEach(celler_name => {//循环销售
    let row = {};
    row.name = celler_name;
    row.types = stype.map(d => {
      return { stype: d, val: 0 };
    })

    data.forEach(d => {//循环明细
      if (d.cellerinfo[0].name == celler_name) {
        if (!row.sum) {
          row.sum = 1;
        } else {
          row.sum++;
        }

        //循环型号
        row.types.forEach(stype_val => {
          if (stype_val.stype == d.typeinfo[0].stype) {
            stype_val.val++;
          }
        })
      }
    })
    re.push(row);
  })

  sums.forEach(stype_val => {
    data.forEach(d => {
      if (d.typeinfo[0].stype == stype_val.stype) {
        stype_val.val++;
      }
    })
  })

  let all_sum = 0;

  sums.forEach(d => {
    all_sum = all_sum + d.val;
  })
  // re.forEach(d => {
  //   Object.assign(d, ...d.types);
  // })
  ctx.body = { row_title: "销售顾问", rows: celler, cols: stype, sums: sums, all_sum: all_sum, data: re };
})

//订单分销售顾问 车型 统计
//反馈格式需要满足
// {
// 	"row_title": "销售顾问",
// 	"rows": ["秦雪", "张苗苗", "张飞", "郑超"],
// 	"cols": ["迈锐宝XL", "科鲁泽"],
// 	"all_sum": 5,
// 	"sums": [{
// 		"stype": "迈锐宝XL",
// 		"val": 3
// 	}, {
// 		"stype": "科鲁泽",
// 		"val": 2
// 	}],
// 	"data": [{
// 		"name": "郑超",
// 		"types": [{
// 			"stype": "迈锐宝XL",
// 			"val": 0
// 		}, {
// 			"stype": "科鲁泽",
// 			"val": 1
// 		}],
// 		"sum": 1
// 	}]
// }
router.post("/order_count", async ctx => {
  const data = await getOrderCountList(0);
  let re = [];
  //获取销售顾问姓名作为行头
  let celler_set = new Set();
  //获取所有存在车型作为列头
  let stype_set = new Set();

  data.forEach(d => {//首次循环，获取两个SET数据 ,行列
    celler_set.add(d.cellerinfo[0].name);
    stype_set.add(d.typeinfo[0].stype);
  })

  let celler = Array.from(celler_set);
  let stype = Array.from(stype_set);

  let sums = stype.map(d => {
    return { stype: d, val: 0 };
  });

  celler.forEach(celler_name => {//循环销售
    let row = {};
    row.name = celler_name;
    row.types = stype.map(d => {
      return { stype: d, val: 0 };
    })

    data.forEach(d => {//循环明细
      if (d.cellerinfo[0].name == celler_name) {
        if (!row.sum) {
          row.sum = 1;
        } else {
          row.sum++;
        }

        //循环型号
        row.types.forEach(stype_val => {
          if (stype_val.stype == d.typeinfo[0].stype) {
            stype_val.val++;
          }
        })
      }
    })
    re.push(row);
  })

  sums.forEach(stype_val => {
    data.forEach(d => {
      if (d.typeinfo[0].stype == stype_val.stype) {
        stype_val.val++;
      }
    })
  })

  let all_sum = 0;

  sums.forEach(d => {
    all_sum = all_sum + d.val;
  })
  // re.forEach(d => {
  //   Object.assign(d, ...d.types);
  // })
  ctx.body = { row_title: "销售顾问", rows: celler, cols: stype, sums: sums, all_sum: all_sum, data: re };
})

router.post("/singledecolist", async ctx => {
  const deco_id = ctx.request.body.deco_order_id;
  await Deco_order_item.find({ order_id: deco_id })
    .then(re => {
      ctx.body = re;
    })
    .catch(err => {
      ctx.body = { code: 500 };
    });
});

//单条订单记录完整信息，包括一切
router.post("/fullinfo", async ctx => {
  const id = ctx.request.body.car_order_id;

  let aggArr = [];

  aggArr.push({
    $match: {
      car_order_id: id
    }
  });

  aggArr.push({
    $lookkup: {
      from: "Cartype",
      localField: "type_id",
      foreignField: "type_id",
      as: "typeinfo"
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

  aggArr.push({
    $lookup: {
      from: "Deco_order_item",
      localField: "deco_order_id",
      foreignField: "order_id",
      as: "decoinfo"
    }
  });

  let data = await CarOrder.aggregate(aggArr);

  ctx.body = data;
});

//更新单条订单记录
router.post("/updateorder", async ctx => {
  const req = ctx.request.body.info;
  const typeinfo = await CarType.findOne({ ltype: req.order.ltype }).catch(err => { });

  if (typeinfo) {

    if (req.order.state == "无效订单") {//订单被无效化，则需要删除一下有可能存在的绑定
      await CarOrderLink.deleteOne({ order_id: req.car_order_id });
    }
    req.order.type_id = typeinfo.type_id;
    await CarOrder.updateOne(
      { car_order_id: req.car_order_id },
      req.order,
      (err, doc) => {
        if (err) {
          ctx.body = { code: 500 };
        } else {
          ctx.body = { code: 200 };
        }
      }
    );
  }
});

//更新订单的装饰项目
router.post("/updatedeco", async ctx => {
  const req = ctx.request.body;
  if (req.needAdd) {
    await addOrderDeco(req);
  } else {
    await updateOrderDeco(req);
  }
  ctx.body = { code: 200 };
});

//添加订单装饰项目
const addOrderDeco = async req => {
  const deco_order_id = req.deco_order_id;
  const order_id = req.order_id;
  const decos = req.data;
  for (let item of decos) {
    await new Deco_order_item({
      cb: item.cb,
      js: item.js,
      count: item.count,
      order_id: deco_order_id,
      name: item.name
    })
      .save()
      .catch(err => { }); //保存装饰项目组
  }

  //更新装饰项目组ID到订单数据
  await CarOrder.updateOne(
    { car_order_id: order_id },
    { deco_order_id: deco_order_id }
  ).catch(err => { });
};

//更新订单装饰项目
const updateOrderDeco = async req => {
  const deco_order_id = req.deco_order_id;
  const order_id = req.order_id;
  const decos = req.data;

  await Deco_order_item.deleteMany({
    order_id: deco_order_id
  }).then((err, doc) => { }); //删除对应ID所有的装饰项目

  if (decos.length == 0) {
    //没有装饰项目,则更新订单的对应装饰项目组ID为0
    await CarOrder.updateOne({ car_order_id: order_id }, { deco_order_id: 0 });
  } else {
    for (let item of decos) {
      await new Deco_order_item({
        cb: item.cb,
        js: item.js,
        count: item.count,
        order_id: deco_order_id,
        name: item.name
      }).save((err, re) => { }); //保存装饰项目组
    }
  }
};

//删除订单
router.post("/delorder", async ctx => {
  const car_order_id = ctx.request.body.info.car_order_id;
  const order = await CarOrder.findOne({ car_order_id: car_order_id });

  await CarOrder.deleteOne({ car_order_id: car_order_id }) //删除订单
  await CarOrderLink.deleteOne({ order_id: car_order_id });// 删除绑定
  console.log(order.deco_order_id);
  await Deco_order_item.deleteMany({ order_id: order.deco_order_id });// 删除装饰

  ctx.body = { code: 200 };
});

//作废订单
router.post("/cancel", async ctx => {
  //do something
});

//单笔订单信息查询
router.post("/singleinfo", async ctx => {
  let aggArr = [];
  aggArr.push({
    $match: { car_order_id: ctx.request.body.car_order_id + "" }
  });

  //融合车型
  aggArr.push({
    $lookup: {
      from: "Cartype",
      localField: "type_id",
      foreignField: "type_id",
      as: "typeinfo"
    }
  });

  //融合销售顾问数据
  aggArr.push({
    $lookup: {
      from: "Cellers",
      localField: "celler_id",
      foreignField: "celler_id",
      as: "cellerinfo"
    }
  });

  //融合装饰项目
  aggArr.push({
    $lookup: {
      from: "Deco_order_item",
      localField: "deco_order_id",
      foreignField: "order_id",
      as: "decoinfo"
    }
  });

  const data = await CarOrder.aggregate(aggArr);
  ctx.body = { data: data[0] }; //由于是使用的融合，所以返回是一个数组，但其实是用ID查询的所以只可能有一个元素
});

//添加快速订单
router.post("/addorderfast", async ctx => {
  const info = ctx.request.body.info;
  info.order_type = 1;//标记为快速订单
  const typeinfo = await CarType.findOne({ ltype: info.ltype }).catch(err => { });
  if (typeinfo) {
    info.type_id = typeinfo.type_id;
    info.car_order_id = Date.now();
    await new CarOrder(info)
      .save()
      .then(re => {
        ctx.body = { code: 200, car_order_id: info.car_order_id };
      })
      .catch(err => {
        ctx.body = { code: 403, msg: "err" };
      });
  } else {
    //车型不存在
    ctx.body = { code: 500, msg: "cartype is null" };//一般不会存在这种情况
  }
})

//添加订单
router.post("/addorder", async ctx => {
  const req = ctx.request.body.info;
  //req.order_id=0; schema设置了默认值，可以不显性操作
  const typeinfo = await CarType.findOne({ ltype: req.ltype }).catch(err => { });
  if (typeinfo) {
    req.type_id = typeinfo.type_id;
    req.car_order_id = Date.now();
    await new CarOrder(req)
      .save()
      .then(re => {
        ctx.body = { code: 200, car_order_id: req.car_order_id };
      })
      .catch(err => {
        ctx.body = { code: 403, msg: "err" };
      });
  } else {
    //车型不存在
    ctx.body = { code: 500, msg: "cartype is null" };//一般不会存在这种情况
  }
});

//快速订单的查询列表
router.post("/list_fast_order", async ctx => {
  let andVal = [];
  const obj = ctx.request.body.info;
  const dt1 = new Date(utils.shortdate(obj.dt1) + " 00:00");
  const dt2 = new Date(utils.shortdate(obj.dt2) + " 23:59");

  andVal.push({ order_type: 1 });
  andVal.push({ odt: { $lt: dt2 } });
  andVal.push({ odt: { $gt: dt1 } });

  if (obj.stype != "") {
    andVal.push({ "typeinfo.stype": obj.stype });
  }

  if (obj.price != "") {
    andVal.push({ "typeinfo.price": obj.price });
  }

  if (obj.clr != "") {
    andVal.push({ clr: obj.clr });
  }

  if (obj.cate != "") {
    andVal.push({ cate: obj.cate });
  }

  if (obj.celler_id != "") {
    andVal.push({ celler_id: obj.celler_id });
  }

  let re = {};
  if (andVal.length > 0) {
    re = await getOrderList({ $match: { $and: andVal } });
  } else {
    re = await getOrderList();
  }

  if (re.length > 0) {
    re.forEach(d => {
      d.odt = require("../utils/utils").longdate(d.odt);
    });
    ctx.body = { code: 200, data: re };
  } else {
    ctx.body = { code: 401 };
  }
})

router.post("/list", async ctx => {
  let andVal = [];
  const obj = ctx.request.body;
  const dt1 = new Date(utils.shortdate(obj.dt1) + " 00:00");
  const dt2 = new Date(utils.shortdate(obj.dt2) + " 23:59");

  andVal.push({ order_type: 0 });
  andVal.push({ odt: { $lt: dt2 } });
  andVal.push({ odt: { $gt: dt1 } });

  if (obj.name != '') {
    andVal.push({ name: { $regex: obj.name } })
  }

  if (obj.state != "") {
    andVal.push({ state: obj.state });
  }

  if (obj.stype != "") {
    andVal.push({ "typeinfo.stype": obj.stype });
  }

  if (obj.price != "") {
    andVal.push({ "typeinfo.price": obj.price });
  }

  if (obj.clr != "") {
    andVal.push({ clr: obj.clr });
  }

  if (obj.celler != "") {
    andVal.push({ celler_id: obj.celler });
  }

  let re = {};
  if (andVal.length > 0) {
    re = await getOrderList({ $match: { $and: andVal } });
  } else {
    re = await getOrderList();
  }

  if (re.length > 0) {
    re.forEach(d => {
      d.odt = require("../utils/utils").longdate(d.odt);
    });
    ctx.body = { data: re };
  } else {
    ctx.body = { code: 401 };
  }
});

//整体数据，通过这个数据得到加工过的列表，比如车型，颜色，销售顾问，等等
const getOrderList = async (agg = "") => {
  let aggArr = [];

  //融合车型数据
  aggArr.push({
    $lookup: {
      from: "Cartype",
      localField: "type_id",
      foreignField: "type_id",
      as: "typeinfo"
    }
  });

  //融合销售顾问数据
  aggArr.push({
    $lookup: {
      from: "Cellers",
      localField: "celler_id",
      foreignField: "celler_id",
      as: "cellerinfo"
    }
  });

  //融合装饰项目
  aggArr.push({
    $lookup: {
      from: "Deco_order_item",
      localField: "deco_order_id",
      foreignField: "order_id",
      as: "decoinfo"
    }
  });

  //如果有筛选条件就加入筛选条件
  if (agg != "") {
    aggArr.push(agg);
  }

  const data = await CarOrder.aggregate(aggArr);
  return data;
};

module.exports = router;
