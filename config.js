const path = require("path");

const config = {
  port: 3010,//服务端口
  checkAu_on: false, //开启验证用户TOKEN
  clearTempCSV_on: false,//开启服务器启动时清除 upload/csv文件夹
  secret: "loveLX", //登录TOKEN加密盐
  mgse: {
    db: "mongodb://localhost/angryme" //数据库连接字符串
  },
  zipPath: require("path").join(__dirname, "zip/"), //压缩文件路径
  savePath: require("path").join(__dirname, "output/"), //导出文件保存路径
  inputPath: require("path").join(__dirname, "input/"), //导入文件保存路径
  uploadPath: require("path").join(__dirname, "upload/"), //上传文件路径
  tempPath: require("path").join(__dirname, "temp/"),//零时文件
  adm_mail: "20508261@qq.com",
  mail_config: {
    //smtp 发送邮箱设置
    service: "QQ",
    port: 465,
    user: "2259156482@qq.com", //发送邮箱账户
    pass: "aabbcc123", //发送邮箱密码
    mailtoken: "odgvtvtjlicgecfi" //身份码
  },
  salary: {
    aj_rate: 0.15, //按揭提成率
    jcz_rate: 0.1, //净产值提成率 
    zcz_car: 3000 //单车的产值目标
  }
};

module.exports = config;
