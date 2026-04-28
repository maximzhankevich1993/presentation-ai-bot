const { Telegraf } = require('telegraf');
const axios = require('axios');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// База валют по странам
const currencies = {
    US: { symbol: '$', rate: 1, name: 'USD' },
    GB: { symbol: '£', rate: 0.8, name: 'GBP' },
    DE: { symbol: '€', rate: 0.9, name: 'EUR' },
    FR: { symbol: '€', rate: 0.9, name: 'EUR' },
    IT: { symbol: '€', rate: 0.9, name: 'EUR' },
    ES: { symbol: '€', rate: 0.9, name: 'EUR' },
    RU: { symbol: '₽', rate: 50, name: 'RUB' },
    BY: { symbol: 'Br', rate: 3, name: 'BYN' },
    KZ: { symbol: '₸', rate: 500, name: 'KZT' },
    IN: { symbol: '₹', rate: 50, name: 'INR' },
    BR: { symbol: 'R$', rate: 5, name: 'BRL' },
    JP: { symbol: '¥', rate: 150, name: 'JPY' },
    CN: { symbol: '¥', rate: 7, name: 'CNY' },
    TR: { symbol: '₺', rate: 30, name: 'TRY' },
    PL: { symbol: 'zł', rate: 3.8, name: 'PLN' },
};

// База пользователей
const users = new Map();
const vipSlots = 50;
let vipTaken = 0;

// Получить страну пользователя
async function getUserCountry(ctx) {
    try {
        // Пробуем по IP через ipapi
        const response = await axios.get('https://ipapi.co/json/', { timeout: 3000 });
        return response.data.country_code || 'US';
    } catch (e) {
        // Fallback: по языку Telegram
        const lang = ctx.from?.language_code || 'en';
        if (lang === 'ru') return 'RU';
        if (lang === 'be') return 'BY';
        if (lang === 'kk') return 'KZ';
        return 'US';
    }
}

// Получить валюту пользователя
async function getUserCurrency(ctx) {
    const country = await getUserCountry(ctx);
    return currencies[country] || currencies['US'];
}

// Форматировать цену
function formatPrice(usdPrice, currency) {
    const localPrice = Math.round(usdPrice * currency.rate);
    if (['RUB', 'KZT', 'INR', 'JPY'].includes(currency.name)) {
        return localPrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ' + currency.symbol;
    }
    return currency.symbol + localPrice;
}

// Команда /start
bot.start(async (ctx) => {
    const name = ctx.from.first_name || 'Пользователь';
    const currency = await getUserCurrency(ctx);
    const monthPrice = formatPrice(4.99, currency);
    const yearPrice = formatPrice(49.99, currency);
    
    ctx.reply(
        `👋 Привет, ${name}!\n\n` +
        `Я — бот Презентатор ИИ. Создаю презентации за 1 минуту!\n\n` +
        `🎨 5 презентаций бесплатно\n` +
        `👑 Первые 50 — Premium навсегда (осталось ${vipSlots - vipTaken})\n\n` +
        `💰 Цены в твоей валюте (${currency.symbol}):\n` +
        `• Месяц: ${monthPrice}\n` +
        `• Год: ${yearPrice}\n\n` +
        `Команды:\n` +
        `/new — Создать презентацию\n` +
        `/plans — Тарифы\n` +
        `/referral — Приведи друга\n` +
        `/help — Помощь`
    );
});

// Команда /new
bot.command('new', async (ctx) => {
    await ctx.reply('📝 Введите тему презентации (или /cancel для отмены):');
    
    const handler = async (msgCtx) => {
        const topic = msgCtx.message?.text;
        if (!topic || topic.startsWith('/')) return;
        
        await msgCtx.reply('🤔 Генерирую презентацию...');
        
        try {
            const response = await axios.post('http://localhost:3000/api/generate', {
                topic: topic,
                maxSlides: 5,
            });
            
            const slides = response.data.slides || [];
            let result = `📊 Презентация: "${topic}"\n\n`;
            slides.forEach((slide, i) => {
                result += `📄 Слайд ${i + 1}: ${slide.title}\n`;
                (slide.content || []).forEach(c => { result += `  • ${c}\n`; });
                result += '\n';
            });
            
            await msgCtx.reply(result);
        } catch (e) {
            await msgCtx.reply('❌ Ошибка генерации. Попробуйте позже.');
        }
        
        bot.removeListener('text', handler);
    };
    
    bot.on('text', handler);
});

