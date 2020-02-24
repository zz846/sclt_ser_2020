const Router = require("koa-router");
const router = new Router();
const ppt = require("puppeteer");
const path = require("path");
const { wait } = require("../utils/utils");
const fs = require("fs");
const { JSDOM } = require("jsdom");

//const axios=require("axios");

//puppeteer 单例对象
class PPT_obj {
    constructor(options = {}) {
        this.headless = options.headless;
        this.args = options.args || [];
        this.executablePath = options.executablePath;

        this.browser = null;
        this.page = null;
    }

    async init() {
        this.browser = await ppt.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: this.headless,
            executablePath: this.executablePath,
            ignoreHTTPSErrors: true,
            args: this.args
        })
        this.page = await this.browser.newPage()
    }

    async close() {
        await this.browser.close()
    }
}

let PPT = new PPT_obj({ headless: true });

//启动
router.post("/launch", async (ctx, next) => {
    const params = { user_id: "D008AU", user_key: "Pass6666" };
    PPT.browser != null ? PPT.browser.close() : "";//如果浏览器是打开的就先关闭
    await PPT.init();
    await PPT.page.goto("https://dol.saic-gm.com/");
    await PPT.page.type(".sgm_username .textbox-text", params.user_id, { delay: 100 });
    await PPT.page.type(".sgm_password .textbox-text", params.user_key, { delay: 100 });
    const cap_el = await PPT.page.$(".sgm_captcha img");
    const img = Date.now() + '.jpg';
    await cap_el.screenshot({ path: path.join(__dirname, "../output/", `${img}`) }); //截个屏
    ctx.body = { code: 200, data: { img } };
    await next();
})

const login = async (chaptcha) => {
    let re = "";
    //输入验证码
    try {
        await PPT.page.type(".sgm_captcha .textbox-text", chaptcha);
        //点击登录按钮
        await PPT.page.click(".login_bt01 .easyui-linkbutton");
        //等待界面加载
        await PPT.page.waitFor(".sidebar-nav ul");
    } catch (err) {
        re = err;
    }
    return re;
}

//登录系统
router.post("/login", async ctx => {
    const re = await login(ctx.request.body.info.chaptcha)
    ctx.body = { code: re == "" ? 200 : 500, msg: re == {} ? "ok" : re };
})

//下周CALL车数据
router.post("/car_will_call", async ctx => {
    //点击主分类第 9个打开DOL,如果是 8 打开DOSS
    await PPT.page.click(".sidebar-nav ul > li:nth-child(9) ");
    const target = await PPT.browser.waitForTarget(d => d.url() == "https://dol.saic-gm.com/Dol4dealer/jsp/frame_index.jsp");
    await wait(2000);//等待加载完成
    const target_page = await target.page();
    let mainFrame = await target_page.frames().find(d => d.name() == "mainFrame");
    await mainFrame.goto("https://dol.saic-gm.com/Dol4dealer/dol/PeriodOrderColorConfirmSearchPre_Dealer");
    await wait(2000);//等待加载完成
    await mainFrame.evaluate(() => {
        const period = document.querySelector("input[name=period]");
        period.setAttribute("value", period.getAttribute("value") * 1 + 1);
    })
})

//在途车 
router.post("/car_inway", async ctx => {
    //点击主分类第 9个打开DOL,如果是 8 打开DOSS
    await PPT.page.click(".sidebar-nav ul > li:nth-child(9) ");
    const target = await PPT.browser.waitForTarget(d => d.url() == "https://dol.saic-gm.com/Dol4dealer/jsp/frame_index.jsp");
    await wait(2000);//等待加载完成
    const target_page = await target.page();
    let mainFrame = await target_page.frames().find(d => d.name() == "mainFrame");
    await mainFrame.goto("https://dol.saic-gm.com/Dol4dealer/dol/P02DLRM201");

    //首次查询的时候是点击查询按钮，这时候页面就跳转了，所以点击之后的逻辑全部都不能执行，点击便是一切的结束
    await mainFrame.evaluate(() => {
        const options = document.querySelectorAll("select")[0].querySelectorAll("option");
        const states = [100, 110, 120, 130];//分别是VDC VDC-VSC VSC VSC-DEALDER
        for (let i = 0; i < options.length; i++) {
            states.includes(options[i].getAttribute("value") * 1) ? options[i].setAttribute("selected", "selected") : "";//选中需要的状态
        }
        document.querySelector(".cssbutton").click();
    })

    let data = [], notEnd = true, page = 0;
    const new_page = await PPT.browser.newPage();
    while (notEnd) {
        await new_page.goto("https://dol.saic-gm.com/Dol4dealer/dol/P02DLRM202?HoldStatus=-1&IsSGM=false&Status=100&Vin=&pageno=" + page);
        await new_page.waitFor(".cssbutton");
        //这个有点无法解释，就是页面第一次goto的时候，并没有显示出在途数据，但如果用手动复制到浏览器地址再回车可以显示出数据，所以就再做了一次goto
        //puppeteer编程的感觉到目前为止就只有一个，就是举步维艰，因为没有模式，规律可以循
        //你在用ppter就一定是在爬别人的数据，而别人的操作方式跟编程习惯都是无法预测的，只能一点点摸索
        //进展之缓慢，有效代码之少，一整天的时间可能写不出二十行
        await new_page.goto("https://dol.saic-gm.com/Dol4dealer/dol/P02DLRM202?HoldStatus=-1&IsSGM=false&Status=100&Vin=&pageno=" + page);
        await wait(1000);
        const eval_data = await new_page.evaluate(() => {
            const tables = document.querySelectorAll("table");
            if (tables.length == 2) {//该页无在途数据
                return { notEnd: false, data: [] };
            } else {
                let data = [];
                for (const tr of tables[2].querySelectorAll("tr")) {
                    data.push({
                        stype: tr.querySelectorAll("td")[0].textContent,
                        ltype: tr.querySelectorAll("td")[1].textContent,
                        clr: tr.querySelectorAll("td")[2].textContent,
                        vn: tr.querySelectorAll("td")[3].textContent,
                        vin: tr.querySelectorAll("td")[4].textContent,
                        way_state: tr.querySelectorAll("td")[5].textContent,
                        state1: tr.querySelectorAll("td")[6].textContent,
                        state2: tr.querySelectorAll("td")[7].textContent,
                    });
                }
                return { notEnd: true, data };
            }
        })
        eval_data.data.forEach(d => {
            data.push(d);
        })
        page++;
        notEnd = eval_data.notEnd;
        //        await new_page.waitFor(".cssbutton");
    }
    data.forEach((d, i) => {
        if (d.stype == "车型") {//之前的push没有去掉表头，所以在这里去除一下，反馈的数据就都是车辆参数了
            data.splice(i, 1)
        }
    })

    await new_page.close();
    ctx.body = { code: 200, data };
})

