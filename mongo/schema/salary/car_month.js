const mgse = require("mongoose");
const cname = "SalaryCarMonth";
//导入之前会按照月度和年度把之前的数据删掉
const schema = mgse.Schema(
  {
    year: { type: Number },
    month: { type: Number },
    stype: { type: String },
    ltype: { type: String },
    m_price: { type: Number }, //市场价
    man_percentage: { type: Number }, //展厅销售提成
    net_percentage: { type: Number }, //网点销售提成
    sold_limit: { type: Number }, //销售限价
    percentage_limit: { type: Number } //提成限价
  },
  { collection: cname }
);

module.exports = mgse.model(cname, schema);
