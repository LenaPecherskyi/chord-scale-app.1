// Временный диагностический endpoint. НЕ возвращает сами секреты — только их длину
// и признаки пробелов/переносов строк, чтобы понять, не испорчено ли значение при
// копировании/вставке в Netlify. Удалить после того, как проблема с invalid_client решена.
exports.handler = async () => {
  const clientId = process.env.PAYPAL_SANDBOX_CLIENT_ID || '';
  const secret = process.env.PAYPAL_SANDBOX_SECRET || '';

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: {
        present: !!process.env.PAYPAL_SANDBOX_CLIENT_ID,
        length: clientId.length,
        trimmedLength: clientId.trim().length,
        hasLeadingOrTrailingWhitespace: clientId !== clientId.trim(),
        hasNewline: /[\r\n]/.test(clientId)
      },
      secret: {
        present: !!process.env.PAYPAL_SANDBOX_SECRET,
        length: secret.length,
        trimmedLength: secret.trim().length,
        hasLeadingOrTrailingWhitespace: secret !== secret.trim(),
        hasNewline: /[\r\n]/.test(secret)
      }
    })
  };
};
