// GET /.netlify/functions/paypal-setup-plan
//
// Одноразовая (идемпотентно-безопасная) служебная функция: создаёт в PayPal sandbox
// продукт "Chords and Modes — PRO" и годовой billing plan ($9.99/год), если они ещё
// не существуют, и возвращает их id. Product ID и Plan ID НЕ являются секретами
// (они видны любому покупателю в процессе оформления подписки), поэтому их можно
// спокойно вернуть в ответе и потом вручную вписать PAYPAL_PLAN_ID в Netlify env vars.
//
// Вызывается один раз вручную (curl/браузер) после деплоя. Чтобы не плодить дубликаты
// при повторном вызове, сначала проверяет список существующих планов по имени.
const { paypalFetch } = require('./paypal-helpers');

const PRODUCT_NAME = 'Chords and Modes — PRO';
const PLAN_NAME = 'Chords and Modes — PRO (годовая подписка)';

exports.handler = async () => {
  try {
    // 1. Ищем уже созданный план с таким именем, чтобы не плодить дубликаты при повторном вызове.
    const existingPlans = await paypalFetch('/v1/billing/plans?page_size=20&total_required=true');
    const existing = (existingPlans.plans || []).find(p => p.name === PLAN_NAME && p.status === 'ACTIVE');
    if (existing) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alreadyExists: true,
          productId: existing.product_id,
          planId: existing.id,
          message: 'План уже существует, использую его. Впишите planId в Netlify env var PAYPAL_PLAN_ID.'
        })
      };
    }

    // 2. Создаём продукт.
    const product = await paypalFetch('/v1/catalogs/products', {
      method: 'POST',
      body: JSON.stringify({
        name: PRODUCT_NAME,
        description: 'Полная версия музыкального справочника: расширенные стили генератора прогрессий, 12-тактовая форма, экспорт в PDF.',
        type: 'SERVICE',
        category: 'SOFTWARE'
      })
    });

    // 3. Создаём годовой billing plan с автопродлением, бессрочный (total_cycles: 0 = пока не отменят).
    const plan = await paypalFetch('/v1/billing/plans', {
      method: 'POST',
      body: JSON.stringify({
        product_id: product.id,
        name: PLAN_NAME,
        description: 'Автоматическое продление раз в год, $9.99/год. Отмена в любой момент из личного кабинета PayPal.',
        billing_cycles: [
          {
            frequency: { interval_unit: 'YEAR', interval_count: 1 },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: { fixed_price: { value: '9.99', currency_code: 'USD' } }
          }
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          payment_failure_threshold: 3
        }
      })
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        created: true,
        productId: product.id,
        planId: plan.id,
        message: 'Готово. Впишите planId в Netlify env var PAYPAL_PLAN_ID (не секрет, можно вводить обычным текстом).'
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message, details: err.data || null })
    };
  }
};
