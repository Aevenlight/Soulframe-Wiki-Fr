const fs = require("fs");
const path = require("path");

const ANCESTORS = [
  "Bromius", "Orengall", "Zenith", "Verminia", "Orlick", "Garren Rood", "Bromius",
  "Zenith (ou Oracle des Vallons - créneau partagé, à confirmer)", "Tuvulkane", "Verminia",
  "Orlick", "Bromius", "Orengall", "Zenith", "Tuvulkane", "Orlick", "Garren Rood", "Bromius",
  "Orengall", "Tuvulkane", "Verminia", "Orlick", "Garren Rood", "Orengall", "Zenith",
  "Tuvulkane", "Verminia", "Garren Rood"
];

const ANCESTOR_IMAGES = {
  "Bromius": "https://app.super.so/_next/image?url=https%3A%2F%2Fassets.super.so%2F2eeb3c9d-609b-4254-88b2-95538e16304b%2Fimages%2F63e9a178-0b56-471b-9cde-73b23e83dd1b%2FBromius.png&w=1080&q=75",
  "Orengall": "https://soulframewiki.fr/_next/image?url=https%3A%2F%2Fassets.super.so%2F2eeb3c9d-609b-4254-88b2-95538e16304b%2Fimages%2F884496ba-1be9-4354-980a-147175c5d62f%2FOrengall.webp&w=1080&q=75",
  "Zenith": "https://app.super.so/_next/image?url=https%3A%2F%2Fassets.super.so%2F2eeb3c9d-609b-4254-88b2-95538e16304b%2Fimages%2Feda948ad-2cd5-4f76-87cc-5ac09a8f37c3%2Fzenith.png&w=1080&q=75",
  "Verminia": "https://app.super.so/_next/image?url=https%3A%2F%2Fassets.super.so%2F2eeb3c9d-609b-4254-88b2-95538e16304b%2Fimages%2Fc93d3700-aaf4-4c91-81ae-567ae2853922%2Fverminiajournal.png&w=1080&q=75",
  "Orlick": "https://app.super.so/_next/image?url=https%3A%2F%2Fassets.super.so%2F2eeb3c9d-609b-4254-88b2-95538e16304b%2Fimages%2F481d53d1-d1cc-4a95-b394-7d8b6f8f8be0%2Forlickjournal.png&w=1080&q=75",
  "Garren Rood": "https://soulframewiki.fr/_next/image?url=https%3A%2F%2Fassets.super.so%2F2eeb3c9d-609b-4254-88b2-95538e16304b%2Fimages%2Faa391d5b-0789-43bc-bb7f-952daa21f919%2FGarren_Rood.webp&w=1080&q=75",
  "Tuvulkane": "https://app.super.so/_next/image?url=https%3A%2F%2Fassets.super.so%2F2eeb3c9d-609b-4254-88b2-95538e16304b%2Fimages%2Fb3ff46f5-78a3-4225-8ce0-3a160103fd0c%2Ftuvalkanejournal.png&w=1080&q=75",
  "Oracle des Vallons": "https://app.notion.com/image/attachment%3A1fbb23ab-e2eb-45a9-b58c-ef6730d05e37%3ADaleSeer.png?id=3832556f-efd1-8047-83df-e0214a3f49fd&table=block&spaceId=0956db3a-13a6-4412-9978-a0f5c5312fe5&width=600&userId=4a9575a5-f93b-44d2-a961-7aba0ebaa5d2&cache=v2&imgBuildSrc=requestProxiedImageUrl"
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