// Команда /plans
bot.command('plans', async (ctx) => {
    const currency = await getUserCurrency(ctx);
    const month = formatPrice(4.99, currency);
    const year = formatPrice(49.99, currency);
    const teacher = formatPrice(4.99, currency);
    const business = formatPrice(9.99, currency);
    
    ctx.reply(
        `💰 Тарифы (в ${currency.symbol}):\n\n` +
        `🎨 Для всех:\n` +
        `• Бесплатный — 5 презентаций\n` +
        `• Месяц — ${month}\n` +
        `• Год — ${year}\n\n` +
        `🏫 Учителям:\n` +
        `• Teacher Pro — ${teacher}/мес\n\n` +
        `💼 Бизнесу:\n` +
        `• Business — ${business}/мес\n\n` +
        `👑 VIP: Первые 50 — Premium навсегда!\n` +
        `Осталось: ${vipSlots - vipTaken} мест\n\n` +
        `Для активации VIP: /vip`
    );
});

// Команда /vip
bot.command('vip', async (ctx) => {
    const userId = ctx.from.id;
    
    if (users.has(userId) && users.get(userId).vip) {
        return ctx.reply('👑 У вас уже есть VIP-доступ!');
    }
    
    if (vipTaken >= vipSlots) {
        return ctx.reply('😔 Все 50 VIP-мест заняты! Но вы можете оформить Premium.');
    }
    
    vipTaken++;
    users.set(userId, { vip: true, slot: vipTaken, referrals: 0, code: 'FRIEND-' + Math.random().toString(36).substring(2, 6).toUpperCase() });
    
    ctx.reply(
        `🎉 Поздравляем! Вы VIP-пользователь #${vipTaken}!\n\n` +
        `👑 Пожизненный Premium активирован!\n` +
        `♾️ Безлимит презентаций\n` +
        `🎨 Все 30+ фишек\n\n` +
        `Используй /new чтобы создать презентацию!`
    );
});

// Команда /referral
bot.command('referral', (ctx) => {
    const userId = ctx.from.id;
    if (!users.has(userId)) {
        users.set(userId, { referrals: 0, code: 'FRIEND-' + Math.random().toString(36).substring(2, 6).toUpperCase() });
    }
    const user = users.get(userId);
    
    ctx.reply(
        `🎁 Приведи друга — получи 2 месяца Premium!\n\n` +
        `Твой код: ${user.code}\n` +
        `Приглашено: ${user.referrals} друзей\n\n` +
        `Отправь другу:\n\n` +
        `🎨 Создавай крутые презентации с ИИ!\n` +
        `Используй код ${user.code} и получи 1 месяц Premium!\n` +
        `👉 @prezentator_ai_bot`
    );
});

// Команда /help
bot.command('help', (ctx) => {
    ctx.reply(
        `🤖 Помощь:\n\n` +
        `/new — Создать презентацию\n` +
        `/plans — Тарифы (в твоей валюте)\n` +
        `/vip — VIP-доступ\n` +
        `/referral — Приведи друга\n` +
        `/help — Это сообщение\n\n` +
        `Поддержка: @prezentator_support`
    );
});

// Обработка текста
bot.on('text', (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    ctx.reply('Используй /new для создания презентации, или /help для списка команд.');
});

// Запуск
bot.launch().then(() => {
    console.log('🤖 Бот запущен с автоопределением страны и конвертацией валют!');
});