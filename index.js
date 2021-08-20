const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const mqtt = require('mqtt');
const CronJob = require('cron').CronJob;
require('dotenv').config()


const urlLogin = 'https://www.ihef.com.br/resultados-de-exames/index.html';

const start = async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(urlLogin, { waitUntil: 'networkidle2' });

    await page.evaluate(() => {
      document.querySelector('#formLogin').setAttribute('target', '');
    })

    await page.type('#sle_sLogin', process.env.LOGIN);
    await page.type('#sle_sSenha', process.env.SENHA);
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ timeout: 60000 });

    const mainFrame = page.mainFrame();
    const contentFrame = mainFrame.childFrames().find(frame => frame.name() === 'mainFrame')

    const html = await contentFrame.content();

    const $ = cheerio.load(html);

    const status = $('#dw_rcl_pac_detail_0').children().last().html();
    console.log(`Status do último exame: ${status}`);

    const mqttClient = mqtt.connect('mqtt://broker.emqx.io');
    mqttClient.on('connect', () => {
      mqttClient.publish(process.env.MQTT_TOPIC, status);
      mqttClient.end();
    })
  } catch (error) {
    console.error(`Erro na execução do script: ${error}`);
  } finally {
    browser.close();
  }
}

const job = new CronJob('*/2 * * * *', async () => {
  try {
    console.log(`Executando cron em ${new Date().toISOString()}`);
    await start();
  } catch (error) {
    console.error(`Erro na execução do cron: ${error}`);
  }
})

job.start();

