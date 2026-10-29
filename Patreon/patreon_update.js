const fs = require("fs");
const path = require("path");

const CAMPAIGN_ID = "15362188";
const OUT = path.join(__dirname, "latest.json");
const MATCH = /mise a jour (du )?wiki/;

const normalize = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const params = new URLSearchParams({
  "filter[campaign_id]": CAMPAIGN_ID,
  "filter[contains_exclusive_posts]": "true",
  "filter[is_draft]": "false",
  sort: "-published_at",
  "page[count]": "20",
  "fields[post]": "title,url,published_at,image,thumbnail",
  "json-api-version": "1.0",
});

(async () => {
  const res = await fetch(`https://www.patreon.com/api/posts?${params}`, {
    headers: { "User-Agent": "Mozilla/5.0 SoulframeWikiFR" },
  });
  if (!res.ok) throw new Error(`Patreon HTTP ${res.status}`);
  const { data } = await res.json();

  const post = data.find((p) => MATCH.test(normalize(p.attributes.title || "")));
  if (!post) {
    console.log("::warning::Aucun post « Mise à jour Wiki » trouvé");
    return;
  }

  const a = post.attributes;
  const img = a.image || {};
  const thumb = a.thumbnail || {};
  const latest = {
    title: a.title,
    url: a.url,
    published_at: a.published_at,
    image: img.url || img.thumb_url || null,
    image_small: thumb.default_small || null,
  };

  const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  const next = JSON.stringify(latest, null, 2) + "\n";
  if (prev !== next) fs.writeFileSync(OUT, next);
  console.log(`${latest.title} -> ${latest.url}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
