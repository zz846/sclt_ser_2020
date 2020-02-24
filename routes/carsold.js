const Router = require("koa-router");
const router = new Router();
const Carsold = require("../mongo/schema/carsold");
const Cartype = require("../mongo/schema/cartype");
const Carorder = require("../mongo/schema/carorder")
const Celler = require("../mongo/schema/celler");
const csv = require("../utils/csv");
const Decoorder = require("../mongo/schema/deco_orders");
const deco_order_item = require("../mongo/schema/deco_orders_items");
const utils = require("../utils/utils");
const NowStore = require("../mongo/schema/carstore/nowstore");
const Car = require("../mongo/schema/car");
const OrderLink = require("../mongo/schema/orderlink");

const carsoldinfobyvin = async (vin) => {
  let aggArr = [];

  aggArr.push({
    $match: { vin: vin }
  })

  aggArr.push({
    $lookup: {
      from: "Cellers",
      localField: "celler_id",
      foreignField: "celler_id",
      as: "cellerinfo"
    }
  })

  return await Carsold.aggregate(aggArr);
}

//销售交车
//并不是转移装饰ID，因为在提交销售的时候装饰项目可能变动，跟记录可能不同，所以会新建一个项目组，然后删除掉老的项目
router.post("/dosold", async ctx => {
  const info = ctx.request.body.info;
  const deco_order_id = Date.now();

  let carsoldinfo = info.carsold;
  carsoldinfo.order_id = deco_order_id;

  if (await Carsold.findOne({ vin: carsoldinfo.vin })) {
    ctx.body = { code: 500 };
    return;
  }

  await new Carsold(carsoldinfo).save();//保存销售记录，此时的装饰还没有添加，只是分配了一个ID

  await Decoorder.deleteMany({ order_id: info.deco_order_id });//删除之前的装饰明细
  await deco_order_item.deleteMany({ order_id: info.deco_order_id });//删除之前的装饰链接
  await deco_order_item.deleteMany({ vin: info.carsold.vin });//删除之前的车架号链接

  //取得最新的装饰项目，插入到链接表和明细表
  await new Decoorder({ vin: info.carsold.vin, order_id: deco_order_id }).save();//链接表

  for (const d of info.decos) {
    d.order_id = deco_order_id;
    await new deco_order_item({ cb: d.cb, js: d.js, count: d.count, order_id: d.order_id, name: d.name }).save();//明细表
  }

  //删除订单绑定，订单,库存
  await OrderLink.deleteOne({ order_id: info.car_order_id });
  await OrderLink.deleteOne({ vin: info.carsold.vin });
  await Carorder.deleteOne({ car_order_id: info.car_order_id });
  await NowStore.deleteOne({ vin: info.carsold.vin });

  ctx.body = { code: 200 };
})

//销售退回
router.post("/dosoldback", async ctx => {
  const info = ctx.request.body.info;

  let sold_info = await Carsold.aggregate([
    {
      $match: {
        vin: info.vin
      }
    },
    {//融合车辆参数
      $lookup: {
        from: "Car",
        localField: "vin",
        foreignField: "vin",
        as: "carinfo"
      }
    }, {
      $lookup: {//融合装饰链表
        from: "Deco_order",
        localField: "vin",
        foreignField: "vin",
        as: "decoorderinfo"
      }
    }
  ]);
  sold_info = sold_info[0];
  await new NowStore({ movedt: Date.now(), vin: info.vin, posi1: info.posi1, posi2: info.posi2 }).save();//重建库存记录

  await new Carorder({
    car_order_id: Date.now(),
    opay: 0,
    carpay: sold_info.price_car,
    "deco_order_id": sold_info.decoorderinfo[0].order_id,//这个装饰组ID转移给订单，本来是在想转移给车辆的，但是你想想，装饰都做完了还退车，这种几率有多小
    "clr": sold_info.carinfo[0].clr,
    "name": sold_info.customer + "[退回]",
    "idcode": sold_info.idcode,
    "tel": sold_info.tel,
    "address": sold_info.address,
    "odt": sold_info.orderdt,
    "payway1": sold_info.payway_1,
    "payway2": sold_info.payway_2,
    "zspay": sold_info.price_deco,
    "ajpay": sold_info.price_anjie,
    "cate": sold_info.cate,
    "celler_id": sold_info.celler_id,
    "state": "有效订单",
    "type_id": sold_info.carinfo[0].type_id,
  }).save()//重建订单

  await Decoorder.deleteOne({ vin: sold_info.vin });//删除车辆订单装饰链接
  await Carsold.deleteOne({ vin: sold_info.vin });//删除销售记录

  ctx.body = { code: 200 };
})

