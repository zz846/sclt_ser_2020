const fast_csv = require("fast-csv")
const fs = require("fs")
const { Parser } = require("json2csv")

module.exports.reader = filename => {
    return new Promise((res, rej) => {
        let data = [];
        fs.createReadStream(require("path").join(require("../config").uploadPath, filename), { encoding: 'utf8' }).pipe(fast_csv.parse({ headers: true })).on("data", row => {
            data.push(row);
        }).on("end", () => {
            res(data);
        })
    })
}

module.exports.reader_code = (filename, encode) => {
    return new Promise((res, rej) => {
        let data = [];
        fs.createReadStream(require("path").join(require("../config").uploadPath, filename), { encoding: encode }).pipe(fast_csv.parse({ headers: true })).on("data", row => {
            data.push(row);
        }).on("end", () => {
            res(data);
        })
    })
}

/*json      数据
fields      列头，是按照各列头来查找内容的，也就是说可以选择性导出json内容
filename    指定文件名
*/
module.exports.writer = (json, fields, filename) => {
    return new Promise((res, rej) => {
        const parser = new Parser({ fields });
        const result = parser.parse(json);
        fs.writeFile(require("path").join(require('../config').savePath, filename), '\ufeff' + result, () => {
            res(filename)
        });
    })
}