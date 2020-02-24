const mgse = require("mongoose");
const cname = "SalaryCellerTag";

const schema = mgse.Schema(
  {
    year: {
      //目标年度
      type: Number
    },
    month: {
      //目标月度
      type: Number
    },
    celler_id: {
      //销售顾问id，链接到celler
      type: String
    },
    chanzhi: {
      //单车产值金额目标
      type: Number
    },
    anjie: {
      //单车按揭金额目标
      type: Number
    },
    soldtag: {
      //销售数量目标
      type: Number
    },
    anjietag: {
      //按揭数量目标
      type: Number
    },
    specialtag: {
      //特殊车型目标
      type: Number
    },
    tagrate: {
      //交车目标完成率
      type: Number
    },
    createdt: {
      //创建日期
      type: Date,
      default: Date.now()
    }
  },
  { collection: cname }
);

schema.statics.checkRepeatAndSave = function(doc) {
  return new Promise((res, rej) => {
    //console.log(doc);
    this.findOne(
      { year: doc.year, month: doc.month, celler_id: doc.celler_id },
      async (err, re) => {
        if (re) {
          //重复数据
          rej();
        } else {
          //不重复
          const newTag = new model(doc);
          await newTag.save().catch(err => {});
          res();
        }
      }
    );
  });
};

const model = mgse.model(cname, schema);

module.exports = model;