//更新销售单车数据
router.post("/carsoldupdate", async ctx => {
  const info = ctx.request.body.info;
  await Carsold.updateOne({ vin: info.vin }, info);

  ctx.body = { code: 200 }
})

//单台销售明细数据
router.post("/carsoldinfo", async ctx => {
  const re = await carsoldinfobyvin(ctx.request.body.vin);

  if (re.length > 0) {
    ctx.body = { code: 200, data: re };
  } else {
    ctx.body = { code: 500 }
  }

})

//撤销指定表中的车架号车辆销售数据
router.get("/sync_cancel", async ctx => {
  const input = await csv.reader("销售_撤销.csv");

  for (const d of input) {
    await Carsold.deleteOne({ vin: d["车架号"] }, (err, doc) => { });
    await Car.deleteOne({ vin: d["车架号"] }, (err, doc) => { });
    const deco_orders = await Decoorder.find({
      vin: d["车架号"]
    }).catch(err => { });
    for (const d of deco_orders) {
      await Decoorder.deleteOne({ _id: d._id }, (err, doc) => { });
    }
  }

  ctx.body = { code: 200 };
});

//从旧系统同步数据，以后都要养成逻辑分开的习惯，有些逻辑可以被公用的，不要写在一起，写多了拆分起来麻烦
router.get("/sync", async ctx => {
  const input = await csv.reader("csv/销售_增补.csv");
  let laststamp = 0;
  let celler_map = new Map(); //检测销售人员重复
  let type_map = new Map(); //检测车型重复

  //在遍历中要使用await的话不可以使用map，只能用 for of
  for (const d of input) {
    let timestamp = Date.now(); //预备ID，当车型或者销售人员不存在的时候可能需要添加记录
    let type_id = timestamp,
      celler_id = timestamp;

    while (laststamp == timestamp) {
      //避免速度太快生成重复的时间戳
      timestamp = Date.now();
    }
    laststamp = timestamp;

    const cellerInfo = await Celler.find({
      name: d["销售顾问"]
    }).catch(err => { }); //查找销售顾问是否数据库中已存在

    if (cellerInfo.length == 0 && !celler_map.has(d["销售顾问"])) {
      //不存在数据库，也不在set，则添加到数据库然后添加到set
      await new Celler({
        celler_id: celler_id,
        name: d["销售顾问"],
        cate: d["销售划分"]
      })
        .save()
        .catch(err => { });
      celler_map.set(d["销售顾问"], celler_id);
    } else {
      celler_map.set(d["销售顾问"], cellerInfo[0].celler_id);
    }

    //查找车型是否在数据库中
    const typeinfo = await Cartype.find({
      ltype: d["车辆配置"]
    }).catch(err => { });

    if (typeinfo.length == 0 && !type_map.has(d["车辆配置"])) {
      //不存在数据库，也不在set，则添加到数据库然后添加到set
      await new Cartype({
        type_id: timestamp,
        stype: d["车型"],
        ltype: d["车辆配置"],
        typecode_pri: d["公司代码"],
        typecode_pub: d["厂家代码"],
        price: d["市场报价"]
      })
        .save()
        .catch(err => { });
      type_map.set(d["车辆配置"], timestamp);
    } else {
      type_map.set(d["车辆配置"], typeinfo[0].type_id);
    }

    //这个时候使用可控的ID值好处就完全显现出来了，自己生成然后保存到数据库，而不是添加到数据库之后再来反取值查询出ID

    //检测销售是否存在
    const carsold = await Carsold.find({ vin: d["车架号"] }).catch(err => { });

    if (carsold.length == 0) {
      //销售记录不存在，则添加

      if (d["赠送装饰"].length != 0) {
        //如果带有装饰项目，则添加一个deco_order
        const decoorder_fmt = { vin: d["车架号"], order_id: timestamp };
        await new Decoorder(decoorder_fmt).save().catch(err => { }); //添加一个装饰订单
        let arr = d["赠送装饰"].split("^");
        arr.splice(arr.length - 1, 1); //去掉多余的分隔符

        for (let deinfo of arr) {
          await new deco_order_item({
            order_id: timestamp,
            name: deinfo.split(":")[0],
            js: deinfo.split(":")[3],
            count: deinfo.split(":")[1]
          })
            .save()
            .catch(err => { });
        }
      }

      const sold_obj = {
        vin: d["车架号"],
        type_id: type_map.get(d["车辆配置"]),
        cate: d["销售划分"],
        celler_id: celler_map.get(d["销售顾问"]),
        solddt: d["购车日期"],
        orderdt: d["订车日期"],
        customer: d["客户姓名"],
        tel: d["电话"],
        idcode: d["身份证号"],
        address: d["客户地址"],
        price_car: d["购买价格"],
        price_deco: d["装饰款"],
        price_anjie: d["按揭手续费"],
        order_id: timestamp,
        payway_1: d["支付方式"],
        payway_2: d["支付方式关联"]
      };
      await new Carsold(sold_obj).save().catch(err => { });

      //插入车辆
      await new Car({
        vin: d["车架号"],
        type_id: type_map.get(d["车辆配置"]),
        fdjcode: d["发动机号"],
        clr: d["车辆颜色"],
        pdt: d["生产日期"],
        source: d["车辆来源"]
      })
        .save()
        .catch(err => { });
    }
  }
  ctx.body = { code: 200, mgs: "done" };
});