//可CALL车数据
router.post("/car_can_call", async ctx => {
    //点击主分类第 9个打开DOL,如果是 8 打开DOSS
    await PPT.page.click(".sidebar-nav ul > li:nth-child(9) ");
    const target = await PPT.browser.waitForTarget(d => d.url() == "https://dol.saic-gm.com/Dol4dealer/jsp/frame_index.jsp");
    await wait(2000);//等待加载完成
    const target_page = await target.page();
    let mainFrame = await target_page.frames().find(d => d.name() == "mainFrame");
    await mainFrame.goto("https://dol.saic-gm.com/Dol4dealer/dol/DealerNormalCallOffQuery");

    //首次查询的时候是点击查询按钮，这时候页面就跳转了，所以点击之后的逻辑全部都不能执行，点击便是一切的结束
    await mainFrame.evaluate(() => {
        document.querySelectorAll(".cssbutton")[1].click();
    })
    let data = [], notEnd = true, page = 0;
    const new_page = await PPT.browser.newPage();
    while (notEnd) {
        await new_page.goto("https://dol.saic-gm.com/Dol4dealer/dol/DealerNormalCallOffQuery?CalloffType=9061&brand=22&colorID=null&colorName=&company=10000041&content=&orgId=10010966&packageID=null&packageName=&pageno=" + page);
        await wait(1000);
        //这个有点无法解释，就是页面第一次goto的时候，并没有显示出在途数据，但如果用手动复制到浏览器地址再回车可以显示出数据，所以就再做了一次goto
        //puppeteer编程的感觉到目前为止就只有一个，就是举步维艰，因为没有模式，规律可以循
        //你在用ppter就一定是在爬别人的数据，而别人的操作方式跟编程习惯都是无法预测的，只能一点点摸索
        //进展之缓慢，有效代码之少，一整天的时间可能写不出二十行
        await new_page.goto("https://dol.saic-gm.com/Dol4dealer/dol/DealerNormalCallOffQuery?CalloffType=9061&brand=22&colorID=null&colorName=&company=10000041&content=&orgId=10010966&packageID=null&packageName=&pageno=" + page);
        await wait(1000);
        const eval_data = await new_page.evaluate(() => {
            const tables = document.querySelectorAll("table");
            if (tables.length != 7) {//该页无可CALL数据
                return { notEnd: false, data: [] };
            } else {
                let data = [];
                for (const tr of tables[3].querySelectorAll("tr")) {
                    data.push({
                        stype: tr.querySelectorAll("td")[1].textContent,
                        ltype: tr.querySelectorAll("td")[2].textContent,
                        clr: tr.querySelectorAll("td")[3].textContent,
                        vsc: tr.querySelectorAll("td")[4].textContent,
                        price: tr.querySelectorAll("td")[5].textContent,
                        order_pe: tr.querySelectorAll("td")[6].textContent,
                        shift_pe: tr.querySelectorAll("td")[7].textContent,
                        Calloff: tr.querySelectorAll("td")[8].textContent,
                        suc: tr.querySelectorAll("td")[9].textContent,
                        nocall: tr.querySelectorAll("td")[10].textContent,
                    });
                }
                return { notEnd: true, data };
            }
        })
        eval_data.data.forEach(d => {
            data.push(d);
        })
        page++;
        notEnd = eval_data.notEnd;
    }

    data.forEach((d, i) => {
        if (d.stype == "车型") {//之前的push没有去掉表头，所以在这里去除一下，反馈的数据就都是车辆参数了
            data.splice(i, 1)
        }
    })

    data = data.map(d => {
        d.vsc = d.vsc.replace(/[\\nt]*\s*/g, "");
        d.price = d.price.replace(/[\\nt]*\s*/g, "");
        d.nocall = d.nocall.replace(/[\\nt]*\s*/g, "");
        return d;
    })

    await new_page.close();
    ctx.body = { code: 200, data };
})

//关闭
router.post("/close", async ctx => {
    await PPT.browser.close();
    ctx.body = { code: 200, msg: "ppt close" };
})

module.exports = { router };