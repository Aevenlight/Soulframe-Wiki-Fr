const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CYCLE_HOURS = 134.59;
const ORIGIN = new Date("2026-10-01T00:00:00Z");

const ROTATION = [
  ["Verminia", 0.22],
  ["Orlick", 19.03],
  ["Garren", 37.85],
  ["Bromius", 56.2],
  ["Orengall", 75.02],
  ["Oracle des Vallons", 93.62],
  ["Zénith", 101.13],
  ["Tuvalkane", 115.72]
];

const IMG_BASE = "https://raw.githubusercontent.com/Aevenlight/Soulframe-Wiki-Fr/main/bot-ancestor/images";

const ANCESTOR_IMAGES = {
  "Bromius": `${IMG_BASE}/bromius.png`,
  "Orengall": `${IMG_BASE}/orengall.png`,
  "Zénith": `${IMG_BASE}/zenith.png`,
  "Verminia": `${IMG_BASE}/verminia.png`,
  "Orlick": `${IMG_BASE}/orlick.png`,
  "Garren": `${IMG_BASE}/garren.png`,
  "Tuvalkane": `${IMG_BASE}/tuvalkane.png`
};

function imageForAncestor(name) {
  return ANCESTOR_IMAGES[name];
}

const WIKI_BASE = "https://soulframewiki.fr/personnages";

const ANCESTOR_WIKI = {
  "Verminia": `${WIKI_BASE}/verminia`,
  "Orlick": `${WIKI_BASE}/orlick-the-bicameral`,
  "Tuvalkane": `${WIKI_BASE}/steelsinger-tulvakane`,
  "Bromius": `${WIKI_BASE}/bromius`,
  "Garren": `${WIKI_BASE}/garren-rood`,
  "Orengall": `${WIKI_BASE}/orengall`
};

const STATE_FILE = path.join(__dirname, "state_patreon.json");

function parisDayStart(date) {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date);
  return new Date(`${iso}T00:00:00Z`);
}

function parisDateFr(date) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric"
  }).format(date);
}

function ancestorForDayUTC(dayUTC) {
  const hours = (dayUTC - ORIGIN) / 3600000;
  const phase = ((hours % CYCLE_HOURS) + CYCLE_HOURS) % CYCLE_HOURS;
  let name = ROTATION[ROTATION.length - 1][0];
  for (const [ancestor, startHour] of ROTATION) {
    if (phase >= startHour) name = ancestor;
  }
  return name;
}

function webhookUrls(raw) {
  const src = new URL(raw.trim());
  const base = `${src.origin}${src.pathname.replace(/\/+$/, "")}`;

  const withParams = (target) => {
    const u = new URL(target);
    src.searchParams.forEach((v, k) => u.searchParams.set(k, v));
    return u;
  };

  const createUrl = withParams(base);
  createUrl.searchParams.set("wait", "true");
  createUrl.searchParams.set("with_components", "true");

  const editUrl = (id) => {
    const u = withParams(`${base}/messages/${id}`);
    u.searchParams.set("with_components", "true");
    return u.toString();
  };

  return { createUrl: createUrl.toString(), editUrl };
}

function parseWebhooks(raw) {
  const webhooks = [];
  const seen = new Set();

  for (const line of raw.split(/\r?\n/)) {
    const value = line.trim();
    if (!value || value.startsWith("#")) continue;

    let url;
    try {
      url = new URL(value);
    } catch {
      console.warn("::warning::Une ligne de PATREON_WEBHOOKS n'est pas une URL valide, ignorée.");
      continue;
    }

    const match = url.pathname.match(/\/api\/(?:v\d+\/)?webhooks\/(\d+)\/[\w-]+/);
    if (!match || !/(^|\.)discord(app)?\.com$/.test(url.hostname)) {
      console.warn("::warning::Une ligne de PATREON_WEBHOOKS n'est pas un webhook Discord, ignorée.");
      continue;
    }

    console.log(`::add-mask::${value}`);

    const key = crypto.createHash("sha256").update(match[1]).digest("hex").slice(0, 8);
    if (seen.has(key)) continue;
    seen.add(key);

    webhooks.push({ key, urls: webhookUrls(value) });
  }

  return webhooks;
}

