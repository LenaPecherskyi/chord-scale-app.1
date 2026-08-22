// Общие вспомогательные функции для работы с PayPal REST API (sandbox).
// Используются другими функциями в этой папке — сам по себе этот файл не является
// Netlify Function (не экспортирует handler), поэтому Netlify не публикует его как endpoint.

const PAYPAL_API_BASE = 'https://api-m.sandbox.paypal.com';

async function getAccessToken() {
  const clientId = process.env.PAYPAL_SANDBOX_CLIENT_ID;
  const secret = process.env.PAYPAL_SANDBOX_SECRET;

  if (!clientId || !secret) {
    throw new Error('PAYPAL_SANDBOX_CLIENT_ID / PAYPAL_SANDBOX_SECRET не настроены в переменных окружения Netlify');
  }

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');

  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Не удалось получить PayPal access token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function paypalFetch(path, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }

  if (!res.ok) {
    const err = new Error(`PayPal API error ${res.status}: ${JSON.stringify(data)}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

module.exports = { PAYPAL_API_BASE, getAccessToken, paypalFetch };