//销售明细
router.post("/soldlist", async ctx => {
  ctx.body = await getCarSoldByKeys(ctx.request.body.info);
});

const getCarSoldByKeys = data => {
  return new Promise((res, rej) => {
    const dt1 = new Date(utils.shortdate(data.dt1) + " 00:00");
    const dt2 = new Date(utils.shortdate(data.dt2) + " 23:59");

    let aggArr = [];

    //限定销售日期，这个参数是必有的，所以不需要判断
    let matchAndArr = [];

    matchAndArr.push({ solddt: { $lte: dt2 } });
    matchAndArr.push({ solddt: { $gte: dt1 } });

    //筛选销售分区
    if (data.cate != "") {
      matchAndArr.push({ cate: data.cate });
    }

    //筛选车架号
    if (data.vin != "") {
      matchAndArr.push({ vin: { $regex: `${data.vin}$` } });
    }

    //筛选销售顾问
    if (data.celler_id != "") {
      matchAndArr.push({ celler_id: data.celler_id });
    }

    //筛选客户姓名
    if (data.customer != "") {
      matchAndArr.push({ customer: { $regex: data.customer } });
    }

    //筛选车架号
    if (data.tel != "") {
      matchAndArr.push({ tel: { $regex: data.tel } });
    }

    //支付方式
    if (data.payway1 != "") {
      matchAndArr.push({ payway_1: data.payway1 });
    }

    //支付方式详细
    if (data.payway2 != "") {
      matchAndArr.push({ payway_2: data.payway2 });
    }

    //所有在销售表中可以筛选的内容处理完成
    aggArr.push({
      $match: {
        $and: matchAndArr
      }
    });

    //其他需要融合表之后再筛选的内容放在这里

    //融合车辆信息
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

    //融合销售顾问
    aggArr.push({
      $lookup: {
        from: "Cellers",
        localField: "celler_id",
        foreignField: "celler_id",
        as: "cellerinfo"
      }
    });

    //融合装饰订单
    aggArr.push({
      $lookup: {
        from: "Deco_order",
        localField: "order_id",
        foreignField: "order_id",
        as: "decoOrder"
      }
    });

    //融合装饰明细
    aggArr.push({
      $lookup: {
        from: "Deco_order_item",
        localField: "decoOrder.order_id",
        foreignField: "order_id",
        as: "decos"
      }
    });

    const matchAndArrAfterAgg = [];

    //筛选主车型
    if (data.stype != "") {
      matchAndArrAfterAgg.push({ "typeinfo.stype": data.stype });
    }

    //筛选详细车型
    if (data.ltype != "") {
      matchAndArrAfterAgg.push({ "typeinfo.ltype": data.ltype });
    }

    //筛选颜色
    if (data.clr != "") {
      matchAndArrAfterAgg.push({ "carinfo.clr": data.clr });
    }

    //筛选价格
    if (data.price != "") {
      matchAndArrAfterAgg.push({ "typeinfo.price": data.price });
    }

    //如果条件参数不为空，则添加到主融合
    if (matchAndArrAfterAgg.length > 0) {
      aggArr.push({ $match: { $and: matchAndArrAfterAgg } });
    }

    Carsold.aggregate(aggArr)
      .then(doc => {
        if (doc.length == 0) {
          res({ code: 401, data: doc });
        } else {
          doc.forEach(d => {
            d.solddt = require("../utils/utils").longdate(d.solddt);
            d.orderdt = require("../utils/utils").longdate(d.orderdt);
            d.carinfo[0].pdt = require("../utils/utils").longdate(d.carinfo[0].pdt);
            d.carinfo[0].arrdt = require("../utils/utils").longdate(d.carinfo[0].arrdt);
          });
          res({ code: 200, data: doc });
        }
      })
      .catch(err => {
        rej(err);
      });
  });
};

