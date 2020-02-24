const mgse = require("mongoose");
const cname = "SalaryTypeClass2Insde";

/*
这是用来匹配官方车型和内部政策表车薪的链接表
官方车型ID是唯一的，但是因为换代等问题，可能会有很多个不同的车型对应内部的同一车型
所以官方ID唯一，而内部车型可能重复

匹配机制非常简单就是把两个ID添加一条记录就可以
难点是在于优化建议的问题
不可能把所有的车型全部扔出来让我选择，效率太低，流程应该如下：
1、选出近两个月内销售的车辆，并且车型未在这个表的明细
2、在内部车型表中按照价格查找对应的内部车型，由于没有进行主车型的分类，所以仅能依靠价格来查，结果会被大量精简，但依然存在混在
*/

const schema = mgse.Schema(
  {
    classtypeid: {
      type: String,
      dropDups: true,
      require,
      unique: true
    },
    intypeid: {
      type: String
    }
  },
  {
    collection: cname
  }
);

module.exports = mgse.model(cname, schema);
