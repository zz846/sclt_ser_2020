const ppter = require("puppeteer");
const path = require("path");

const login = async params => {
  const pars = params;
  const browser = await ppter.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("https://dol.saic-gm.com/");

  await page.type(".sgm_username .textbox-text", params.user_id, { delay: 100 });
  await page.type(".sgm_password .textbox-text", params.user_key, { delay: 100 });
  let captcha = "666";
  const cap_el = await page.$(".sgm_captcha img");
  await cap_el.screenshot({ path: path.join(__dirname, "cap.jpg") }); //截个屏

  await page.type(".sgm_captcha .textbox-text", captcha, { delay: 100 });

  //  await page.click(".login_bt01 .easyui-linkbutton", { delay: 300 });

  await browser.close();
};

//login({ user_id: "D008AU666", user_key: "Pass6666" });


const ppt_launch = async () => {
  const browser = await ppter.launch();
}

const ppt_close = async (browser) => {
  await browser.close();
}

module.exports = { ppt_launch, ppt_close }