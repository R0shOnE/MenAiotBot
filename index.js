// index.js
import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";

dotenv.config();

const TOKEN = process.env.TELEGRAM_TOKEN;
if (!TOKEN) {
  console.error("❌ TELEGRAM_TOKEN manquant. Ajoute-le dans .env");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "👋 Bot en ligne ! Envoie 'hello' ou /daily pour tester."
  );
});

bot.on("message", (msg) => {
  if (!msg.text) return;
  const text = msg.text.toLowerCase();
  if (text.includes("hello")) {
    bot.sendMessage(msg.chat.id, "Hello 👋");
  }
});

bot.onText(/\/daily/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "☀️ Daily (exemple) :\n- Marchés: TBD\n- TASE/US/Europe/Asie: TBD\n- Macro & géopolitique: TBD"
  );
});
