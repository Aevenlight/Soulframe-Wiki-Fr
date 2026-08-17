const fs = require("fs");
const path = require("path");

const ANCESTORS = [
  "Bromius", "Orengall", "Zenith", "Verminia", "Orlick", "Garren Rood", "Bromius",
  "Zenith (ou Oracle des Vallons - créneau partagé, à confirmer)", "Tuvalkane", "Verminia",
  "Orlick", "Bromius", "Orengall", "Zenith", "Tuvalkane", "Orlick", "Garren Rood", "Bromius",
  "Orengall", "Tuvalkane", "Verminia", "Orlick", "Garren Rood", "Orengall", "Zenith",
  "Tuvalkane", "Verminia", "Garren Rood"
];

const ANCESTOR_IMAGES = {
  "Bromius": "https://raw.githubusercontent.com/Aevenlight/Soulframe-Wiki-Fr/main/bot-ancestor/images/bromius.png",
  "Orengall": "https://raw.githubusercontent.com/Aevenlight/Soulframe-Wiki-Fr/main/bot-ancestor/images/orengall.png",
  "Zenith": "https://raw.githubusercontent.com/Aevenlight/Soulframe-Wiki-Fr/main/bot-ancestor/images/zenith.png",
  "Verminia": "https://raw.githubusercontent.com/Aevenlight/Soulframe-Wiki-Fr/main/bot-ancestor/images/verminia.png",
  "Orlick": "https://raw.githubusercontent.com/Aevenlight/Soulframe-Wiki-Fr/main/bot-ancestor/images/orlick.png",
  "Garren Rood": "https://raw.githubusercontent.com/Aevenlight/Soulframe-Wiki-Fr/main/bot-ancestor/images/garren.png",
  "Tuvalkane": "https://raw.githubusercontent.com/Aevenlight/Soulframe-Wiki-Fr/main/bot-ancestor/images/tuvalkane.png",
  "Oracle des Vallons": "https://raw.githubusercontent.com/Aevenlight/Soulframe-Wiki-Fr/main/bot-ancestor/images/oracle.png"
};


function imageForAncestor(name) {
  if (name.startsWith("Zenith")) return ANCESTOR_IMAGES["Zenith"];
  return ANCESTOR_IMAGES[name];
}

const PIVOT = new Date("2026-08-31T00:00:00Z"); 

function parisDateString(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function ancestorForDate(date) {
  const dayUTC = new Date(parisDateString(date) + "T00:00:00Z");
  const diffDays = Math.round((dayUTC - PIVOT) / 86400000);
  const index = ((diffDays % 28) + 28) % 28;
  return ANCESTORS[index];
}

// Fichier qui garde en mémoire l'id du message Discord à éditer d'un run à l'autre.
// Doit être committé dans le repo par le workflow GitHub Actions après chaque run.
const STATE_FILE = path.join(__dirname, "state.json");

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
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const today = ancestorForDate(now);
  const next = ancestorForDate(tomorrow);

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("DISCORD_WEBHOOK_URL manquant");
    process.exit(1);
  }

  const embed = {
    title: "<:P_Quest:1397970206902714580> Ancêtre du Jour",
    url: "https://discord.com/invite/rosesilencieuse",
    description: `L'ancêtre disponible aujourd'hui est : **${today}**\n\nDemain, attendez-vous à voir : **${next}**`,
    color: 0xdd9f38,
    footer: {
      text: "La Rose Silencieuse",
      icon_url: "https://assets.super.so/2eeb3c9d-609b-4254-88b2-95538e16304b/uploads/favicon/08a70f7b-6515-4d74-b8b2-a27abd94276f.png"
    }
  };

  const todayImage = imageForAncestor(today);
  if (todayImage) {
    embed.thumbnail = { url: todayImage };
  }

  const payload = { embeds: [embed] };
  const state = readState();

  // Si on a déjà un message existant, on tente de l'éditer plutôt que d'en poster un nouveau.
  if (state.messageId) {
    const editRes = await fetch(`${webhookUrl}/messages/${state.messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (editRes.ok) {
      console.log("Message édité:", today, "-> demain:", next);
      return;
    }

    console.warn(`Édition impossible (statut ${editRes.status}), création d'un nouveau message.`);
  }

  // Pas de message existant, ou édition échouée : on en crée un nouveau.
  const createRes = await fetch(`${webhookUrl}?wait=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!createRes.ok) {
    console.error("Erreur Discord:", createRes.status);
    process.exit(1);
  }

  const created = await createRes.json();
  writeState({ messageId: created.id });
  console.log("Nouveau message créé:", today, "-> demain:", next);
}

main().catch(err => {
  console.error("Erreur inattendue:", err);
  process.exit(1);
});
