// POST /.netlify/functions/wayforpay-sign
// Формирует подписанный платёж для виджета WayForPay (secure.wayforpay.com/server/pay-widget.js):
// разовое списание сейчас + автоматическое ежегодное продление (regularMode: "yearly"),
// пока пользователь не отменит подписку в личном кабинете WayForPay.
//
// ВАЖНО: параметры регулярного платежа (regularMode/regularAmount/dateNext) в подпись
// НЕ включаются — подписывается только базовый набор полей заказа, как того требует
// протокол WayForPay. merchantDomainName должен совпадать с доменом, привязанным к
// мерчанту в личном кабинете WayForPay — если он отличается, WayForPay отклонит платёж
// с ошибкой домена (проверить в Настройках магазина → Домены).
const { hmacMd5, formatDateDDMMYYYY, getMerchantCreds } = require('./wayforpay-helpers');

const PRODUCT_NAME = 'Chords and Modes — PRO (годовая подписка)';
const AMOUNT_UAH = 400.00;
const CURRENCY = 'UAH';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { merchantAccount, merchantSecret, merchantDomainName } = getMerchantCreds();

    const now = new Date();
    const orderReference = `pro-yearly-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
    const orderDate = Math.floor(now.getTime() / 1000);

    const nextYear = new Date(now);
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    const productName = [PRODUCT_NAME];
    const productPrice = [AMOUNT_UAH];
    const productCount = [1];

    const signatureFields = [
      merchantAccount,
      merchantDomainName,
      orderReference,
      orderDate,
      AMOUNT_UAH,
      CURRENCY,
      ...productName,
      ...productCount,
      ...productPrice
    ];
    const merchantSignature = hmacMd5(signatureFields, merchantSecret);

    const siteUrl = process.env.URL || `https://${event.headers.host}`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantAccount,
        merchantDomainName,
        merchantSignature,
        orderReference,
        orderDate,
        amount: AMOUNT_UAH,
        currency: CURRENCY,
        productName,
        productPrice,
        productCount,
        serviceUrl: `${siteUrl}/.netlify/functions/wayforpay-callback`,
        regularMode: 'yearly',
        regularAmount: AMOUNT_UAH,
        dateNext: formatDateDDMMYYYY(nextYear)
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
