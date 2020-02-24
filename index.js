const Koa = require("koa");
const static = require("koa-static");
const Router = require("koa-router");
const path = require("path");
//const koabody = require("koa-body");
const bodyparser = require("koa-bodyparser");
const cors = require("koa2-cors");
const session = require("koa-session");
const passport = require("koa-passport");
const { checkAU, clearTempFile } = require("./utils/utils");
const config = require("./config");

//清除零时文件夹
if (config.clearTempCSV_on) {
  clearTempFile();
}

(async () => {
  await require("./mongo/init").connect();
})();

//路由
const os = require("./routes/os");
const login = require("./routes/login");
const celler = require("./routes/celler");
const deco = require("./routes/deco");
const car = require("./routes/car");
const salary = require("./routes/salary");
const comon = require("./routes/comon");
const upload = require("./routes/upload");
const carsold = require("./routes/carsold");
const user = require("./routes/user");
const carstore = require("./routes/carstore");
const carorder = require("./routes/carorder");
const carinway = require("./routes/carinway");
const output = require("./routes/output");
const global = require("./routes/global");
const callcar = require("./routes/callcar");
const hgz = require("./routes/hgz");
const carall = require("./routes/carall").router;
const tag = require("./routes/tag").router;
const doss = require("./routes/doss").router;
const ppteer = require("./routes/puppeteer").router;
const g2_router = require("./routes/g2").router;
const cusflow = require("./routes/cusflow").router;

const app = new Koa();

app.keys = [require("./config.js").secret];

const router = new Router();
app
  .use(static(path.join(__dirname + "/output"))) //导出下载表格
//  .use(static(path.join(__dirname + "/dist/print"))) //打印模板
  .use(cors())
  .use(bodyparser())
  .use(session({ key: "session-id" }, app))
  .use(passport.initialize())
  .use(passport.session());

// const jump = async ctx => {
//   function getIPAddress() {
//     var interfaces = require('os').networkInterfaces();
//     for (var devName in interfaces) {
//       if (devName.indexOf("VMware") == -1) {
//         var iface = interfaces[devName];
//         for (var i = 0; i < iface.length; i++) {
//           var alias = iface[i];
//           if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
//             return alias.address;
//           }
//         }
//       }
//     }
//   }
//   ctx.body = `<a href='http://${getIPAddress()}:3011'>PC端</a><a href='http://${getIPAddress()}:3012'>移动端</a>`;
// }

router
  .get("/", async ctx => { ctx.body = "Please go away." })
  .use("/upload", upload.routes())
  .use("/os", os.routes())
  .use("/output", output.routes())
  .use("/callcar", callcar.routes())
  .use("/login", login.routes()) //登录没有权限判断
  .use("/celler", checkAU, celler.routes())
  .use("/deco", checkAU, deco.routes())
  .use("/car", checkAU, car.routes())
  .use("/salary", checkAU, salary.routes())
  .use("/cm", checkAU, comon.routes())
  .use("/carsold", checkAU, carsold.routes())
  .use("/user", checkAU, user.routes())
  .use("/carstore", checkAU, carstore.routes())
  .use("/carorder", checkAU, carorder.routes())
  .use("/carinway", checkAU, carinway.routes())
  .use("/global", checkAU, global.routes())
  .use("/hgz", checkAU, hgz.router.routes())
  .use("/tag", checkAU, tag.routes())
  .use("/carall", checkAU, carall.routes())
  .use("/doss", checkAU, doss.routes())
  .use("/puppeteer", checkAU, ppteer.routes())
  .use("/g2", checkAU, g2_router.routes())
  .use("/cf", checkAU, cusflow.routes())

app.use(router.routes()).use(router.allowedMethods());

app.listen(require("./config").port, err => {
  if (err) throw err;
  console.log("server at " + require("./config").port);
});
