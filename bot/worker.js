/*
 * GrindPash bot — Cloudflare Worker.
 * Отвечает на /start приветствием с кнопкой «Зайти на ферму».
 * Токен бота НЕ хранится в коде: он задаётся в Cloudflare как секрет BOT_TOKEN.
 * После деплоя один раз открыть https://<адрес-воркера>/setup — бот подключится.
 */
const APP_URL = 'https://spash4.github.io/grindpash/';
const PHOTO_URL = 'https://spash4.github.io/grindpash/bot/welcome.jpg';
const CHANNEL_URL = 'https://t.me/grindpash';

const KEYBOARD = {
  inline_keyboard: [
    [{ text: '🐂 Зайти на ферму', web_app: { url: APP_URL } }],
    [{ text: '📢 Канал GrindPash', url: CHANNEL_URL }],
  ],
};

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function welcome(name) {
  return (
    '🐂 <b>Добро пожаловать на ферму' + (name ? ', ' + esc(name) : '') + '!</b>\n\n' +
    'GrindPash — ферма, где из телят растят быков. По натурахе, без фармы и сказок.\n\n' +
    'Что внутри:\n' +
    '💪 Программы тренировок с подсказками весов и прогрессией\n' +
    '🐂 Тренер, который не даст халтурить и пропускать тренировки\n' +
    '🍽 КБЖУ и дневник питания со сканером штрихкодов\n' +
    '📸 Техника каждого упражнения в картинках\n' +
    '📊 Отчёт после тренировки: какие мышцы отработал, а какие отстают\n\n' +
    'Жми «Зайти на ферму» — и погнали 👇'
  );
}

const OTHER =
  'Я бот-приложение 🐂 Всё самое нужное — внутри фермы. Жми кнопку 👇';

async function secretOf(token) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('gp-webhook:' + token));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 48);
}

async function tg(env, method, body) {
  const r = await fetch('https://api.telegram.org/bot' + env.BOT_TOKEN + '/' + method, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

const TEXT = { 'content-type': 'text/plain; charset=utf-8' };

export default {
  async fetch(request, env) {
    if (!env.BOT_TOKEN) return new Response('BOT_TOKEN не задан в настройках воркера', { status: 500, headers: TEXT });
    const url = new URL(request.url);
    const secret = await secretOf(env.BOT_TOKEN);

    if (request.method === 'GET' && url.pathname === '/setup') {
      const hook = await tg(env, 'setWebhook', {
        url: url.origin + '/webhook',
        secret_token: secret,
        allowed_updates: ['message'],
      });
      const cmds = await tg(env, 'setMyCommands', {
        commands: [{ command: 'start', description: 'Добро пожаловать на ферму' }],
      });
      const ok = hook.ok && cmds.ok;
      return new Response(ok ? 'Готово: бот подключён ✅' : 'Ошибка: ' + (hook.description || cmds.description), {
        status: ok ? 200 : 500,
        headers: TEXT,
      });
    }

    if (request.method === 'POST' && url.pathname === '/webhook') {
      if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== secret) return new Response('forbidden', { status: 403 });
      let u;
      try { u = await request.json(); } catch (e) { return new Response('bad request', { status: 400 }); }
      const m = u && u.message;
      if (m && m.chat && m.chat.type === 'private') {
        const text = String(m.text || '').trim();
        if (/^\/start(\s|$|@)/.test(text)) {
          const caption = welcome(m.from && m.from.first_name);
          const r = await tg(env, 'sendPhoto', { chat_id: m.chat.id, photo: PHOTO_URL, caption, parse_mode: 'HTML', reply_markup: KEYBOARD });
          if (!r.ok) await tg(env, 'sendMessage', { chat_id: m.chat.id, text: caption, parse_mode: 'HTML', reply_markup: KEYBOARD });
        } else {
          await tg(env, 'sendMessage', { chat_id: m.chat.id, text: OTHER, reply_markup: KEYBOARD });
        }
      }
      return new Response('ok');
    }

    return new Response('GrindPash bot', { status: 404, headers: TEXT });
  },
};