const COMPONENTS_V2_FLAG = 1 << 15;
const MESSAGE_FORMAT = "components-v2";

function buildPayload(today, next, dateFr) {
  const container = [];

  const todayImage = imageForAncestor(today);
  if (todayImage) {
    container.push({ type: 12, items: [{ media: { url: todayImage } }] });
  }

  const buttons = [];
  const wikiUrl = ANCESTOR_WIKI[today];
  if (wikiUrl) {
    buttons.push({ type: 2, style: 5, label: "Voir les Grâces", url: wikiUrl });
  }
  buttons.push({
    type: 2,
    style: 5,
    label: "Voir les emplacements",
    url: "https://soulmap.avakot.org/P16?loc=Blessed+Meetings"
  });

  container.push(
    {
      type: 10,
      content:
        "## <:P_Quest:1397970206902714580> Ancêtre du jour\n\n" +
        `L'ancêtre disponible aujourd'hui est : **${today}**`
    },
    { type: 14, divider: true, spacing: 2 },
    { type: 10, content: `-# Demain, attendez-vous à voir : **${next}**` },
    { type: 14, divider: true, spacing: 2 },
    { type: 10, content: `<a:A_Rose:1471803039416451112> La Rose Silencieuse • ${dateFr}` },
    { type: 1, components: buttons }
  );

  return {
    flags: COMPONENTS_V2_FLAG,
    components: [{ type: 17, accent_color: 16228864, components: container }]
  };
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function discordFetch(url, method, payload) {
  const options = {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  };

  let res = await fetch(url, options);
  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    await sleep(Math.ceil((body.retry_after ?? 1) * 1000));
    res = await fetch(url, options);
  }
  return res;
}

async function postToWebhook(webhook, entry, payload) {
  if (entry?.messageId && entry.format === MESSAGE_FORMAT) {
    const res = await discordFetch(webhook.urls.editUrl(entry.messageId), "PATCH", payload);
    if (res.ok) return { messageId: entry.messageId, edited: true };

    console.warn(`::warning::[${webhook.key}] Édition impossible (HTTP ${res.status}), création d'un nouveau message.`);
  }

  const res = await discordFetch(webhook.urls.createUrl, "POST", payload);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${detail}`);
  }

  const created = await res.json();
  if (!created?.id) throw new Error("Discord n'a pas renvoyé d'id de message.");

  return { messageId: created.id, edited: false };
}

async function main() {
  const now = new Date();
  const todayStart = parisDayStart(now);
  const tomorrowStart = new Date(todayStart.getTime() + 86400000);

  const today = ancestorForDayUTC(todayStart);
  const next = ancestorForDayUTC(tomorrowStart);
  const dateFr = parisDateFr(now);

  const raw = process.env.PATREON_WEBHOOKS;
  if (!raw || !raw.trim()) {
    console.log("PATREON_WEBHOOKS vide : aucun serveur Patreon à mettre à jour.");
    return;
  }

  const webhooks = parseWebhooks(raw);
  if (!webhooks.length) {
    console.error("Aucun webhook valide dans PATREON_WEBHOOKS.");
    process.exit(1);
  }

  const payload = buildPayload(today, next, dateFr);
  const state = readState();
  const servers = {};
  let failures = 0;

  for (const webhook of webhooks) {
    try {
      const result = await postToWebhook(webhook, state.servers?.[webhook.key], payload);
      servers[webhook.key] = { messageId: result.messageId, format: MESSAGE_FORMAT, updatedAt: now.toISOString() };
      console.log(`[${webhook.key}] Message ${result.edited ? "édité" : "créé"}`);
    } catch (err) {
      failures++;
      if (state.servers?.[webhook.key]) servers[webhook.key] = state.servers[webhook.key];
      console.warn(`::warning::[${webhook.key}] Envoi impossible : ${err.message}`);
    }
    await sleep(500);
  }

  writeState({ updatedAt: now.toISOString(), lastAncestor: today, servers });

  console.log(`${dateFr} : ${today} -> demain : ${next} | ${webhooks.length - failures}/${webhooks.length} serveur(s) à jour`);

  if (failures === webhooks.length) process.exit(1);
}

main().catch(err => {
  console.error("Erreur inattendue:", err);
  process.exit(1);
});
