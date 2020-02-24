const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const delDir = path => {
  let files = [];
  if (fs.existsSync(path)) {
    files = fs.readdirSync(path);
    files.forEach((file, index) => {
      let curPath = path + "/" + file;
      if (fs.statSync(curPath).isDirectory()) {
        delDir(curPath); //递归删除文件夹
      } else {
        fs.unlinkSync(curPath); //删除文件
      }
    });
    //    fs.rmdirSync(path);//删除路径文件夹本身
  }
}

//清理零时数据
const clearTempFile = () => {
  delDir(path.join(__dirname, "../upload/csv"));
  delDir(path.join(__dirname, "../temp"));
}

//暂停等待
const wait = t => {
  return new Promise((res, rej) => {
    setTimeout(() => {
      res();
    }, t);
  });
};

//日期文本转短日期
const shortdate = dtstr => {
  const dt = new Date(dtstr);
  return `${dt.getFullYear()}-${
    dt.getMonth() + 1 < 10 ? "0" + (dt.getMonth() + 1) : dt.getMonth() + 1
    }-${dt.getDate() < 10 ? "0" + dt.getDate() : dt.getDate()}`;
};

//日期文本转长日期
const longdate = dtstr => {
  const dt = new Date(dtstr);
  return `${shortdate(dtstr)} ${
    dt.getHours() < 10 ? "0" + dt.getHours() : dt.getHours()
    }:${dt.getMinutes() < 10 ? "0" + dt.getMinutes() : dt.getMinutes()}`;
};

//检测权限
const checkAU = async (ctx, next) => {
  let pass = true;

  if (require("../config").checkAu_on) {
    //是否开启用户TOKEN检测
    const token = ctx.request.body.token;
    //  console.log(token);
    if (token == undefined) {
      //无TOKEN
      pass = false;
    } else {
      //有token，判断是否为合法TOKEN
      try {
        const info = jwt.verify(token, require("../config").secret);
      } catch (err) {
        //解析出错，TOKEN非法
        pass = false;
      }
    }
  }

  if (pass) {
    await next();
  } else {
    const echo = { code: 403, msg: "unauthorized" };
    ctx.body = echo;
    console.log(echo);
  }
};

//计算两个日期相差天数
const days = (dt1str, dt2str) => {
  let dateStart = new Date(dt1str);
  let dateEnd = new Date(dt2str);
  return (dateEnd - dateStart) / (1000 * 60 * 60 * 24);
};


module.exports = { wait, shortdate, longdate, checkAU, clearTempFile ,days};
