const ANCESTORS = [
  "Bromius", "Orenggal", "Zenith", "Verminia", "Orlick", "Garren Rood", "Bromius",
  "Zenith (ou Oracle des Vallons - créneau partagé, à confirmer)", "Tuvulkane", "Verminia",
  "Orlick", "Bromius", "Orenggal", "Zenith", "Tuvulkane", "Orlick", "Garren Rood", "Bromius",
  "Orenggal", "Tuvulkane", "Verminia", "Orlick", "Garren Rood", "Orenggal", "Zenith",
  "Tuvulkane", "Verminia", "Garren Rood"
];

const PIVOT = new Date("2026-08-31T00:00:00Z"); // jour 1 du cycle validé (Bromius)

function parisDateString(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function ancestorForDate(date) {
  const dayUTC = new Date(parisDateString(date) + "T00:00:00Z");
  const diffDays = Math.round((dayUTC - PIVOT) / 86400000);
  const index = ((diffDays % 28) + 28) % 28;
  return ANCESTORS[index];
}

const now = new Date();
const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
const today = ancestorForDate(now);
const next = ancestorForDate(tomorrow);

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
if (!webhookUrl) {
  console.error("DISCORD_WEBHOOK_URL manquant");
  process.exit(1);
}

const payload = {
  embeds: [
    {
      title: `Ancêtre du jour : ${today}`,
      description: `Demain : ${next}`,
      color: 0x8a5cf6
    }
  ]
};

fetch(webhookUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
}).then(res => {
  if (!res.ok) {
    console.error("Erreur Discord:", res.status);
    process.exit(1);
  }
  console.log("Message envoyé:", today, "-> demain:", next);
});
