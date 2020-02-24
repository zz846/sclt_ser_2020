const mgse = require("mongoose");
const moment = require("moment");

module.exports.connect = () => {
    mgse.Promise = global.Promise;//mongoose 自己封装的promise替换为标准promise
    mgse.set('useCreateIndex', true)
    mgse.connect(require("../config").mgse.db, { useNewUrlParser: true, useUnifiedTopology: true })
    let maxTimes = 0

    return new Promise((resolve, reject) => {
        let reconnect = () => {
            if (maxTimes < 3) {
                maxTimes++
                mgse.connect(require("../config").db, { useNewUrlParser: true, useUnifiedTopology: true })
            } else {
                reject()
                console.log(`dbTimes is max(${maxTimes})`)
            }
        }

        mgse.connection.once("open", () => {
            console.log("[" + moment().format("YYYY-MM-DD HH:mm:ss") + "] db connected.")
            resolve()
        })

        mgse.connection.on("disconnected", () => {
            console.log("[" + moment().format("YYYY-MM-DD HH:mm:ss") + "] db disconnected.")
            reconnect()
        })

        mgse.connection.on("error", () => {
            console.log("[" + moment().format("YYYY-MM-DD HH:mm:ss") + "] db error.")
            reconnect()
        })
    })
}