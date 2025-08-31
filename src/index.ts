import fetch from "node-fetch";
import { URLSearchParams } from "url";

export const config = {
  server: "https://lichess.org",
  team: "aggressivebot", // <- team slug chuẩn, lowercase
  oauthToken: process.env.OAUTH_TOKEN?.trim()!, // token trim để tránh lỗi header
  daysInAdvance: 1,       // số ngày tạo giải trước
  dryRun: false,          // true = chỉ log, false = tạo thực tế
  arena: {
    name: () => "Hourly Ultrabullet",
    description: (nextLink?: string) => `Next: ${nextLink ?? "coming soon"}`,
    clockTime: 0.25,      // 15s
    clockIncrement: 0,
    minutes: 60,
    rated: true,
    variant: "standard",
    intervalHours: 1,     // mỗi 1h tạo giải
  },
};

function assertEnv() {
  if (!config.oauthToken) throw new Error("OAUTH_TOKEN chưa được set");
  if (!config.team) throw new Error("TEAM chưa được set");
  console.log("Debug: Token length:", config.oauthToken.length);
  console.log("Debug: Team ID:", config.team);
}

/**
 * Tính giờ UTC chẵn tiếp theo
 */
function nextEvenUtcHour(from: Date): Date {
  const d = new Date(from);
  const h = d.getUTCHours();
  const nextEven = Math.floor(h / config.arena.intervalHours) * config.arena.intervalHours + config.arena.intervalHours;
  d.setUTCHours(nextEven, 0, 0, 0);
  return d;
}

/**
 * Tạo arena trong team
 */
async function createArena(startDate: Date, nextLink: string) {
  const body = new URLSearchParams({
    name: config.arena.name(),
    description: config.arena.description(nextLink),
    clockTime: String(config.arena.clockTime),
    clockIncrement: String(config.arena.clockIncrement),
    minutes: String(config.arena.minutes),
    rated: config.arena.rated ? "true" : "false",
    variant: config.arena.variant,
    teamId: config.team,
    teamTournament: "true",
    startDate: startDate.toISOString(),
  });

  console.log("Creating arena with body:", Object.fromEntries(body));

  if (config.dryRun) return console.log("DRY RUN - arena not created");

  const res = await fetch(`${config.server}/api/tournament`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.oauthToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Arena creation failed:", res.status, errText);
    return null;
  }

  const data = await res.json();
  const url = data.id ? `${config.server}/tournament/${data.id}` : res.headers.get("Location");
  console.log("Arena created:", url);
  return url;
}

/**
 * Main
 */
async function main() {
  assertEnv();

  const now = new Date();
  const firstStart = nextEvenUtcHour(now);

  const arenasPerDay = Math.floor(24 / config.arena.intervalHours);
  const totalArenas = arenasPerDay * config.daysInAdvance;

  console.log(`Creating ${totalArenas} arenas for team ${config.team}`);

  let prevUrl: string | null = null;

  for (let i = 0; i < totalArenas; i++) {
    if (i > 0) await new Promise(resolve => setTimeout(resolve, 5000)); // delay tránh rate limit

    const startDate = new Date(firstStart.getTime() + i * config.arena.intervalHours * 60 * 60 * 1000);

    const arenaUrl = await createArena(startDate, prevUrl ?? "tba");
    if (arenaUrl) prevUrl = arenaUrl;
  }
}

main().catch(err => console.error(err));
