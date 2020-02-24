const Router = require("koa-router");
const router = new Router();
const multer = require("@koa/multer");
const path = require("path");

const storage_img = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "upload/imgs");
    req.uploadpath = path.resolve(__dirname, "../upload/imgs");
  },
  filename: function (req, file, cb) {
    var fileFormat = file.originalname.split("."); //以点分割成数组，数组的最后一项就是后缀名
    const name = Date.now() + "." + fileFormat[fileFormat.length - 1];
    req.uploadname = name;
    cb(null, name);
  }
});

//加载配置
var upload_imgs = multer({
  storage: storage_img,
  limits: {
    fileSize: (1024 * 1024) / 2 // 限制512KB
  }
});

router.post("/img", upload_imgs.single("file"), async ctx => {
  ctx.body = { msg: ctx.req.uploadname };
});

const storage_csv = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "upload/csv");
    req.uploadpath = path.resolve(__dirname, "../upload/csv");
  },
  filename: function (req, file, cb) {
    var fileFormat = file.originalname.split("."); //以点分割成数组，数组的最后一项就是后缀名
    const name = Date.now() + "." + fileFormat[fileFormat.length - 1];
    req.uploadname = name;
    cb(null, name);
  }
});

//加载配置
var upload_csv = multer({
  storage: storage_csv,
  limits: {
    fileSize: (1024 * 1024) / 2 // 限制512KB
  }
});

router.post("/csv", upload_csv.single("file"), async ctx => {
  ctx.body = { msg: ctx.req.uploadname };
});

module.exports = router;
