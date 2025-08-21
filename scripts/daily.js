// scripts/daily.js
import Parser from "rss-parser";
import dayjs from "dayjs";

const token  = process.env.TG_TOKEN;
const chatId = process.env.TG_CHAT_ID;

if (!token || !chatId) {
  console.error("❌ Missing TG_TOKEN or TG_CHAT_ID env");
  process.exit(1);
}

// ----- Feeds à parser (tu peux en ajouter/enlever)
const FEEDS = [
  // International
  { name: "Reuters Top", url: "https://www.reuters.com/world/rss" },
  { name: "Reuters Business", url: "https://www.reuters.com/markets/rss" },
  // Israël (hébreu)
  { name: "Globes", url: "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=2" },
  { name: "TheMarker", url: "https://www.themarker.com/cmlink/1.147" },
  // Marchés/économie global
  { name: "Investing.com Latest", url: "https://www.investing.com/rss/news.rss" }
];

const parser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "Mozilla/5.0 (MenAiotBot/1.0)" },
});

function isIsraelSource(name, link) {
  const s = (name || "") + " " + (link || "");
  return /globes\.co\.il|themarker\.com|bizportal\.co\.il|calcalist\.co\.il/i.test(s);
}

function uniqByTitle(items) {
  const seen = new Set();
  return items.filter(it => {
    const t = (it.title || "").trim();
    if (!t || seen.has(t.toLowerCase())) return false;
    seen.add(t.toLowerCase());
    return true;
  });
}

function pickTop(items, n = 4) {
  // Trier par date si dispo, sinon garder l’ordre
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
  const IL = uniqByTitle(allItems.filter(it => isIsraelSource(it.source, it.link)));
  const WW = uniqByTitle(allItems.filter(it => !isIsraelSource(it.source, it.link)));

  const topIL = pickTop(IL, 5);
  const topWW = pickTop(WW, 5);

  const nowIL = dayjs().tz ? dayjs().tz("Asia/Jerusalem").format("YYYY-MM-DD HH:mm") 
                           : new Date().toLocaleString("fr-FR", { timeZone: "Asia/Jerusalem" });

  const fmt = (arr) =>
    arr.map(it => `• ${it.title}\n  ${it.link}`).join("\n");

  return [
    "☀️ Daily digest (RSS auto)",
    `Heure (IL) : ${nowIL}`,
    "",
    "*Israël*",
    topIL.length ? fmt(topIL) : "• (rien de saillant / feed KO)",
    "",
    "*US/Europe/Asie*",
    topWW.length ? fmt(topWW) : "• (rien de saillant / feed KO)",
    "",
    "_Note_: version RSS (sans IA). On peut ajouter des API/IA ensuite."
  ].join("\n");
}

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    disable_web_page_preview: true
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(x => x.json());
  if (!r.ok) throw new Error(`Send failed: ${JSON.stringify(r)}`);
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