/*
由于这个系统采用的列表方式跟以前的不同，并没有让用户自己去启用和禁用一些数据来避免过时冗余数据的增长
所以采用了新的方式是在最近的数据中计算产生过的车型，分区，颜色，等等数据，这样可以保证显示的明细始终是发生过的，同时又不需要用户自己手动去关闭那些过期的参数
getcarsold是用来产生一个基础销售数据，然后返回到不同的类来处理加工出需要的值
*/
const getCarSold = () => {
  return new Promise((res, rej) => {
    const month_range = 2; //通过两个月内的销售明细来计算，通过这个参数控制数据的范围
    const todate = new Date().setMonth(new Date().getMonth() - month_range); //设定时间
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

    //融合销售顾问
    aggArr.push({
      $lookup: {
        from: "Cellers",
        localField: "celler_id",
        foreignField: "celler_id",
        as: "cellerinfo"
      }
    });

    //融合车辆参数
    aggArr.push({
      $lookup: {
        from: "Car",
        localField: "vin",
        foreignField: "vin",
        as: "carinfo"
      }
    });

    //融合车型
    aggArr.push({
      $lookup: {
        from: "Cartype",
        localField: "carinfo.type_id",
        foreignField: "type_id",
        as: "typeinfo"
      }
    });

    Carsold.aggregate(aggArr)
      .then(doc => {
        res(doc);
      })
      .catch(err => {
        rej(err);
      });
  });
};

const payway1List = data => {
  let set = new Set();
  data.forEach(d => {
    set.add(d.payway_1);
  });

  return Array.from(set);
};

const payway2List = (data, payway1) => {
  let set = new Set();
  data.forEach(d => {
    if (d.payway_1 == payway1) {
      set.add(d.payway_2);
    }
  });
  return Array.from(set);
};

//计算cate列表
const cateList = data => {
  let set = new Set();
  data.forEach(d => {
    set.add(d.cate);
  });

  return Array.from(set);
};

//计算主车型
const mtypeList = data => {
  let set = new Set();
  data.forEach(d => {
    set.add(d.typeinfo[0].stype);
  });

  return Array.from(set);
};

//计算详细车型，需要提供主车型
const ltypeList = (data, stype) => {
  let set = new Set();
  data.forEach(d => {
    if (d.typeinfo[0].stype == stype) {
      set.add(d.typeinfo[0].ltype);
    }
  });

  return Array.from(set);
};

const priceList = (data, stype) => {
  let set = new Set();
  data.forEach(d => {
    if (d.typeinfo[0].stype == stype) {
      set.add(d.typeinfo[0].price);
    }
  });
  return Array.from(set);
};

const clrList = (data, stype) => {
  let set = new Set();
  data.forEach(d => {
    if (d.typeinfo[0].stype == stype) {
      set.add(d.carinfo[0].clr);
    }
  });
  return Array.from(set);
};

router.post("/carsoldpayway1list", async ctx => {
  ctx.body = { data: payway1List(await getCarSold()) };
});

router.post("/carsoldpayway2list/:payway1", async ctx => {
  ctx.body = { data: payway2List(await getCarSold(), ctx.params.payway1) };
});

//销售车辆_分区
router.post("/carsoldcatelist", async ctx => {
  ctx.body = { data: cateList(await getCarSold()) };
});

//销售车辆_主车型
router.post("/carsoldmtypelist", async ctx => {
  ctx.body = { data: mtypeList(await getCarSold()) };
});

//销售车辆_明细车型
router.post("/carsoldltypelist", async ctx => {
  const info = ctx.request.body.info;
  const data = await getCarSold();

  let set = new Set();

  data.forEach(d => {
    if (d.typeinfo[0].stype == info.stype && (info.price != "" ? d.typeinfo[0].price == info.price : true)) {
      set.add(d.typeinfo[0].ltype)
    }
  })
  ctx.body = { data: Array.from(set) };
});

router.post("/carsoldpricelist/:stype", async ctx => {
  ctx.body = { data: priceList(await getCarSold(), ctx.params.stype) };
});

router.post("/carsoldclrlist/:stype", async ctx => {
  ctx.body = { data: clrList(await getCarSold(), ctx.params.stype) };
});

module.exports = router;
