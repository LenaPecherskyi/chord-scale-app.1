// POST /.netlify/functions/wayforpay-callback  (serviceUrl)
// WayForPay асинхронно уведомляет об изменении статуса транзакции сюда — как для
// первого платежа, так и для каждого последующего годового автосписания (regularMode).
//
// У приложения нет базы данных и учётных записей пользователей, поэтому эта функция
// не может сама «продлить PRO» в браузере конкретного человека — она только проверяет
// подпись и подтверждает получение WayForPay (иначе WayForPay будет повторять запрос
// и в итоге пометит платёж как неуспешный на своей стороне). Логи по каждому вызову
// видны в Netlify → Logs → Functions → wayforpay-callback — там же удобно вручную
// сверять успешные автопродления, пока в проекте нет отдельной базы подписчиков.
const { hmacMd5, getMerchantCreds } = require('./wayforpay-helpers');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Некорректный JSON' }) };
  }

  let merchantSecret;
  try {
    ({ merchantSecret } = getMerchantCreds());
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }

  const {
    merchantAccount, orderReference, amount, currency,
    authCode, cardPan, transactionStatus, reasonCode, merchantSignature
  } = payload;

  const expectedSignature = hmacMd5(
    [merchantAccount, orderReference, amount, currency, authCode, cardPan, transactionStatus, reasonCode],
    merchantSecret
  );

  const signatureValid = expectedSignature === merchantSignature;

  console.log('[wayforpay-callback]', {
    orderReference,
    transactionStatus,
    amount,
    currency,
    signatureValid
  });

  if (!signatureValid) {
    console.warn('[wayforpay-callback] Неверная подпись — запрос мог быть подделан', payload);
  }

  // Подтверждение по протоколу WayForPay: без этого ответа они продолжат ретраить вебхук.
  const time = Math.floor(Date.now() / 1000);
  const responseSignature = hmacMd5([orderReference, 'accept', time], merchantSecret);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderReference,
      status: 'accept',
      time,
      signature: responseSignature
    })
  };
};
