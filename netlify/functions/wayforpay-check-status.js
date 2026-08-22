// POST /.netlify/functions/wayforpay-check-status
// body: { orderReference: string }
//
// Клиент вызывает это сразу после закрытия виджета оплаты (approvedCallback/pendingCallback),
// чтобы получить подтверждённый статус транзакции с сервера WayForPay, а не просто верить
// колбэку виджета в браузере. Использует официальный метод CHECK_STATUS.
const { hmacMd5, getMerchantCreds } = require('./wayforpay-helpers');

const WFP_API_URL = 'https://api.wayforpay.com/api';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Некорректный JSON' }) };
  }

  const { orderReference } = body;
  if (!orderReference) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Не передан orderReference' }) };
  }

  try {
    const { merchantAccount, merchantSecret } = getMerchantCreds();
    const merchantSignature = hmacMd5([merchantAccount, orderReference], merchantSecret);

    const res = await fetch(WFP_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionType: 'CHECK_STATUS',
        merchantAccount,
        orderReference,
        merchantSignature,
        apiVersion: 1
      })
    });

    const data = await res.json();
    const approved = data.transactionStatus === 'Approved';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approved,
        transactionStatus: data.transactionStatus || null,
        reasonCode: data.reasonCode || null,
        amount: data.amount || null,
        currency: data.currency || null
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
