// scripts/daily.js
import Parser from "rss-parser";

// --- Config secrets depuis GitHub Actions ---
const token  = process.env.TG_TOKEN;
const chatId = process.env.TG_CHAT_ID;

if (!token || !chatId) {
  console.error("❌ Missing TG_TOKEN or TG_CHAT_ID env");
  process.exit(1);
}

// --- Feeds plus tolérants côté GitHub Actions ---
const FEEDS = [
  // International
  { name: "Reuters World",    url: "https://feeds.reuters.com/reuters/worldNews" },
  { name: "Reuters Business", url: "https://feeds.reuters.com/reuters/businessNews" },

  // Israël (hébreu / anglais)
  { name: "Globes",           url: "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=2" },
  { name: "Ynet",             url: "https://www.ynet.co.il/Integration/StoryRss2.xml" },
  { name: "Times of Israel",  url: "https://www.timesofisrael.com/feed/" },

  // Marchés / économie global
  { name: "CNBC Top",         url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
];

// Limites/paramètres
const FEED_ITEM_LIMIT = 10;   // max items pris par feed
const TOP_PER_BUCKET  = 5;    // combien on garde pour IL et WW
const FETCH_TIMEOUT_MS = 15000;

// Parser RSS
const parser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "Mozilla/5.0 (MenAiotBot/1.0)" },
});

// --- Utils ---
function isIsraelSource(name, link) {
  const s = `${name || ""} ${link || ""}`;
  return /globes\.co\.il|themarker\.com|bizportal\.co\.il|calcalist\.co\.il|ynet\.co\.il|timesofisrael\.com|haaretz\.com|israelhayom\.co\.il/i.test(s);
}

function uniqByTitle(items) {
  const seen = new Set();
  return items.filter((it) => {
    const t = (it.title || "").trim();
    if (!t) return false;
    const key = t.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
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

function formatILNow() {
  // Pas besoin de plugin dayjs — on utilise Intl pour le TZ
  try {
    const fmt = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return fmt.format(new Date());
  } catch {
    return new Date().toLocaleString("fr-FR", { timeZone: "Asia/Jerusalem" });
  }
}

// --- Fetch des feeds ---
async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    // rss-parser fera le fetch par lui-même; on laisse juste le timeout global agir
    return await parser.parseURL(url);
  } finally {
    clearTimeout(t);
  }
}

async function fetchAllFeeds() {
  const results = [];
  for (const f of FEEDS) {
    try {
      const feed = await fetchWithTimeout(f.url, FETCH_TIMEOUT_MS);
      const items = (feed.items || [])
        .slice(0, FEED_ITEM_LIMIT)
        .map((it) => ({
          source: f.name,
          title: (it.title || "").replace(/\s+/g, " ").trim(),
          link: (it.link || it.guid || "").toString().trim(),
          isoDate: it.isoDate || it.pubDate || "",
        }));
      results.push(...items);
    } catch (e) {
      console.error(`⚠️ Feed error [${f.name}]: ${e.message || e}`);
    }
  }
  return results;
}

// --- Construction du digest (texte brut, pas de Markdown) ---
function buildDigest(allItems) {
  const IL = uniqByTitle(allItems.filter((it) => isIsraelSource(it.source, it.link)));
  const WW = uniqByTitle(allItems.filter((it) => !isIsraelSource(it.source, it.link)));

  const topIL = pickTop(IL, TOP_PER_BUCKET);
  const topWW = pickTop(WW, TOP_PER_BUCKET);

  const nowIL = formatILNow();

  const fmt = (arr) =>
    arr.map((it) => `• ${it.title}\n  ${it.link}`).join("\n");

  const lines = [
    "☀️ Daily digest (RSS auto)",
    `Heure (IL): ${nowIL}`,
    "",
    "Israël",
    topIL.length ? fmt(topIL) : "• (rien de saillant / feed KO)",
    "",
    "US/Europe/Asie",
    topWW.length ? fmt(topWW) : "• (rien de saillant / feed KO)",
    "",
    "Note: version RSS (sans IA).",
  ];

  return lines.join("\n");
}

// --- Envoi Telegram (sans parse_mode, avec découpage < 4096) ---
async function sendTelegram(text) {
  const MAX = 4000; // marge sous 4096
  const parts = [];
  for (let i = 0; i < text.length; i += MAX) {
    parts.push(text.slice(i, i + MAX));
  }

  for (const chunk of parts) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text: chunk,
      disable_web_page_preview: true,
    };
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((x) => x.json());

    if (!r.ok) {
      throw new Error(`Send failed: ${JSON.stringify(r)}`);
    }
  }
}

// --- Main ---
(async () => {
  try {
    const items = await fetchAllFeeds();
    const text = buildDigest(items);
    await sendTelegram(text);
    console.log("✔️ Digest envoyé");
  } catch (e) {
    console.error("❌ ERROR:", e.message || e);
    process.exit(1);
  }
})();
