"use strict";

const pup = require("puppeteer");
const cheerio = require("cheerio");
require("dotenv").config();

const CAL_LOGIN_URL =
  "https://services.cal-online.co.il/card-holders/Screens/AccountManagement/HomePage.aspx";
const CAL_USERNAME = process.env.USERNAME;
const CAL_PASSWORD = process.env.PASSWORD;
const CAL_PASSWORD_SELECTOR = 'input[type="password"]';
const CAL_USERNAME_SELECTOR = 'input[name="userName"]';
const CAL_SIGNIN_SELECTOR = '.form-footer button[type="submit"]';
const CAL_DEBIT_SELECTOR = "#lblNextDebitSum";
const CAL_EXPENCES_SELECTOR = "#LabelPaymentDetails";
const CAL_EXPENCES_SHOW_BUTTON =
  "#ctl00_FormAreaNoBorder_FormArea_ctlSubmitRequest";
const CAL_EXPENCES_TABLE_SELECTOR = "#ctlMainGrid";
const CAL_EXPENCES_NEXT_PAGE =
  "#ctl00_FormAreaNoBorder_FormArea_ctlGridPager_tdNext input";


const getCalDebit = async () => {
  console.log("==== getCalDebit ====");
  try {
    const browser = await pup.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();

    await page.goto(CAL_LOGIN_URL);
    await page.waitForSelector("#calconnectFrame");

    const frame = await page
      .frames()
      .find(f => f.name() === "calconnectIframe");

    await frame.waitForSelector(CAL_PASSWORD_SELECTOR);
    await frame.waitForSelector(CAL_USERNAME_SELECTOR);
    await frame.waitForSelector(CAL_SIGNIN_SELECTOR);

    const PASSWORD = await frame.$(CAL_PASSWORD_SELECTOR);
    const USER_NAME = await frame.$(CAL_USERNAME_SELECTOR);
    const SIGN_IN = await frame.$(CAL_SIGNIN_SELECTOR);

    await USER_NAME.type(CAL_USERNAME);
    await PASSWORD.type(CAL_PASSWORD);
    await SIGN_IN.click();

    await page.waitForSelector(CAL_DEBIT_SELECTOR, {
      timeout: 50 * 1000
    });

    const textContent = await page.evaluate(
      () => document.querySelector("#lblNextDebitSum").textContent
    );

    const debit = textContent.replace(",", "").split(".")[0];
    console.log(`cal debit ${debit}`);

    const expenses = await getDebitExpenses(page);

    console.log(`==== Expenses ====`);
    console.log(JSON.stringify(expenses));
    console.log(`==================`);
    await browser.close();

    return debit;
  } catch (error) {
    console.error(`cal error ${error}`);
  }
};

const getDebitExpenses = async page => {
  console.log("==== getDebitExpenses ====");

  if ((await page.$(CAL_EXPENCES_SELECTOR)) !== null) {
    await page.click(CAL_EXPENCES_SELECTOR);

    await page.waitForSelector(CAL_EXPENCES_TABLE_SELECTOR);
    let textContent = await page.evaluate(
      () => document.querySelector("#ctlMainGrid").innerHTML
    );
    const isAnotherPage = await page.$(CAL_EXPENCES_NEXT_PAGE);

    if (isAnotherPage !== null) {
      await page.focus(CAL_EXPENCES_NEXT_PAGE);
      await page.click(CAL_EXPENCES_NEXT_PAGE);
      await page.waitForSelector(
        "#ctl00_FormAreaNoBorder_FormArea_ctlGridPager_btnPrev",
        {
          timeout: 20 * 1000
        }
      );

      textContent += await page.evaluate(
        () => document.querySelector("#ctlMainGrid").innerHTML
      );
    }

    return parseExpenses(textContent);
  }

  return [];
};

const parseExpenses = html => {
  console.log("==== parseExpenses ====");

  const expenses = [];
  const $ = cheerio.load(html);
  const rows = $(html).find("tbody tr");

  rows.map(async (index, item) => {
    item = $(item);
    let date = item
      .find("td:nth-of-type(1)")
      .text()
      .trim();
    const pointOfSale = item
      .find("td:nth-of-type(2)")
      .text()
      .trim();
    const amount = item
      .find("td:nth-of-type(4)")
      .text()
      .trim()
      .replace(/[^0-9.]/g, "");

    expenses.push({
      date,
      pointOfSale,
      amount
    });
  });

  return expenses;
};

getCalDebit();
