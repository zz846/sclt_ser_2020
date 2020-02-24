const fs = require("fs")
const path = require("path")
const jszip = require("jszip")

let zip = new jszip();

function readDir(obj, nowPath) {
    let files = fs.readdirSync(nowPath);//读取目录中的所有文件及文件夹（同步操作）
    files.forEach(function (fileName, index) {//遍历检测目录中的文件
        //console.log(fileName, index);//打印当前读取的文件名
        let fillPath = nowPath + "/" + fileName;
        let file = fs.statSync(fillPath);//获取一个文件的属性
        if (file.isDirectory()) {//如果是目录的话，继续查询
            let dirlist = zip.folder(fileName);//压缩对象中生成该目录
            readDir(dirlist, fillPath);//重新检索目录文件
        } else {
            obj.file(fileName, fs.readFileSync(fillPath));//压缩目录添加文件
        }
    });
}

//压缩路径内所有文件，包含文件夹，但是在使用中发现好像被拍平了，无需求，未使用
module.exports.startZipCate = (filePath, filename) => {
    //var currPath = __dirname;//文件的绝对路径 当前当前js所在的绝对路径
    //var targetDir = path.join(currPath, "JsonMerge");
    const targetDir = filePath;  //需要压缩文件路径
    const saveDir = require("../config").zipPath;//压缩后保存路径
    readDir(zip, targetDir);
    zip.generateAsync({//设置压缩格式，开始打包
        type: "nodebuffer",//nodejs用
        compression: "DEFLATE",//压缩算法
        compressionOptions: {//压缩级别
            level: 9
        }
    }).then(function (content) {
        fs.writeFileSync(require("path").join(saveDir, filename), content, "utf-8");//将打包的内容写入 当前config.zipPath目录下
    });
}

//压缩指定文件
module.exports.startZipFile = (path, file, zipFileName) => {//filename 返回的文件名

    return new Promise((res, rej) => {
        const saveDir = require("../config").zipPath;//压缩后保存路径
        zip.file(file, fs.readFileSync(require("path").join(path, file))).generateAsync({//设置压缩格式，开始打包
            type: "nodebuffer",//nodejs用
            compression: "DEFLATE",//压缩算法
            compressionOptions: {//压缩级别
                level: 9
            }
        }).then(function (content) {
            fs.writeFileSync(require("path").join(saveDir, zipFileName), content, "utf-8");//将打包的内容写入 当前config.zipPath目录下
            console.log("write done!")
            res();
        });
    })
}