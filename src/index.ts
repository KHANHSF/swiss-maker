import fetch from "node-fetch";
import { URLSearchParams } from "url";

// --- CONFIG ---
export const config = {
  server: "https://lichess.org",
  teamId: "AggressiveBot",           // <-- ID team trên Lichess
  oauthToken: process.env.OAUTH_TOKEN!,    // phải set trong GitHub Secrets
  daysInAdvance: 1,                        // tạo trước bao nhiêu ngày
  dryRun: false,                            // true = chỉ log, false = tạo thật
  arena: {
    name: () => "Hourly Ultrabullet",
    description: (nextLink?: string) => `Next: ${nextLink ?? "coming soon"}`,
    clockTime: 0.25,    // 15 giây
    clockIncrement: 0,
    minutes: 60,        // 1h
    rated: true,
    variant: "standard",
    intervalHours: 1,   // cứ 1h tạo 1 giải
  },
};

// --- HELPER ---
function assertEnv() {
  if (!config.oauthToken) {
    throw new Error("OAUTH_TOKEN chưa set!");
  }
  if (!config.teamId) {
    throw new Error("Team ID chưa set!");
  }
  console.log("Debug: Token length:", config.oauthToken.length);
  console.log("Debug: Team ID:", config.teamId);
}

// tính giờ UTC chẵn theo intervalHours
function nextEvenUtcHour(from: Date, interval: number): Date {
  const d = new Date(from);
  const h = d.getUTCHours();
  const next = Math.floor(h / interval) * interval + interval;
  d.setUTCHours(next, 0, 0, 0);
  return d;
}

// --- CREATE ARENA ---
async function createArena(startDate: Date, nextLink: string) {
  const body = new URLSearchParams();
  body.append("name", String(config.arena.name()));
  body.append("description", String(config.arena.description(nextLink)));
  body.append("clockTime", String(config.arena.clockTime));
  body.append("clockIncrement", String(config.arena.clockIncrement));
  body.append("minutes", String(config.arena.minutes));
  body.append("rated", config.arena.rated ? "true" : "false");
  body.append("variant", String(config.arena.variant));
  body.append("teamId", String(config.teamId));
  body.append("teamTournament", "true");
  body.append("startDate", startDate.toISOString());

  console.log("Creating arena with body:", Object.fromEntries(body));

  if (config.dryRun) {
    console.log("DRY RUN only, not sending request.");
    return "dry-run";
  }

  const headers = {
    Authorization: `Bearer ${String(config.oauthToken)}`,
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };

  const res = await fetch(`${config.server}/api/tournament`, {
    method: "POST",
    headers,
    body,
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error("Arena creation failed:", res.status, txt);
    return null;
  }

  const data = await res.json();
  const url = data.id ? `${config.server}/tournament/${data.id}` : res.headers.get("Location");
  console.log("Arena created:", url);
  return url;
}

// --- MAIN ---
async function main() {
  assertEnv();

  const now = new Date();
  const firstStart = nextEvenUtcHour(now, config.arena.intervalHours);
  const arenasPerDay = Math.floor(24 / config.arena.intervalHours);
  const totalArenas = arenasPerDay * config.daysInAdvance;

  console.log(`Creating ${totalArenas} arenas for team ${config.teamId}`);

  let prevUrl: string | null = null;

  for (let i = 0; i < totalArenas; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 60000)); // tránh rate limit

    const startDate = new Date(firstStart.getTime() + i * config.arena.intervalHours * 3600 * 1000);
    const arenaUrl = await createArena(startDate, prevUrl ?? "tba");
    if (arenaUrl) prevUrl = arenaUrl;
  }
}

main().catch(err => console.error(err));
