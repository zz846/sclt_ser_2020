const mgse = require("mongoose");
const cname = "Tag";

const schema = mgse.Schema({
    createdt: { type: Date, default: Date.now() },
    tag_id: { type: String },
    name: { type: String },
    content: { type: String, default: "" },
    vins: { type: [{ vin: { type: String } }], default: [] }
}, { collection: cname })

module.exports = mgse.model(cname, schema);
