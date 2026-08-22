// GET /.netlify/functions/paypal-config
// Отдаёт клиенту публичные PayPal-идентификаторы (Client ID и Plan ID — не секреты),
// чтобы не хардкодить их в index.html и иметь возможность сменить окружение
// (sandbox → live) без правки фронтенда.
exports.handler = async () => {
  const clientId = process.env.PAYPAL_SANDBOX_CLIENT_ID;
  const planId = process.env.PAYPAL_PLAN_ID || null;

  if (!clientId) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'PAYPAL_SANDBOX_CLIENT_ID не настроен в переменных окружения Netlify' })
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    body: JSON.stringify({ clientId, planId, env: 'sandbox' })
  };
};
