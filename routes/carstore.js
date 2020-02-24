const Router = require("koa-router");
const csv = require("../utils/csv");
const NowStore = require("../mongo/schema/carstore/nowstore");
const Car = require("../mongo/schema/car");
const CarType = require("../mongo/schema/cartype");
const CarOrder = require("../mongo/schema/carorder");
const CarOrderLink = require("../mongo/schema/orderlink");
const KeyMove = require("../mongo/schema/carstore/keymove");
const Celler = require("../mongo/schema/celler");
const Deco_order = require("../mongo/schema/deco_orders");
const Deco_order_item = require("../mongo/schema/deco_orders_items");
const CarHistory = require("../mongo/schema/carhistory");
const OutPisi = require("../mongo/schema/out_posi");
const CarMoveOut = require("../mongo/schema/carmoveout");
const CarInWay = require("../mongo/schema/carinway");
const SpecialSold = require("../mongo/schema/salary/specialsold")
const Carsold = require("../mongo/schema/carsold");

const CallCar_cancall = require("../mongo/schema/callcar/cancall");
const CallCar_willcall = require("../mongo/schema/callcar/willcall");

const Willcall = require("../mongo/schema/callcar/willcall");
const Cancall = require("../mongo/schema/callcar/cancall");

const router = new Router();
const utils = require("../utils/utils");

//调出车辆明细
router.post('/moveOutList', async ctx => {
  const info = ctx.request.body.info;

  let andArr = [], aggArr = [];
  const dt1 = new Date(utils.shortdate(info.dt1) + " 00:00");
  const dt2 = new Date(utils.shortdate(info.dt2) + " 23:59");
  andArr.push({ movedt: { $lte: dt2 } });
  andArr.push({ movedt: { $gte: dt1 } });

  aggArr.push({//这里没加判断是因为andArr必定有值
    $match: {
      $and: andArr
    }
  })

  //融合车辆
  aggArr.push({
    $lookup: {
      from: "Car",
      localField: "vin",
      foreignField: "vin",
      as: "carinfo"
    }
  })

  //融合车型
  aggArr.push({
    $lookup: {
      from: "Cartype",
      localField: "carinfo.type_id",
      foreignField: "type_id",
      as: "typeinfo"
    }
  })

  let data = await CarMoveOut.aggregate(aggArr);

  data.sort((v1, v2) => {//调拨日期排序
    return new Date(v1.movedt) - new Date(v2.movedt);
  })

  ctx.body = { code: 200, data };
})


