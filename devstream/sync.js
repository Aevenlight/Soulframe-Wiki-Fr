const fs = require("fs");
const path = require("path");

const CHANNEL = "playsoulframe";
const LINK = `https://www.twitch.tv/${CHANNEL}`;
const TITLE_FILTER = /devstream/i;
const FILE = path.join(__dirname, "devstream.json");

const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = process.env;

function readCurrent() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch (e) {
    return { link: LINK, streams: [] };
  }
}

async function getToken() {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type: "client_credentials"
    })
  });
  if (!res.ok) throw new Error(`Token Twitch refusé (${res.status})`);
  return (await res.json()).access_token;
}

async function helix(endpoint, token) {
  const res = await fetch(`https://api.twitch.tv/helix/${endpoint}`, {
    headers: { "Client-Id": TWITCH_CLIENT_ID, Authorization: `Bearer ${token}` }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Helix ${endpoint} : ${res.status} ${await res.text()}`);
  return res.json();
}

function extractNumber(title) {
  const m = title.match(/#\s*(\d+)/) || title.match(/devstream\D{0,3}(\d+)/i);
  return m ? Number(m[1]) : null;
}

function inVacation(start, vacation) {
  if (!vacation) return false;
  const t = new Date(start).getTime();
  return t >= new Date(vacation.start_time).getTime() && t <= new Date(vacation.end_time).getTime();
}

async function main() {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    throw new Error("TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET manquants");
  }

  const token = await getToken();
  const users = await helix(`users?login=${CHANNEL}`, token);
  const broadcaster = users && users.data[0];
  if (!broadcaster) throw new Error(`Chaîne ${CHANNEL} introuvable`);

  const schedule = await helix(`schedule?broadcaster_id=${broadcaster.id}&first=25`, token);
  const data = schedule && schedule.data;
  const segments = (data && data.segments) || [];
  const now = Date.now();

  const fromTwitch = segments
    .filter((s) => TITLE_FILTER.test(s.title || ""))
    .filter((s) => !s.canceled_until)
    .filter((s) => !inVacation(s.start_time, data.vacation))
    .map((s) => {
      const start = new Date(s.start_time).getTime();
      const end = s.end_time ? new Date(s.end_time).getTime() : start + 3600000;
      return {
        number: extractNumber(s.title),
        title: s.title,
        start: s.start_time,
        durationHours: Math.round(((end - start) / 3600000) * 100) / 100
      };
    })
    .filter((s) => new Date(s.start).getTime() + s.durationHours * 3600000 > now);

  const current = readCurrent();
  const manual = (current.streams || []).filter(
    (s) => s.manual && new Date(s.start).getTime() + (s.durationHours || 1) * 3600000 > now
  );

  const streams = [...fromTwitch, ...manual].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  const next = { link: LINK, streams };
  const output = JSON.stringify(next, null, 2) + "\n";

  console.log(`Segments Twitch : ${segments.length}, devstreams retenus : ${fromTwitch.length}, manuels : ${manual.length}`);
  for (const s of streams) console.log(`- #${s.number ?? "?"} ${s.start} (${s.durationHours} h) ${s.title || ""}`);

  if (fs.existsSync(FILE) && fs.readFileSync(FILE, "utf8") === output) {
    console.log("devstream.json inchangé");
    return;
  }
  fs.writeFileSync(FILE, output);
  console.log("devstream.json mis à jour");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
