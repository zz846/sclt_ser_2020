const nodemailer = require("nodemailer")
const mail_config = require("../config").mail_config

//20508261 hwqtyyplxalbcagj

module.exports.tp = nodemailer.createTransport({//创建转换器
    service: mail_config.service,
    port: mail_config.port,
    secureConnection: true,
    auth: {
        user: mail_config.user,
        pass: mail_config.mailtoken
    }
});

//邮件本身参数范例
module.exports.content = {
    from: mail_config.user,
    to: '',                 //收件人
    subject: '',            //标题
    text: '',               //不清楚是什么，没有在邮件中显示
    html: '',               //正文
    // attachments: [       //附件
    //     { filename: '1.txt', path: '../mail/1.txt' },
    // ]
}

// transporter.sendMail(mail_obj, (err, info) => {
//     if (err) {
//         return console.log(err)
//     }

//     console.log('auto mail done!');
// });