/**
 * 金邊鍋貼｜線上訂單接收（Google Apps Script 網頁應用程式）
 *
 * 必須綁定在試算表上：試算表 → 擴充功能 → Apps Script，貼上此檔案。
 * 部署與設定步驟見 apps-script/README.md。
 */

// 商品與價格：必須與 index.html 的 products 保持一致。
// 金額以這裡為準，不信任前端送來的價格。
const CATALOG = {
  p1: { name: '招牌鮮肉鍋貼', price: 85 },
  p2: { name: '韭香鮮肉鍋貼', price: 90 },
  p3: { name: '香辣椒麻鍋貼', price: 95 },
  p4: { name: '田園蔬食鍋貼', price: 90 },
  p5: { name: '高麗菜鮮肉水餃', price: 80 },
  p6: { name: '韭菜鮮肉水餃', price: 85 },
  p7: { name: '暖心酸辣湯', price: 45 },
  p8: { name: '清爽無糖茶', price: 35 },
  p9: { name: '涼拌小黃瓜', price: 40 },
  p10: { name: '香滷豆干', price: 40 },
  gift50: { name: '招牌招財鍋貼禮盒 50 入', price: 599 }
};

const SHEET_NAME = '訂單';
const HEADERS = ['訂單編號', '建立時間', '取餐方式', '聯絡姓名', '聯絡電話', '宅配地址', '品項明細', '數量合計', '商品小計（未含運費）', '狀態'];
const FULFILLMENT = ['外帶', '內用', '宅配'];
const TZ = 'Asia/Taipei';
const MAX_QTY_PER_ITEM = 50;
const MAX_ITEM_LINES = 30;

// 健康檢查：在瀏覽器打開部署網址會看到這段 JSON。
function doGet() {
  return json_({ ok: true, service: 'orders' });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    // 簡單的防濫發檢查：token 必須與 Script Properties 中的 ORDER_TOKEN 相同。
    const token = PropertiesService.getScriptProperties().getProperty('ORDER_TOKEN');
    if (!token || body.token !== token) {
      return json_({ ok: false, error: '未授權的請求' });
    }

    const order = validate_(body);

    // 加鎖，避免兩筆訂單同時寫入時編號重複。
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      const sheet = getSheet_();
      const orderNo = makeOrderNo_(sheet.getLastRow());
      sheet.appendRow([
        orderNo,
        new Date(),
        order.fulfillment,
        order.name,
        order.phone,
        order.address,
        order.itemsText,
        order.qty,
        order.subtotal,
        '待確認'
      ]);
      notify_(orderNo, order);
      return json_({ ok: true, orderNo: orderNo });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    // 可預期的資料錯誤直接回傳訊息；其他錯誤不外露細節。
    return json_({ ok: false, error: err.userFacing ? err.message : '系統忙碌，請稍後再試' });
  }
}

/** 驗證並整理訂單資料，回傳可寫入試算表的內容。 */
function validate_(body) {
  const name = clean_(body.name, 60);
  if (!name) fail_('請填寫聯絡姓名');

  const phone = String(body.phone || '').trim();
  if (!/^[0-9+()\- ]{8,20}$/.test(phone)) fail_('電話格式不正確');

  const fulfillment = String(body.fulfillment || '');
  if (FULFILLMENT.indexOf(fulfillment) === -1) fail_('取餐方式不正確');

  let address = '';
  if (fulfillment === '宅配') {
    address = clean_(body.address, 120);
    if (!address) fail_('宅配請填寫收件地址');
  }

  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > MAX_ITEM_LINES) {
    fail_('購物車內容不正確');
  }

  let subtotal = 0;
  let qty = 0;
  const lines = [];
  body.items.forEach(function (item) {
    const product = CATALOG[item && item.id];
    const n = Number(item && item.qty);
    if (!product) fail_('包含不存在的商品');
    if (!Number.isInteger(n) || n < 1 || n > MAX_QTY_PER_ITEM) fail_('商品數量不正確');
    subtotal += product.price * n;
    qty += n;
    lines.push(product.name + ' ×' + n);
  });

  return {
    name: sanitize_(name),
    phone: phone,
    fulfillment: fulfillment,
    address: sanitize_(address),
    itemsText: lines.join('；'),
    qty: qty,
    subtotal: subtotal
  };
}

/** 取得「訂單」工作表；第一次使用時自動建立表頭與格式。 */
function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    ss.setSpreadsheetTimeZone(TZ);
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange('B:B').setNumberFormat('yyyy-mm-dd hh:mm');
    sheet.getRange('E:E').setNumberFormat('@'); // 電話以文字儲存，保留開頭的 0 與 +
    sheet.getRange('I:I').setNumberFormat('#,##0');
  }
  return sheet;
}

/** 訂單編號：G + 日期 + 流水號（流水號即目前列數，已由 LockService 保護）。 */
function makeOrderNo_(lastRow) {
  const date = Utilities.formatDate(new Date(), TZ, 'yyyyMMdd');
  return 'G' + date + '-' + String(lastRow).padStart(4, '0');
}

/** 若 Script Properties 設定了 NOTIFY_EMAIL，有新訂單時寄一封通知信。 */
function notify_(orderNo, order) {
  const to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL');
  if (!to) return;
  const lines = [
    '新訂單：' + orderNo,
    '取餐方式：' + order.fulfillment,
    '聯絡姓名：' + order.name,
    '聯絡電話：' + order.phone,
    order.address ? '宅配地址：' + order.address : '',
    '品項：' + order.itemsText,
    '商品小計（未含運費）：NT$ ' + order.subtotal
  ].filter(Boolean);
  MailApp.sendEmail(to, '金邊鍋貼新訂單 ' + orderNo, lines.join('\n'));
}

function clean_(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

/** 防止試算表公式注入：以 = + - @ 開頭的文字前面加單引號。 */
function sanitize_(text) {
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function fail_(message) {
  const err = new Error(message);
  err.userFacing = true;
  throw err;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
