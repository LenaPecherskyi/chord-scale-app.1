// POST /.netlify/functions/paypal-verify-subscription
// body: { subscriptionId: string }
//
// Проверяет реальный статус подписки в PayPal (а не то, что скажет клиент) — вызывается
// сразу после оформления и затем периодически при загрузке приложения, чтобы держать
// PRO-статус в localStorage синхронизированным с тем, что происходит на стороне PayPal
// (отмена, истечение, неудачное списание и т.д.).
const { paypalFetch } = require('./paypal-helpers');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Некорректный JSON в теле запроса' }) };
  }

  const { subscriptionId } = body;
  if (!subscriptionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Не передан subscriptionId' }) };
  }

  try {
    const sub = await paypalFetch(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`);
    const active = sub.status === 'ACTIVE';
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        active,
        status: sub.status,
        planId: sub.plan_id,
        nextBillingTime: sub.billing_info && sub.billing_info.next_billing_time ? sub.billing_info.next_billing_time : null
      })
    };
  } catch (err) {
    return {
      statusCode: err.status || 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message, details: err.data || null })
    };
  }
};
