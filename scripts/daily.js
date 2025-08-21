// scripts/daily.js
// Digest RSS → Telegram (sans IA)

import Parser from "rss-parser";

const token  = process.env.TG_TOKEN;
const chatId = process.env.TG_CHAT_ID;

if (!token || !chatId) {
  console.error("❌ Missing TG_TOKEN or TG_CHAT_ID env");
  process.exit(1);
}

// ===== Feeds optimisés =====
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

  // Marchés
  { name: "Investing.com Latest",       url: "https://www.investing.com/rss/news.rss" },
  { name: "Investing.com Commodities",  url: "https://www.investing.com/rss/news_commodities.rss" },
  { name: "Investing.com Forex",        url: "https://www.investing.com/rss/news_forex.rss" }
];

const parser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "Mozilla/5.0 (MenAiotBot/1.0)" },
});

function uniqByTitle(items) {
  const seen = new Set();
  return items.filter(it => {
    const t = (it.title || "").trim();
    if (!t || seen.has(t.toLowerCase())) return false;
    seen.add(t.toLowerCase());
    return true;
  });
}

function pickTop(items, n = 5) {
  return items
    .map(it => ({
      ...it,
      _ts: it.isoDate ? Date.parse(it.isoDate) : (it.pubDate ? Date.parse(it.pubDate) : 0),
    }))
    .sort((a, b) => b._ts - a._ts)
    .slice(0, n);
}

async function fetchAllFeeds() {
  const results = [];
  for (const f of FEEDS) {
    try {
      const feed = await parser.parseURL(f.url);
      const items = (feed.items || []).map(it => ({
        source: f.name,
        title: (it.title || "").replace(/\s+/g, " ").trim(),
        link: it.link || it.guid || "",
        isoDate: it.isoDate || it.pubDate || "",
      }));
      results.push(...items);
    } catch (e) {
      console.error(`⚠️ Feed error [${f.name}]:`, e.message);
    }
  }
  return results;
}

function buildDigest(allItems) {
  const IL = uniqByTitle(allItems.filter(it => /globes|themarker|calcalist|ynet|timesofisrael|i24news/i.test(it.source + it.link)));
  const WW = uniqByTitle(allItems.filter(it => !/globes|themarker|calcalist|ynet|timesofisrael|i24news/i.test(it.source + it.link)));

  const topIL = pickTop(IL, 5);
  const topWW = pickTop(WW, 5);

  const nowIL = new Date().toLocaleString("fr-FR", { timeZone: "Asia/Jerusalem" });

  const fmt = (arr) =>
    arr.map(it => `• ${it.title}\n  ${it.link}`).join("\n");

  return [
    "☀️ Daily digest (RSS auto, sans IA)",
    `Heure (IL) : ${nowIL}`,
    "",
    "Israël",
    topIL.length ? fmt(topIL) : "• (rien de saillant / feed KO)",
    "",
    "Monde / Marchés",
    topWW.length ? fmt(topWW) : "• (rien de saillant / feed KO)"
  ].join("\n");
}

async function sendTelegram(text) {
  const MAX = 4000; // limite Telegram
  for (let i = 0; i < text.length; i += MAX) {
    const chunk = text.slice(i, i + MAX);
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text: chunk,
      disable_web_page_preview: true
    };
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(x => x.json());
    if (!r.ok) throw new Error(`Send failed: ${JSON.stringify(r)}`);
  }
}

(async () => {
  try {
    const items = await fetchAllFeeds();
    const text = buildDigest(items);
    await sendTelegram(text);
    console.log("✔️ Digest envoyé");
  } catch (e) {
    console.error("❌ ERROR:", e.message);
    process.exit(1);
  }
})();
