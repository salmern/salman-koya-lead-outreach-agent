import { loadEnvFile } from "node:process";
loadEnvFile(".env.local");

import { ApifyClient } from "apify-client";

const TARGETS = new Set(["spear-growth", "spear growth", "channelangels", "channel angels"]);
const ACTOR = process.env.APIFY_ACTOR_ID ?? "harvestapi/linkedin-company-search";

async function main() {
  const apify = new ApifyClient({ token: process.env.APIFY_API_TOKEN! });
  const res = await apify.actor(ACTOR).runs().list({ limit: 12, desc: true });
  console.log("list keys:", Object.keys(res ?? {}), "| items:", (res.items ?? []).length);
  for (const r of res.items ?? []) {
    let names: Array<{ name: string; uni: string; w: string | null; by: string }> = [];
    if (r.defaultDatasetId) {
      const { items } = await apify.dataset(r.defaultDatasetId).listItems({ limit: 50 });
      names = (items ?? []).map((i) => ({
        name: String(i.name ?? ""),
        uni: String(i.universalName ?? ""),
        w: i.website ? String(i.website) : null,
        by: i.linkedinUrl ? String(i.linkedinUrl) : "",
      }));
    }
    const hits = names.filter((n) => TARGETS.has(n.uni.toLowerCase()) || TARGETS.has(n.name.toLowerCase()));
    const withW = names.filter((n) => n.w).length;
    console.log(
      new Date(r.startedAt).toISOString().slice(0, 19),
      "| run:", r.id,
      "| usd:", Number(r.usageTotalUsd ?? 0).toFixed(4),
      "| items:", names.length,
      "| withWebsite:", withW,
      "| TARGET HIT:", hits.length ? JSON.stringify(hits) : "none",
    );
  }
}

(async () => { await main(); })().catch((e) => { console.error(e); process.exit(1); });