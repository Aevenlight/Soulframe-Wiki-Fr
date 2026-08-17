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
  "Bromius": "https://app.notion.com/image/attachment%3Acf9e4b3c-6a52-44cf-94e3-2364e8438676%3ABromius.png?id=2172556f-efd1-80f4-ac60-f636f139516a&table=block&spaceId=0956db3a-13a6-4412-9978-a0f5c5312fe5&width=600&userId=4a9575a5-f93b-44d2-a961-7aba0ebaa5d2&cache=v2&imgBuildSrc=requestProxiedImageUrl",
  "Orengall": "https://app.notion.com/image/attachment%3A8ee61fd1-771d-47eb-bfc0-be323004a5b4%3AOrengall.webp?id=2172556f-efd1-80dd-b4fc-e257a91ef8b6&table=block&spaceId=0956db3a-13a6-4412-9978-a0f5c5312fe5&width=600&userId=4a9575a5-f93b-44d2-a961-7aba0ebaa5d2&cache=v2&imgBuildSrc=requestProxiedImageUrl",
  "Zenith": "https://app.notion.com/image/attachment%3Aeb7536a8-a6ce-4a6b-a394-e17461ef51d2%3AZenith.png?id=2b92556f-efd1-809c-8564-d13b7bb453e6&table=block&spaceId=0956db3a-13a6-4412-9978-a0f5c5312fe5&width=600&userId=4a9575a5-f93b-44d2-a961-7aba0ebaa5d2&cache=v2&imgBuildSrc=requestProxiedImageUrl",
  "Verminia": "https://app.notion.com/image/attachment%3A0aca9a20-ea83-4480-8f21-c28d42b64b60%3AVerminiaJournal.png?id=2172556f-efd1-80b3-9e8f-c272bdb57395&table=block&spaceId=0956db3a-13a6-4412-9978-a0f5c5312fe5&width=600&userId=4a9575a5-f93b-44d2-a961-7aba0ebaa5d2&cache=v2&imgBuildSrc=requestProxiedImageUrl",
  "Orlick": "https://app.notion.com/image/attachment%3Ab226d2b3-fdd0-4df5-9fc0-d4402e08b3ed%3AOrlickJournal.png?id=2172556f-efd1-808f-8a14-d2acfa29624c&table=block&spaceId=0956db3a-13a6-4412-9978-a0f5c5312fe5&width=600&userId=4a9575a5-f93b-44d2-a961-7aba0ebaa5d2&cache=v2&imgBuildSrc=requestProxiedImageUrl",
  "Garren Rood": "https://app.notion.com/image/attachment%3A8e8f8b4e-ffae-43a9-b9b8-7ba116806406%3AGarren_Rood.webp?id=2172556f-efd1-80b9-bbbf-c5f29723c105&table=block&spaceId=0956db3a-13a6-4412-9978-a0f5c5312fe5&width=600&userId=4a9575a5-f93b-44d2-a961-7aba0ebaa5d2&cache=v2&imgBuildSrc=requestProxiedImageUrl",
  "Tuvulkane": "https://app.notion.com/image/attachment%3A6e0fd93c-fc45-4df5-ade9-854fe3d92be6%3ATuvalkaneJournal.png?id=2172556f-efd1-8080-a436-e93c1861cc7c&table=block&spaceId=0956db3a-13a6-4412-9978-a0f5c5312fe5&width=600&userId=4a9575a5-f93b-44d2-a961-7aba0ebaa5d2&cache=v2&imgBuildSrc=requestProxiedImageUrl",
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
