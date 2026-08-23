// POST /.netlify/functions/banners-save
// Публикует новый список рекламных баннеров (кликабельные картинки со ссылками
// на курсы/вебинары Елены). У приложения нет базы данных, поэтому единственный
// пользователь (Аккорд, Лад, Прогрессии и т.д. читают файл напрямую).
//
// Как это работает: функция коммитит обновлённый banners.json прямо в GitHub-репозиторий
// через GitHub Contents API. Репозиторий подключён к Netlify с автопубликацией — как только
// коммит попадёт в ветку, Netlify сам пересоберёт и выложит сайт (обычно 15-30 секунд).
// Отдельной админ-панели с логином нет — вместо этого простая защита паролем
// (переменная окружения BANNER_ADMIN_PASSWORD), которую вводят на странице admin-banners.html.
//
// Нужные переменные окружения в Netlify:
//   BANNER_ADMIN_PASSWORD — пароль для входа в admin-banners.html
//   GITHUB_TOKEN          — fine-grained personal access token с правом Contents: Read and write
//                           только для этого репозитория
//   GITHUB_REPO           — "владелец/репозиторий", например "LenaPecherskyi/chord-scale-app.1"
//   GITHUB_BRANCH         — необязательно, по умолчанию "main"

const GITHUB_API = 'https://api.github.com';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Некорректный JSON в теле запроса' }) };
  }

  const { password, banners } = payload;

  const adminPassword = process.env.BANNER_ADMIN_PASSWORD;
  if (!adminPassword) {
    return { statusCode: 500, body: JSON.stringify({ error: 'BANNER_ADMIN_PASSWORD не настроен в переменных окружения Netlify' }) };
  }
  if (!password || password !== adminPassword) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Неверный пароль' }) };
  }

  if (!Array.isArray(banners)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Поле banners должно быть массивом' }) };
  }
  if (banners.length > 12) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Слишком много баннеров за раз (максимум 12)' }) };
  }
  for (const b of banners) {
    if (!b || typeof b.image !== 'string' || !b.image.startsWith('data:image/')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'У каждого баннера должна быть картинка в формате data:image/...' }) };
    }
    if (typeof b.link !== 'string' || !/^https?:\/\//i.test(b.link)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'У каждого баннера должна быть ссылка, начинающаяся с http:// или https://' }) };
    }
    if (b.image.length > 2_000_000) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Одна из картинок слишком большая после сжатия — попробуйте выбрать файл поменьше' }) };
    }
    if (b.lang !== undefined && b.lang !== '' && !['ru', 'uk', 'en'].includes(b.lang)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Недопустимое значение языка баннера' }) };
    }
  }

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';
  if (!token || !repo) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GITHUB_TOKEN / GITHUB_REPO не настроены в переменных окружения Netlify' }) };
  }

  const path = 'banners.json';
  const apiUrl = `${GITHUB_API}/repos/${repo}/contents/${path}`;
  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'chord-scale-app-banners-save'
  };

  // Нужен текущий sha файла — GitHub требует его при перезаписи существующего файла.
  let sha;
  try {
    const getRes = await fetch(`${apiUrl}?ref=${branch}`, { headers: ghHeaders });
    if (getRes.ok) {
      const getData = await getRes.json();
      sha = getData.sha;
    } else if (getRes.status !== 404) {
      const errText = await getRes.text();
      throw new Error(`GitHub GET ${getRes.status}: ${errText}`);
    }
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: `Не удалось прочитать текущий banners.json на GitHub: ${err.message}` }) };
  }

  const content = JSON.stringify({ banners }, null, 2);
  const contentBase64 = Buffer.from(content, 'utf-8').toString('base64');

  try {
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: { ...ghHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Обновление баннеров (${banners.length} шт.) через панель управления`,
        content: contentBase64,
        branch,
        ...(sha ? { sha } : {})
      })
    });
    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error(`GitHub PUT ${putRes.status}: ${errText}`);
    }
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: `Не удалось сохранить banners.json на GitHub: ${err.message}` }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, count: banners.length })
  };
};
