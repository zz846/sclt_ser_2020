//车型
const mgse = require('mongoose')
const cname = "Cartype"

/*
有时候感觉到在自带ID的集合中又去自己创建一个ID是否重复
其实这是为了应付当两个表需要同时插入的时候，而两个表又需要通过一个ID值来关联的情况
假如没有这个ID值，那么需要在其中一个表中先插入数据，然后在查出数据获得ID，再插入到另一个表
*/
const schema = mgse.Schema({
    type_id: {//PK 链接到carsold表
        type: String
    },
    price: {//市场价格
        type: Number,
        default: 0
    },
    stype: {//短车型 主车型
        type: String,
        require,
    },
    ltype: {//长车型
        type: String,
        require,
        unique: true,
        dropDups: true
    },
    typecode_pri: {//内部车型代码
        type: String,
        default: ""
    },
    typecode_pub: {//外部车型代码
        type: String,
        default: ""
    },
}, {
    collection: cname
})

module.exports = mgse.model(cname, schema)