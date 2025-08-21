// scripts/daily.js
const token  = process.env.TG_TOKEN;
const chatId = process.env.TG_CHAT_ID;

if (!token || !chatId) {
  console.error("❌ Missing TG_TOKEN or TG_CHAT_ID");
  process.exit(1);
}

const nowIL = new Date().toLocaleString("fr-FR", { timeZone: "Asia/Jerusalem" });
const text = [
  "☀️ Daily digest (prototype)",
  `Heure (IL) : ${nowIL}`,
  "• Marchés / macro : (à compléter)",
  "• Israël : (à compléter)",
  "• US/Europe/Asie : (à compléter)",
  "• Risk radar : (à compléter)"
].join("\n");

const url = `https://api.telegram.org/bot${token}/sendMessage`;
fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ chat_id: chatId, text })
})
  .then(r => r.json())
  .then(j => {
    if (!j.ok) throw new Error(JSON.stringify(j));
    console.log("✔️ Message envoyé.");
  })
  .catch(e => { console.error("❌ Envoi échoué:", e.message); process.exit(1); });
