const fs = require("fs");
const path = require("path");

const ANCESTORS = [
  "Bromius", "Orengall", "Zenith", "Verminia", "Orlick", "Garren Rood", "Bromius",
  "Zenith (ou Oracle des Vallons - créneau partagé, à confirmer)", "Tuvalkane", "Verminia",
  "Orlick", "Bromius", "Orengall", "Zenith", "Tuvalkane", "Orlick", "Garren Rood", "Bromius",
  "Orengall", "Tuvalkane", "Verminia", "Orlick", "Garren Rood", "Orengall", "Zenith",
  "Tuvalkane", "Verminia", "Garren Rood"
];

const IMG_BASE = "https://raw.githubusercontent.com/Aevenlight/Soulframe-Wiki-Fr/main/bot-ancestor/images";

const ANCESTOR_IMAGES = {
  "Bromius": `${IMG_BASE}/bromius.png`,
  "Orengall": `${IMG_BASE}/orengall.png`,
  "Zenith": `${IMG_BASE}/zenith.png`,
  "Verminia": `${IMG_BASE}/verminia.png`,
  "Orlick": `${IMG_BASE}/orlick.png`,
  "Garren Rood": `${IMG_BASE}/garren.png`,
  "Tuvalkane": `${IMG_BASE}/tuvalkane.png`,
  "Oracle des Vallons": `${IMG_BASE}/oracle.png`
};

function imageForAncestor(name) {
  if (name.startsWith("Zenith")) return ANCESTOR_IMAGES["Zenith"];
  return ANCESTOR_IMAGES[name];
}

const PIVOT = new Date("2026-08-31T00:00:00Z");
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
  const diffDays = Math.round((dayUTC - PIVOT) / 86400000);
  return ANCESTORS[((diffDays % 28) + 28) % 28];
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

  return {
    createUrl: createUrl.toString(),
    editUrl: (id) => withParams(`${base}/messages/${id}`).toString()
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

  const embed = {
    title: "<:P_Quest:1397970206902714580> Ancêtre du Jour",
    url: "https://discord.com/invite/rosesilencieuse",
    description:
      `L'ancêtre disponible aujourd'hui est : **${today}**\n` +
      `-# Demain, attendez-vous à voir : **${next}**`,
    color: 0xdd9f38,
    footer: {
      text: `La Rose Silencieuse • ${dateFr}`,
      icon_url: "https://assets.super.so/2eeb3c9d-609b-4254-88b2-95538e16304b/uploads/favicon/08a70f7b-6515-4d74-b8b2-a27abd94276f.png"
    }
  };

  const todayImage = imageForAncestor(today);
  if (todayImage) embed.thumbnail = { url: todayImage };

  const payload = { embeds: [embed] };
  const state = readState();

  if (state.messageId) {
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

  writeState({ messageId: created.id, updatedAt: now.toISOString(), lastAncestor: today });
  console.log(`Nouveau message créé (${dateFr}) : ${today} -> demain : ${next}`);
}

main().catch(err => {
  console.error("Erreur inattendue:", err);
  process.exit(1);
});
