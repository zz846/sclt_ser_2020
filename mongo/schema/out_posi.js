const mgse = require("mongoose")
const cname = "OutPosi"

const schema = mgse.Schema({
    createdt: {
        type: Date,
        default: Date.now()
    },
    posi: {
        type: String
    }
}, {
    collection: cname
})

module.exports = mgse.model(cname, schema)