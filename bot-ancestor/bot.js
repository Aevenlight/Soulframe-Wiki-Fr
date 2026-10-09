const fs = require("fs");
const path = require("path");

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

const STATE_FILE = path.join(__dirname, "state.json");

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
    { type: 10, content: `La Rose Silencieuse • ${dateFr}` },
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

async function main() {
  const now = new Date();
  const todayStart = parisDayStart(now);
  const tomorrowStart = new Date(todayStart.getTime() + 86400000);

  const today = ancestorForDayUTC(todayStart);
  const next = ancestorForDayUTC(tomorrowStart);
  const dateFr = parisDateFr(now);

  const rawUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!rawUrl) {
    console.error("DISCORD_WEBHOOK_URL manquant");
    process.exit(1);
  }

  let urls;
  try {
    urls = webhookUrls(rawUrl);
  } catch {
    console.error("DISCORD_WEBHOOK_URL n'est pas une URL valide");
    process.exit(1);
  }

  const payload = buildPayload(today, next, dateFr);
  const state = readState();

  // Un ancien message en embed ne peut pas être converti en Components V2 : on en recrée un.
  if (state.messageId && state.format === MESSAGE_FORMAT) {
    const res = await fetch(urls.editUrl(state.messageId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      console.log(`Message édité (${dateFr}) : ${today} -> demain : ${next}`);
      writeState({ ...state, updatedAt: now.toISOString(), lastAncestor: today });
      return;
    }

    const detail = await res.text().catch(() => "");
    console.warn(`::warning::Édition impossible (HTTP ${res.status}) ${detail}`);
    console.warn("Création d'un nouveau message à la place.");
  }

  const res = await fetch(urls.createUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`Erreur Discord (HTTP ${res.status}) ${detail}`);
    process.exit(1);
  }

  const created = await res.json();
  if (!created?.id) {
    console.error("Discord n'a pas renvoyé d'id de message.");
    process.exit(1);
  }

  writeState({ messageId: created.id, format: MESSAGE_FORMAT, updatedAt: now.toISOString(), lastAncestor: today });
  console.log(`Nouveau message créé (${dateFr}) : ${today} -> demain : ${next}`);
}

main().catch(err => {
  console.error("Erreur inattendue:", err);
  process.exit(1);
});
