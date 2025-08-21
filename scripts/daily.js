// scripts/daily.js
// Digest RSS → Telegram (HTML) SANS IA
// Format: • Titre (Source) 🔗  (icône cliquable uniquement)
// Une ligne vide entre les items (modifiable)

import Parser from "rss-parser";

// ----- ENV -----
const token  = process.env.TG_TOKEN;
const chatId = process.env.TG_CHAT_ID;

if (!token || !chatId) {
  console.error("❌ Missing TG_TOKEN or TG_CHAT_ID env");
  process.exit(1);
}

// ----- FEEDS -----
const FEEDS = [
  // International
  { name: "Reuters World",    url: "https://feeds.reuters.com/reuters/worldNews" },
  { name: "Reuters Business", url: "https://feeds.reuters.com/reuters/businessNews" },
  { name: "CNBC Top",         url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },

  // Israël
  { name: "Globes",           url: "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=2" },
  { name: "TheMarker",        url: "https://www.themarker.com/cmlink/1.147" },
  { name: "Calcalist",        url: "https://www.calcalist.co.il/GeneralRSS/0,1634,L-8,00.xml" },
  { name: "Ynet",             url: "https://www.ynet.co.il/Integration/StoryRss2.xml" },
  { name: "Times of Israel",  url: "https://www.timesofisrael.com/feed/" },
  { name: "I24News",          url: "https://www.i24news.tv/en/rss" },

  // Marchés (news)
  { name: "Investing.com Latest",      url: "https://www.investing.com/rss/news.rss" },
  { name: "Investing.com Commodities", url: "https://www.investing.com/rss/news_commodities.rss" },
  { name: "Investing.com Forex",       url: "https://www.investing.com/rss/news_forex.rss" }
];

const parser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "Mozilla/5.0 (MenAiotBot/1.0)" },
});

// ----- Utils -----
function escapeHtml(s = "") {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function uniqByTitle(items) {
  const seen = new Set();
  return items.filter((it) => {
    const t = (it.title || "").trim();
    if (!t) return false;
    const k = t.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function pickTop(items, n = 5) {
  return items
    .map((it) => ({
      ...it,
      _ts: it.isoDate ? Date.parse(it.isoDate) : (it.pubDate ? Date.parse(it.pubDate) : 0),
    }))
    .sort((a, b) => b._ts - a._ts)
    .slice(0, n);
}
function ilNow() {
  return new Date().toLocaleString("fr-FR", { timeZone: "Asia/Jerusalem" });
}
function isIsrael(it) {
  const s = `${it.source || ""} ${it.link || ""}`.toLowerCase();
  return /globes|themarker|calcalist|ynet|timesofisrael|i24news/.test(s);
}

// Titre en gras (noir), source en italique, icône 🔗 cliquable uniquement
function fmtItem(it) {
  const t   = escapeHtml(it.title || "");
  const src = escapeHtml(it.source || "");
  const url = escapeHtml(it.link || "");
  return `• <b>${t}</b> <i>(${src})</i> <a href="${url}">🔗</a>`;
}

// ----- Fetch RSS -----
async function fetchAllFeeds() {
  const all = [];
  for (const f of FEEDS) {
    try {
      const feed = await parser.parseURL(f.url);
      const items = (feed.items || []).map((it) => ({
        source: f.name,
        title: (it.title || "").replace(/\s+/g, " ").trim(),
        link: (it.link || it.guid || "").toString().trim(),
        isoDate: it.isoDate || it.pubDate || "",
      }));
      all.push(...items);
    } catch (e) {
      console.error(`⚠️ Feed error [${f.name}]: ${e.message || e}`);
    }
  }
  return all;
}

// ----- Build digest (HTML) -----
function buildDigest(allItems) {
  const IL = uniqByTitle(allItems.filter(isIsrael));
  const WW = uniqByTitle(allItems.filter((x) => !isIsrael(x)));

  const topIL = pickTop(IL, 5);
  const topWW = pickTop(WW, 5);

  const now = ilNow();
  const sep = `<code>──────────</code>`;

  // Ligne vide entre items: join("\n\n"). Pour compact, remplace par join("\n").
  const blockIL = topIL.length ? topIL.map(fmtItem).join("\n\n") : "• (rien de saillant / feed KO)";
  const blockWW = topWW.length ? topWW.map(fmtItem).join("\n\n") : "• (rien de saillant / feed KO)";

  const header = [
    `☀️ <b>Daily digest</b> <i>(RSS auto, sans IA)</i>`,
    `<b>Heure (IL)</b> : ${escapeHtml(now)}`,
  ].join("\n");

  const sections = [
    "🇮🇱 <b>Israël</b>",
    blockIL,
    sep,
    "🌍 <b>Monde / Marchés</b>",
    blockWW,
  ].join("\n");

  const footer = [
    sep,
    `<i>Sources</i> : ${escapeHtml(FEEDS.map((f) => f.name).join(", "))}`
  ].join("\n");

  return [header, "", sections, "", footer].join("\n");
}

// ----- Découpage (éviter de couper du HTML) -----
function chunkHtmlByLines(html, max = 4000) {
  const lines = html.split("\n");
  const chunks = [];
  let cur = "";

  for (const line of lines) {
    if ((cur.length + line.length + 1) > max) {
      if (cur.length > 0) chunks.push(cur);
      cur = line;
    } else {
      cur = cur ? cur + "\n" + line : line;
    }
  }
  if (cur.length > 0) chunks.push(cur);
  return chunks;
}

// ----- Envoi Telegram -----
async function sendTelegram(html) {
  const parts = chunkHtmlByLines(html, 4000);
  for (const chunk of parts) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text: chunk,
      parse_mode: "HTML",
      disable_web_page_preview: true
    };
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((x) => x.json());
    if (!r.ok) throw new Error(`Send failed: ${JSON.stringify(r)}`);
  }
}

// ----- Main -----
(async () => {
  try {
    const items = await fetchAllFeeds();
    const html = buildDigest(items);
    await sendTelegram(html);
    console.log("✔️ Digest envoyé");
  } catch (e) {
    console.error("❌ ERROR:", e.message || e);
    process.exit(1);
  }
})();