//调入车辆明细
router.post('/moveInList', async ctx => {
  const info = ctx.request.body.info;

  let andArr = [], aggArr = [];
  const dt1 = new Date(utils.shortdate(info.dt1) + " 00:00");
  const dt2 = new Date(utils.shortdate(info.dt2) + " 23:59");
  andArr.push({ arrdt: { $lte: dt2 } });
  andArr.push({ arrdt: { $gte: dt1 } });
  andArr.push({ source: { $ne: "厂家到车" } })

  aggArr.push({//这里没加判断是因为andArr必定有值
    $match: {
      $and: andArr
    }
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

  //融合销售
  aggArr.push({
    $lookup: {
      from: "Carsold",
      localField: "vin",
      foreignField: "vin",
      as: "soldinfo"
    }
  })

  let data = await Car.aggregate(aggArr);

  data.sort((v1, v2) => {//入库日期排序
    return new Date(v1.arrdt) - new Date(v2.arrdt);
  })

  ctx.body = { code: 200, data };
})

//添加特殊车辆促销数据
router.post("/addspecialcar", async ctx => {
  const info = ctx.request.body.data;
  await SpecialSold.deleteMany({ vin: info.vin });//清除记录

  if (info.payceller != 0 || info.paynet != 0) {//两个激励不能同时为空，否则不添加记录
    await new SpecialSold({ vin: info.vin, payceller: info.payceller, paynet: info.paynet }).save();//添加记录
  }
  ctx.body = { code: 200 };
})

//清除特殊车辆促销
router.post("/clearspecialcar", async ctx => {
  const info = ctx.request.body.data;
  await SpecialSold.deleteMany({ vin: info.vin });//清除记录
  ctx.body = { code: 200 };
})

//车辆外部调拨
router.post("/carmoveout", async ctx => {
  const info = ctx.request.body;
  //删除当前库存
  await NowStore.deleteOne({ vin: info.vin });
  //添加到调往外部车辆明细
  await new CarMoveOut({ vin: info.vin, movedt: info.movedt, posi: info.posi }).save();
  //检查是否存在该位置
  const poti_out = await OutPisi.find({ posi: info.posi });
  if (poti_out.length == 0) {//没有找到添加一个
    await new OutPisi({ posi: info.posi }).save();
  }
  //添加到外部调拨表
  //do something
  //添加历史
  await new CarHistory({ vin: info.vin, cate: "外部调拨", dt: info.movedt, msg: "调拨到 " + info.posi }).save();
  ctx.body = { code: 200 }
})

//获取车辆调拨到外部位置列表
router.post("/outposilist", async ctx => {
  const info = await OutPisi.find();

  let set = new Set();

  info.forEach(d => {
    set.add(d.posi);
  });
  ctx.body = {
    data: Array.from(set)
  }
})

//车辆调拨
router.post("/carmove", async ctx => {
  const info = ctx.request.body;
  //更新库存
  await NowStore.updateOne({ vin: info.vin }, { movedt: info.movedt, posi1: info.posi1, posi2: info.posi2 })
  //记录历史
  await new CarHistory({ vin: info.vin, cate: "内部调拨", dt: info.movedt, msg: "调拨到 " + info.posi1 + "-" + info.posi2 }).save();
  ctx.body = { code: 200 };
})

router.post("/carupdatedeco", async ctx => {
  const info = ctx.request.body;
  //为了避免有其他数据存在，先进行删除
  await Deco_order.deleteOne({ vin: info.vin });//删除车架号对应数据
  await Deco_order.deleteOne({ order_id: info.deco_order_id });//删除id对应数据

  //重新保存数据
  await new Deco_order({ vin: info.vin, order_id: info.deco_order_id }).save();//向链接表添加车架号及装饰订单号对应记录

  await Deco_order_item.deleteMany({ order_id: info.deco_order_id });//删除掉之前的ID号明细记录
  for (const d of info.data) {
    await new Deco_order_item({ order_id: info.deco_order_id, js: d.js, cb: d.cb, count: d.count, name: d.name }).save();
  }

  ctx.body = { code: 200 };
})

//这个接口同时被销售车辆的数据明细页和库存车辆的数据明细页调用，所以当库存车辆调用的时候会出现找不到装饰ID的问题，需要进行一次判断
router.post("/decoinfoincar", async ctx => {
  const record = await Deco_order.findOne({ vin: ctx.request.body.vin });
  let re = {};
  if (record) {
    const deco_id_in_carsold = (await Deco_order.findOne({ vin: ctx.request.body.vin })).order_id;
    const deco_order = await Deco_order_item.find({ order_id: deco_id_in_carsold });
    if (!deco_order) {//车辆没有装饰，但可能在销售记录中有装饰ID
      re = { code: 500, deco_order_id: deco_id_in_carsold, data: [] };
    } else {
      re = { code: 200, deco_order_id: deco_id_in_carsold, data: deco_order }
    }
  } else {//
    re = { code: 500 };
  }

  ctx.body = re;
})

const keyback = async (ctx) => {
  await KeyMove.deleteMany({ vin: ctx.request.body.vin }).catch(err => { })
}

//解除车辆对应的订单绑定
router.post("/clearlink", async ctx => {
  await CarOrderLink.deleteMany({ vin: ctx.request.body.vin }).catch(err => { })
  ctx.body = { code: 200 }
})

//车钥匙归还
router.post("/keyback", async ctx => {
  await keyback(ctx);//删除记录再重新添加
  ctx.body = { code: 200 }
})

//点款
router.post("/dopayfull", async ctx => {
  await Car.updateOne({ vin: ctx.request.body.vin }, { payall: ctx.request.body.dt }).then(re => {
    ctx.body = { code: 200 }
  })
})

//撤销点款
router.post("/cancelpay", async ctx => {
  await Car.updateOne({ vin: ctx.request.body.vin }, { payall: '' }).then(re => {
    ctx.body = { code: 200 }
  });
})

//车钥匙移动,传入值为ID
router.post("/keymove", async ctx => {
  await keyback(ctx);//删除记录再重新添加
  const celler = await Celler.findOne({ celler_id: ctx.request.body.celler_id });
  let item = ctx.request.body;
  item.celler = celler.name;
  await new KeyMove(item).save();

  ctx.body = { code: 200 }
})

//车钥匙移动，传入值为姓名
router.post("/keymove_name", async ctx => {
  await keyback(ctx);//删除记录再重新添加
  const celler = await Celler.findOne({ name: ctx.request.body.info.celler });
  let item = ctx.request.body.info;
  item.celler_id = celler.celler_id;
  await new KeyMove(item).save();

  ctx.body = { code: 200 }
})

//库存明细查询条件下的在途明细
const carinwaylist = async (agg = "") => {
  let aggArr = [];

  aggArr.push({
    $lookup: {
      from: "Cartype",
      localField: "type_id",
      foreignField: "type_id",
      as: "typeinfo"
    }
  })

  if (agg != "") {//有查询条件则附加条件
    aggArr.push(agg)
  }

  return await CarInWay.aggregate(aggArr);
}

const carcancalllist = async (agg = "") => {
  let aggArr = [];

  aggArr.push({
    $lookup: {
      from: "Cartype",
      localField: "ltype",
      foreignField: "ltype",
      as: "typeinfo"
    }
  })

  if (agg != "") {//有查询条件则附加条件
    aggArr.push(agg)
  }

  const data = await Cancall.aggregate(aggArr);
  let re = [];
  data.forEach(d => {
    for (let i = 0; i < d.nocall; i++) {
      re.push(d);
    }
  })
  return re;
}

const carwillcalllist = async (agg = "") => {
  let aggArr = [];

  aggArr.push({
    $lookup: {
      from: "Cartype",
      localField: "ltype",
      foreignField: "ltype",
      as: "typeinfo"
    }
  })

  if (agg != "") {//有查询条件则附加条件
    aggArr.push(agg)
  }

  const data = await Willcall.aggregate(aggArr);
  let re = [];
  data.forEach(d => {
    for (let i = 0; i < d.num; i++) {
      re.push(d);
    }
  })
  return re;
}

//获取整体的当前库存明细，接受一个融合对象，用于库存明细
const getFullStoreList = async (ctx_pars, agg = "", agg_inway = "", agg_cancall = "", agg_willcall = "") => {
  let aggArr = [];
  let no_carcancalllist = false, no_carwillcalllist = false, no_orders = false;//不融合可CALL和将CALL开关

  if (ctx_pars.tags.length > 0 || ctx_pars.posi1 != "" || ctx_pars.posi2 != "" || ctx_pars.vin != "") {//带有标签参数，所以不需要融合CALL车数据，提高反馈效率
    no_carcancalllist = true;
    no_carwillcalllist = true;
    no_orders = true;
  }

  //融合车辆数据
  aggArr.push({
    $lookup: {
      from: "Car",
      localField: "vin",
      foreignField: "vin",
      as: "carinfo"
    }
  });
  //融合车型数据
  aggArr.push({
    $lookup: {
      from: "Cartype",
      localField: "carinfo.type_id",
      foreignField: "type_id",
      as: "typeinfo"
    }
  });

  //融合订单绑定
  aggArr.push({
    $lookup: {
      from: "CarOrderLink",
      localField: "vin",
      foreignField: "vin",
      as: "linkinfo"
    }
  })

  //融合订单
  aggArr.push({
    $lookup: {
      from: "CarOrder",
      localField: "linkinfo.order_id",
      foreignField: "car_order_id",
      as: "orderinfo"
    }
  })

  //融合销售顾问
  aggArr.push({
    $lookup: {
      from: "Cellers",
      localField: "orderinfo.celler_id",
      foreignField: "celler_id",
      as: "cellerinfo"
    }
  })

  //融合车钥匙位置
  aggArr.push({
    $lookup: {
      from: "NowStoreKeyMove",
      localField: "vin",
      foreignField: "vin",
      as: "keyinfo"
    }
  })

  //融合特殊奖励明细
  aggArr.push({
    $lookup: {
      from: "Specialsold",
      localField: "vin",
      foreignField: "vin",
      as: "soldmeinfo"
    }
  })

  //融合加装项目
  aggArr.push({
    $lookup: {
      from: "Deco_order",
      localField: "vin",
      foreignField: "vin",
      as: "decolinkinfo"
    }
  })

  //融合加装明细
  aggArr.push({
    $lookup: {
      from: "Deco_order_item",
      localField: "decolinkinfo.order_id",
      foreignField: "order_id",
      as: "decoinfo"
    }
  })

  //如果有筛选条件就加入筛选条件
  if (agg != "") {
    aggArr.push(agg);
  }

  let data = await NowStore.aggregate(aggArr);

  const inway_data = await carinwaylist(agg_inway);
  //拼接在途
  inway_data.forEach(d => {
    data.push({
      movedt: "-",
      vin: d.vin,
      posi1: "在途",
      posi2: d.way_state,
      carinfo: [
        {
          type_id: d.type_id,
          pdt: "-",
          arrdt: "-",
          dolreport: '',
          payall: '',
          vin: d.vin,
          fdjcode: "-",
          clr: d.clr,
          source: '厂家到车',
        }
      ],
      typeinfo: d.typeinfo,
      linkinfo: [],
      orderinfo: [],
      cellerinfo: [],
      keyinfo: [],
      decolinkinfo: [],
      decoinfo: [],
      soldmeinfo: []
    })
  })

  //获取标签
  for (const d of data) {
    const tags = await require("../routes/tag").cartags_on(d.vin);
    if (tags.length == 0) {
      d.tags = [];
    } else {
      d.tags = tags.map(d => {
        d.vins = [];
        return d;
      });
    }
  }

  //筛选标签
  if (ctx_pars.tags.length > 0) {//标签筛选条件
    let data_with_tag = [];
    ctx_pars.tags.forEach(tag => {
      //      console.log(tag);
      data.forEach((car, i) => {
        if (car.tags.length > 0) {
          let car_tags = car.tags.map(d => {
            return d.tag_id
          });
          if (car_tags.includes(tag.id)) {
            data_with_tag.push(car);
          }
        }
      })
    })
    data = data_with_tag;
  }

  if (!no_carcancalllist) {
    const cancall_data = await carcancalllist(agg_cancall);
    //拼接可CALL车
    cancall_data.forEach(d => {
      data.push({
        movedt: "-",
        vin: "目前可CALL",
        posi1: "",
        posi2: "",
        carinfo: [
          {
            type_id: d.typeinfo[0].type_id,
            pdt: "-",
            arrdt: "-",
            dolreport: '',
            payall: '',
            vin: "可CALL",
            fdjcode: "-",
            clr: d.clr,
            source: '厂家到车',
          }
        ],
        typeinfo: d.typeinfo,
        linkinfo: [],
        orderinfo: [],
        cellerinfo: [],
        keyinfo: [],
        decolinkinfo: [],
        decoinfo: [],
        soldmeinfo: [],
        tags: []
      })
    })
  }

  //拼接下周将CALL
  if (!no_carwillcalllist) {
    const willcall_data = await carwillcalllist(agg_willcall);

    willcall_data.forEach(d => {
      data.push({
        movedt: "-",
        vin: "下周可CALL",
        posi1: "",
        posi2: "",
        carinfo: [
          {
            type_id: d.typeinfo[0].type_id,
            pdt: "-",
            arrdt: "-",
            dolreport: '',
            payall: '',
            vin: "下周可CALL",
            fdjcode: "-",
            clr: d.clr,
            source: '厂家到车',
          }
        ],
        typeinfo: d.typeinfo,
        linkinfo: [],
        orderinfo: [],
        cellerinfo: [],
        keyinfo: [],
        decolinkinfo: [],
        decoinfo: [],
        soldmeinfo: [],
        tags: []
      })
    })
  }

  //判断是否有绑定订单，并添加绑定订单的信息
  data.forEach(d => {
    if (d.orderinfo.length > 0) {
      switch (d.orderinfo[0].order_type) {
        case 0:
          d.linkorderinfo = "【车辆绑定】" + utils.shortdate(d.orderinfo[0].odt) + " 展厅 " + d.cellerinfo[0].name + "：" + d.orderinfo[0].name;
          break;
        case 1:
          d.linkorderinfo = "【车辆绑定】" + utils.shortdate(d.orderinfo[0].odt) + " 网点 " + d.cellerinfo[0].name + "：" + d.orderinfo[0].tips;
          break;
      }
    } else {
      d.linkorderinfo = '';
    }

    //判断是否有钥匙记录
    if (d.keyinfo.length > 0) {
      d.key_posi = d.keyinfo[0].celler;
    } else {
      d.key_posi = "";
    }
  })

  if (!no_orders) {
    //取出所有绑定订单 由于条件是判断之后传入的导致这里对于订单没有使用条件判断，因此一定程度上会造成额外的负荷
    const link_orders = await CarOrderLink.find().catch(err => { });

    //生成绑定订单的ID数组，用来在之后的订单筛选中排除掉
    let link_ids = [];
    link_orders.forEach(d => {
      return link_ids.push(d.order_id);
    })

    //取出所有未绑定的订单
    let aggArr_orders = [];
    //融合销售顾问
    aggArr_orders.push({
      $lookup: {
        from: "Cellers",
        localField: "celler_id",
        foreignField: "celler_id",
        as: "cellerinfo"
      }
    })
    //融合车型
    aggArr_orders.push({
      $lookup: {
        from: "Cartype",
        localField: "type_id",
        foreignField: "type_id",
        as: "typeinfo"
      }
    })

    let order_match = [{ car_order_id: { $nin: link_ids } }, { state: "有效订单" }];

    if (ctx_pars.stype != '') {
      order_match.push({ "typeinfo.stype": ctx_pars.stype })
    }

    if (ctx_pars.price != '') {
      order_match.push({ "typeinfo.price": ctx_pars.price })
    }

    if (ctx_pars.ltype != '') {
      order_match.push({ "typeinfo.ltype": ctx_pars.ltype })
    }

    aggArr_orders.push({
      $match: { $and: order_match }
    })

    const orders = await CarOrder.aggregate(aggArr_orders);

    data.forEach(d => {
      if (d.linkinfo.length == 0) {//无订单绑定的车辆
        //判断车型跟颜色是否和订单相同，如果相同就把订单放到这个对象参数下
        for (const order of orders) {
          if (d.carinfo[0].type_id == order.type_id && d.carinfo[0].clr == order.clr) {
            switch (order.order_type) {
              case 0:
                d.linkorderinfo = utils.shortdate(order.odt) + " 展厅 " + order.cellerinfo[0].name + "：" + order.name;
                break;
              case 1:
                d.linkorderinfo = utils.shortdate(order.odt) + " 网点 " + order.cellerinfo[0].name + "：" + order.tips;
                break;
            }
            order.type_id = 0;
            break;
          }
        }
      }
    })

    orders.forEach(d => {
      if (d.type_id != 0) {//type_id只是一个标记，已经匹配过的订单对象会标记为0
        const nofit_order = {
          movedt: '-',
          vin: '无资源',
          posi1: "",
          posi2: "",
          carinfo: [{
            payall: "",
            dolreport: "",
            pdt: "-",
            arrdt: "-",
            clr: d.clr,
          }],
          typeinfo: [{
            type_id: d.typeinfo[0].type_id,
            stype: d.typeinfo[0].stype,
            ltype: d.typeinfo[0].ltype,
            price: d.typeinfo[0].price,
          }],
          linkinfo: [],
          orderinfo: [],
          linkorderinfo: "【无资源】" + utils.longdate(d.odt) + " " + d.name + " " + d.cellerinfo[0].name,
          keyinfo: [],
          decolinkinfo: [],
          decoinfo: [],
          soldmeinfo: [],
          tags: []
        };
        data.push(nofit_order)
      }
    })

  }

  //对车型配置进行一个排序
  let final = data.sort((a, b) => {
    return a.typeinfo[0].type_id - b.typeinfo[0].type_id
  })

  return final;
};


//获取整体的当前库存明细，接受一个融合对象，用于一般统计
const getStoreList = async (agg = "") => {
  let aggArr = [];
  //融合车辆数据
  aggArr.push({
    $lookup: {
      from: "Car",
      localField: "vin",
      foreignField: "vin",
      as: "carinfo"
    }
  });
  //融合车型数据
  aggArr.push({
    $lookup: {
      from: "Cartype",
      localField: "carinfo.type_id",
      foreignField: "type_id",
      as: "typeinfo"
    }
  });

  //融合订单绑定
  aggArr.push({
    $lookup: {
      from: "CarOrderLink",
      localField: "vin",
      foreignField: "vin",
      as: "linkinfo"
    }
  })

  //融合订单
  aggArr.push({
    $lookup: {
      from: "CarOrder",
      localField: "linkinfo.order_id",
      foreignField: "car_order_id",
      as: "orderinfo"
    }
  })

  //融合销售顾问
  aggArr.push({
    $lookup: {
      from: "Cellers",
      localField: "orderinfo.celler_id",
      foreignField: "celler_id",
      as: "cellerinfo"
    }
  })

  //如果有筛选条件就加入筛选条件
  if (agg != "") {
    aggArr.push(agg);
  }

  const data = await NowStore.aggregate(aggArr);
  return data;
};

//生成在库查询条件
const create_store_andVal = async (obj) => {
  let andVal = [];
  if (obj.tags.length > 0) {//带有标签参数则先筛选出标签对应的车架号集合，在对象中进行一次筛选
    const cars_with_tag = await require("../routes/tag").all_car_has_tag(obj.tags);
    andVal.push({ vin: { $in: cars_with_tag } });
  }

  if (obj.vin != '') {
    andVal.push({ vin: { $regex: `${obj.vin}$` } })
  }

  if (obj.posi1 != "") {
    andVal.push({ posi1: obj.posi1 });
  }

  if (obj.posi2 != "") {
    andVal.push({ posi2: obj.posi2 });
  }

  if (obj.stype != "") {
    andVal.push({ "typeinfo.stype": obj.stype });
  }

  if (obj.ltype != "") {
    andVal.push({ "typeinfo.ltype": obj.ltype });
  }

  if (obj.price != "") {
    andVal.push({ "typeinfo.price": obj.price });
  }

  if (obj.clr != "") {
    andVal.push({ "carinfo.clr": obj.clr });
  }

  if (andVal.length > 0) {
    return { $match: { $and: andVal } }
  } else {
    return "";
  }
}

// 生成在途查询条件
const create_inway_andVal = (obj) => {
  let andVal = [];
  if (obj.vin != '') {
    andVal.push({ vin: { $regex: `${obj.vin}$` } })
  }

  if (obj.stype != "") {
    andVal.push({ "typeinfo.stype": obj.stype });
  }

  if (obj.ltype != "") {
    andVal.push({ "typeinfo.ltype": obj.ltype });
  }

  if (obj.price != "") {
    andVal.push({ "typeinfo.price": obj.price });
  }

  if (obj.clr != "") {
    andVal.push({ clr: obj.clr });
  }

  if (obj.posi1 != "" || obj.posi2 != "") {//带有位置条件的话，就直接设置永假条件
    andVal = [{ vin: "" }];
  }

  if (andVal.length > 0) {
    return { $match: { $and: andVal } }
  } else {
    return "";
  }
}

//生成可call车查询条件
const create_cancall_andVal = (obj) => {
  let andVal = [];

  if (obj.stype != "") {
    andVal.push({ "typeinfo.stype": obj.stype })
  }

  if (obj.ltype != "") {
    andVal.push({ "typeinfo.ltype": obj.ltype });
  }

  if (obj.clr != "") {
    andVal.push({ clr: obj.clr });
  }

  if (obj.price != "") {
    andVal.push({ "typeinfo.price": obj.price });
  }

  if (obj.vin != '' || obj.posi1 != "" || obj.posi2 != "" || obj.tags.length > 0) {//如果带有车架号条件则直接用不可能存在的方式来查询CALL车，因为CAL车没有车架号
    andVal = [{ _id: 0 }]
  }

  if (andVal.length > 0) {
    return { $match: { $and: andVal } }
  } else {
    return "";
  }
}

//生成将call车查询条件
const create_willCall_anVal = (obj) => {
  let andVal = [];

  if (obj.stype != "") {
    andVal.push({ "typeinfo.stype": obj.stype })
  }

  if (obj.ltype != "") {
    andVal.push({ "typeinfo.ltype": obj.ltype });
  }

  if (obj.price != "") {
    andVal.push({ "typeinfo.price": obj.price });
  }

  if (obj.clr != "") {
    andVal.push({ clr: obj.clr });
  }

  if (obj.vin != '' || obj.posi1 != "" || obj.posi2 != "" || obj.tags.length > 0) {//如果带有车架号条件则直接用不可能存在的方式来查询CALL车，因为CAL车没有车架号
    andVal = [{ _id: 0 }]
  }

  if (andVal.length > 0) {
    return { $match: { $and: andVal } }
  } else {
    return "";
  }
}

//库存明细
router.post("/list", async ctx => {
  const obj = ctx.request.body;
  let match_store = "", match_inway = "", match_cancall = "", match_willcall = "";

  if (await create_store_andVal(obj) != null) {
    match_store = await create_store_andVal(obj)
  }

  if (create_inway_andVal(obj) != null) {
    match_inway = create_inway_andVal(obj)
  }

  if (create_cancall_andVal(obj) != null) {
    match_cancall = create_cancall_andVal(obj)
  }

  if (create_willCall_anVal(obj) != null) {
    match_willcall = create_willCall_anVal(obj)
  }

  let re = await getFullStoreList(obj, match_store, match_inway, match_cancall, match_willcall);

  if (re.length > 0) {
    ctx.body = { data: re };
  } else {
    ctx.body = { code: 401 };
  }
});

//获取大类位置
router.post("/pm1list", async ctx => {
  const data = await getStoreList();
  let set = new Set();

  data.forEach(d => {
    set.add(d.posi1);
  });

  ctx.body = { data: Array.from(set) };
});

//获取详细位置
router.post("/pm2list", async ctx => {
  const data = await getStoreList();
  let set = new Set();

  data.forEach(d => {
    if (d.posi1 == ctx.request.body.posi1) {
      set.add(d.posi2);
    }
  });

  ctx.body = { data: Array.from(set) };
});

//这里要融合在库，在库，可CALL，将CALL的车型
router.post("/stypelist", async ctx => {
  const data = await getStoreList();
  let set = new Set();

  data.forEach(d => {
    set.add(d.typeinfo[0].stype);
  });

  const data_cancall = await CallCar_cancall.aggregate([{
    $lookup: {
      from: "Cartype",
      localField: "ltype",
      foreignField: "ltype",
      as: "typeinfo"
    }
  }]);

  data_cancall.forEach(d => {
    set.add(d.typeinfo[0].stype)
  })

  ctx.body = { data: Array.from(set) };
});

//获取详细车型
router.post("/ltypelist", async ctx => {
  const data = await getStoreList();
  let set = new Set();

  //带有价格参数
  if (ctx.request.body.price > 0) {
    data.forEach(d => {
      if (
        d.typeinfo[0].stype == ctx.request.body.stype &&
        d.typeinfo[0].price == ctx.request.body.price
      ) {
        set.add(d.typeinfo[0].ltype);
      }
    });
  } else {
    data.forEach(d => {
      if (d.typeinfo[0].stype == ctx.request.body.stype) {
        set.add(d.typeinfo[0].ltype);
      }
    });
  }

  ctx.body = { data: Array.from(set) };
});

//包含了在途，在库，可CALL，将CALL的所有价格
router.post("/pricealllist", async ctx => {
  const stype = ctx.request.body.stype;
  //获取所有的车型，然后在cattype表中匹配到价格
  let price_set = new Set();
  let nowstore = await NowStore.aggregate([
    {
      $lookup: {
        from: "Car",
        localField: "vin",
        foreignField: "vin",
        as: "carinfo"
      }
    }, {
      $lookup: {
        from: "Cartype",
        localField: "carinfo.type_id",
        foreignField: "type_id",
        as: "typeinfo"
      }
    }
  ]);

  nowstore.forEach(d => {
    if (d.typeinfo[0].stype == stype) {
      price_set.add(d.typeinfo[0].price);
    }
  })

  let inway = await CarInWay.aggregate([
    {
      $lookup: {
        from: "Cartype",
        localField: "type_id",
        foreignField: "type_id",
        as: "typeinfo"
      }
    }
  ]);

  inway.forEach(d => {
    if (d.typeinfo[0].stype == stype) {
      price_set.add(d.typeinfo[0].price);
    }
  })


  let cancall = await CallCar_cancall.aggregate([
    {
      $lookup: {
        from: "Cartype",
        localField: "ltype",
        foreignField: "ltype",
        as: "typeinfo"
      }
    }
  ]);

  cancall.forEach(d => {
    if (d.typeinfo[0].stype == stype) {
      price_set.add(d.typeinfo[0].price);
    }
  })

  let willcall = await CallCar_willcall.aggregate([
    {
      $lookup: {
        from: "Cartype",
        localField: "ltype",
        foreignField: "ltype",
        as: "typeinfo"
      }
    }
  ]);

  willcall.forEach(d => {
    if (d.typeinfo[0].stype == stype) {
      price_set.add(d.typeinfo[0].price);
    }
  })

  ctx.body = { data: Array.from(price_set) };
})

//获取价格
router.post("/pricelist", async ctx => {
  const data = await getStoreList();
  ctx.body = data;
  let set = new Set();

  data.forEach(d => {
    if (d.typeinfo[0].stype == ctx.request.body.stype) {
      set.add(d.typeinfo[0].price);
    }
  });

  ctx.body = { data: Array.from(set) };
});

//获取颜色
router.post("/clrlist", async ctx => {
  const data = await getStoreList();
  ctx.body = data;
  let set = new Set();

  data.forEach(d => {
    if (d.typeinfo[0].stype == ctx.request.body.stype) {
      set.add(d.carinfo[0].clr);
    }
  });

  ctx.body = { data: Array.from(set) };
});

//导入库存同时更新总车辆数据，但并不包括点款跟上报DOSS日期，这两个项目会单独整理数据表同步
router.get("/import", async ctx => {
  await NowStore.deleteMany({}).catch(err => { });
  //由于nowstore  跟  carsold是互斥的，而我在更新nowstore的时候不一定刚好是carsold的取反，一旦两者重复就会引发故障

  const info = await csv.reader("csv/stores.csv");
  let type_map = new Map();
  let laststamp = 0;

  for (const d of info) {
    let timestamp = Date.now();
    let type_id = timestamp;

    while (laststamp == timestamp) {
      //避免速度太快生成重复的时间戳
      timestamp = Date.now();
    }
    laststamp = timestamp;

    const type = await CarType.find({ ltype: d["配置"] }).catch(err => { });

    if (type.length > 0) {
      //车型不存在且没有在map中,车型存在
      type_map.set(type[0].ltype, type[0].type_id);
    } else {
      await new CarType({
        type_id: type_id,
        stype: d["车型"],
        ltype: d["配置"],
        typecode_pri: d["公司代码"],
        typecode_pub: d["厂家代码"],
        price: d["价格"]
      })
        .save()
        .catch(err => { });
      type_map.set(d["配置"], type_id);
    }

    //车型map整理完毕

    //插入车辆数据
    await new Car({
      pdt: d["出厂日期"],
      arrdt: d["入库日期"],
      vin: d["车架号"],
      type_id: type_map.get(d["配置"]),
      fdjcode: d["发动机号"],
      clr: d["颜色"],
      source: d["来源"]
    })
      .save()
      .catch(err => { });

    //插入当前库存
    await new NowStore({
      vin: d["车架号"],
      posi1: d["位置"],
      posi2: d["详细位置"],
      movedt: d["调拨日期"]
    })
      .save()
      .catch(err => { });

    //添加到总车辆明细，这里直接添加，重复会跳过，由于这表是由销售跟库存两部分组成的，因此不可以清空重建
    //    await new Car({ pdt: d["出厂日期"], arrdt: d["入库日期"],vin:d['车架号'],fdjcode:d['发动机号'],clr:d['颜色'], });
  }

  ctx.body = { msg: "done" };
});

module.exports = router;
