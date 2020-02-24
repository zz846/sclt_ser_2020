const Router = require("koa-router");
const router = new Router();
const csv = require("../utils/csv");
const Cartype = require("../mongo/schema/cartype");
const Celler = require("../mongo/schema/celler");
const Car = require("../mongo/schema/car");
const Carsold = require("../mongo/schema/carsold");
const Decoorder = require("../mongo/schema/deco_orders");
const deco_order_item = require("../mongo/schema/deco_orders_items");
const typeclass2inside = require("../mongo/schema/salary/class2inside");

//刷新所有车辆的DOSS上报日期跟点款日期
router.get("/update_doss_payall", async ctx => {
  //do something
});

router.get("/querycar/:vin", async (ctx, next) => {
  let data = await Carsold.aggregate([
    {
      $match: {
        vin: ctx.params.vin
      }
    },
    {
      $lookup: {
        //拼接装饰明细
        from: "Cellers",
        localField: "celler_id",
        foreignField: "celler_id",
        as: "cellerinfo"
      }
    },
    {
      $lookup: {
        //拼接装饰明细
        from: "Deco_order_item",
        localField: "order_id",
        foreignField: "order_id",
        as: "deco_order_item"
      }
    },
    {
      $lookup: {
        //拼接车辆参数
        from: "Car",
        localField: "vin",
        foreignField: "vin",
        as: "carinfo"
      }
    },
    {
      $lookup: {
        //拼接车型参数
        from: "Cartype",
        localField: "carinfo.type_id",
        foreignField: "type_id",
        as: "cartypeinfo"
      }
    }
  ]);

  ctx.body = data;
  await next();
});

//导入销售
router.get("/input_sold", async ctx => {
  let pms_arr = [];
  pms_arr.push(Car.deleteMany({}));
  pms_arr.push(Cartype.deleteMany({}));
  pms_arr.push(Carsold.deleteMany({}));
  pms_arr.push(Celler.deleteMany({}));
  pms_arr.push(deco_order_item.deleteMany({}));
  pms_arr.push(Decoorder.deleteMany({}));
  pms_arr.push(typeclass2inside.deleteMany({}));

  await Promise.all(pms_arr).then(re => {
    console.log("db clear");
  });

  let cartype_ltype_set = new Map();
  let celler_name_set = new Map();
  let car_vin_set = new Set();
  let carsold_vin_set = new Set();

  const csv_data = await csv.reader("all_sold.csv");
  let laststamp = 0;

  for (const d of csv_data) {
    await new Promise(async (res, rej) => {
      let timestamp = Date.now();
      let type_id = timestamp,
        celler_id = timestamp;

      while (laststamp == timestamp) {
        //避免速度太快生成重复的时间戳
        timestamp = Date.now();
      }
      laststamp = timestamp;

      //插入车型
      if (!cartype_ltype_set.has(d["车辆配置"])) {
        await new Cartype({
          type_id: timestamp,
          stype: d["车型"],
          ltype: d["车辆配置"],
          typecode_pri: d["公司代码"],
          typecode_pub: d["厂家代码"],
          price: d["市场报价"]
        })
          .save()
          .catch(err => {});
        cartype_ltype_set.set(d["车辆配置"], type_id);
      } else {
        type_id = cartype_ltype_set.get(d["车辆配置"]);
      }

      //插入销售顾问
      if (!celler_name_set.has(d["销售顾问"])) {
        await new Celler({
          celler_id: celler_id,
          name: d["销售顾问"],
          cate: d["销售划分"]
        })
          .save()
          .catch(err => {});
        celler_name_set.set(d["销售顾问"], celler_id);
      } else {
        celler_id = celler_name_set.get(d["销售顾问"]);
      }

      if (d["赠送装饰"].length != 0) {
        //如果带有装饰项目，则添加一个deco_order
        const decoorder_fmt = { vin: d["车架号"], order_id: timestamp };
        await new Decoorder(decoorder_fmt).save().catch(err => {}); //添加一个装饰订单
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
            .catch(err => {});
        }
      }

      //插入销售
      if (!carsold_vin_set.has(d["车架号"])) {
        await new Carsold({
          vin: d["车架号"],
          type_id: type_id,
          cate: d["销售划分"],
          celler_id: celler_id,
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
        })
          .save()
          .catch(err => {});
        carsold_vin_set.add(d["车架号"]); //记录车架号
      }

      //插入车辆
      if (!car_vin_set.has(d["车架号"])) {
        await new Car({
          vin: d["车架号"],
          type_id: type_id,
          fdjcode: d["发动机号"],
          clr: d["车辆颜色"],
          pdt: d["生产日期"],
          source: d["车辆来源"]
        })
          .save()
          .catch(err => {});
        car_vin_set.add(d["车架号"]);
      }

      res();
    });
  }

  ctx.body = { code: 200 };
});

module.exports = router;
