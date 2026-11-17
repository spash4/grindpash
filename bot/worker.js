/*
 * GrindPash bot — Cloudflare Worker.
 * Отвечает на /start приветствием с кнопкой «Зайти на ферму»,
 * на остальные сообщения — короткими фразами тренера.
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

/* Тренер отвечает заготовками: сначала по ключевым словам, иначе — случайная фраза. */
const RULES = [
  [/(стероид|фарм|анабол|гормон роста|sarm|тестостерон.*(уколол|колоть|купить|курс))/i,
    ['Ферма на натурахе. Фарму не обсуждаем. Сначала сон, жратва и зал 🐂',
     'Хочешь фарму — это не ко мне. Я из телят быков делаю по натурахе.']],
  [/(болит|боль|травм|потянул|хруст)/i,
    ['Если реально болит — не геройствуй, сходи к врачу. Если просто ноет после ног — это рост.',
     'Боль в суставе — стоп и к врачу. Крепатура в мышцах — нормально, работаем дальше.']],
  [/(привет|здаров|здравств|хай\b|салам|^(ку|йо|хей)[!.)\s]*$|добр(ый|ое|ого) (день|утро|вечер|утра|вечера))/i,
    ['Здорово, бычара. Поздоровались — и в зал 🐂', 'Привет. Тренировку уже сделал? Если нет — чего пишешь?']],
  [/(как дела|как ты|как жизнь|что делаешь|чё делаешь)/i,
    ['У меня всё по плану. А у тебя тренировка по плану? Проверь 👇', 'Стою, жду, когда ты придёшь в зал.']],
  [/(спасибо|спс|благодар|респект)/i,
    ['Спасибо скажешь, когда шорты станут малы в бёдрах.', 'Не благодари. Просто не пропускай тренировки.']],
  [/(креатин)/i,
    ['Креатин — 3–5 г в день, каждый день, без перерывов. А теперь в зал.']],
  [/(похуд|сушк|жир|скинуть|сбросить)/i,
    ['Дефицит калорий, белок и зал. Калории посчитает ферма 👇', 'Жир уходит на кухне, а форма делается в зале. Записывай еду в приложении.']],
  [/(масс|набрать|набор|не расту|расти)/i,
    ['Профицит, белок и тяжёлые подходы с прогрессией. Программа внутри 👇', 'Не растёшь — значит мало ешь или мало пашешь. Проверь КБЖУ в приложении.']],
  [/(лень|не хочу|устал|нет сил|нет мотивац|потом|завтра)/i,
    ['Лень — не диагноз. Встал, оделся, пошёл 🐂', '«Завтра» — любимое слово телят. Быки идут сегодня.', 'Мотивация приходит после первого подхода. Иди делай.']],
  [/(бел(ок|ка|ку|ке|ком)|протеин)/i,
    ['Белок — 1,6–2 г на кило веса в день. Норму посчитает ферма 👇']],
];
const ANY = [
  'Хватит вопросов, пиздуй в зал 🐂',
  'Я не для переписки. Я для того, чтобы ты пахал.',
  'Пока ты пишешь, кто-то жмёт. Давай в зал.',
  'Бык не разговаривает. Бык тренируется.',
  'Сообщение получил. Тренировку — нет. Исправляй 👇',
  'Вопросы потом. Сначала подход.',
  'Ты сюда поболтать пришёл или расти?',
  'Меньше слов — больше повторений.',
  'Это не чат поддержки, это ферма. Работать!',
  'Записал. А теперь закрой телегу и иди тягай.',
  'Тренер занят: смотрит, как ты пропускаешь день ног.',
  'Есть силы печатать — есть силы на подход.',
];
const NOTEXT = [
  'Стикерами мышцы не накачаешь 🐂',
  'Голосовые не слушаю. Слушаю только звон блинов.',
  'Красиво. А теперь в зал.',
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function reply(text) {
  if (!text) return pick(NOTEXT);
  for (const [re, answers] of RULES) if (re.test(text)) return pick(answers);
  return pick(ANY);
}
const APP_ONLY = { inline_keyboard: [[{ text: '🐂 Зайти на ферму', web_app: { url: APP_URL } }]] };

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
          await tg(env, 'sendMessage', { chat_id: m.chat.id, text: reply(text), reply_markup: APP_ONLY });
        }
      }
      return new Response('ok');
    }

    return new Response('GrindPash bot', { status: 404, headers: TEXT });
  },
};
