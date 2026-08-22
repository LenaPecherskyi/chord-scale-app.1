// Общие вспомогательные функции для интеграции с WayForPay.
// Не экспортирует handler — не публикуется Netlify как отдельный endpoint.
const crypto = require('crypto');

function hmacMd5(fields, secret) {
  const str = fields.join(';');
  return crypto.createHmac('md5', secret).update(str, 'utf8').digest('hex');
}

// dd.mm.yyyy — формат дат, который ожидает WayForPay в полях типа dateNext.
function formatDateDDMMYYYY(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function getMerchantCreds() {
  const merchantAccount = process.env.WAYFORPAY_MERCHANT_LOGIN;
  const merchantSecret = process.env.WAYFORPAY_MERCHANT_SECRET;
  const merchantDomainName = process.env.WAYFORPAY_MERCHANT_DOMAIN || 'musicforlife.top';
  if (!merchantAccount || !merchantSecret) {
    throw new Error('WAYFORPAY_MERCHANT_LOGIN / WAYFORPAY_MERCHANT_SECRET не настроены в переменных окружения Netlify');
  }
  return { merchantAccount, merchantSecret, merchantDomainName };
}

module.exports = { hmacMd5, formatDateDDMMYYYY, getMerchantCreds };
