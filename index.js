require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.TELEGRAM_TOKEN;
if (!TOKEN) {
  console.error('❌ TELEGRAM_TOKEN manquant. Ajoute-le dans .env');
  process.exit(1);
}

// mode polling = le bot “écoute” vos messages (pas besoin d’URL ou de serveur)
const bot = new TelegramBot(TOKEN, { polling: true });

// Test basique
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "👋 Bot en ligne ! Envoie 'hello' ou /daily pour tester.");
});

// Réponse simple à “hello”
bot.on('message', (msg) => {
  if (!msg.text) return;
  const text = msg.text.toLowerCase();
  if (text.includes('hello')) {
    bot.sendMessage(msg.chat.id, "Hello 👋");
  }
});

// Commande /daily (placeholder, on branchera plus tard le digest auto)
bot.onText(/\/daily/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "☀️ Daily (exemple) :\n- Marchés: TBD\n- TASE/US/Europe/Asie: TBD\n- Macro & géopolitique: TBD"
  );
});
