import fetch from "node-fetch";
import { URLSearchParams } from "url";

export const config = {
  server: "https://lichess.org",
  team: "AggressiveBot",               // Team-ID
  oauthToken: process.env.OAUTH_TOKEN!, // Token từ GitHub Secrets
  daysInAdvance: 1,                     // số ngày tạo trước
  dryRun: false,                        // true = chỉ debug, false = tạo thật
  arena: {
    name: () => "Hourly Ultrabullet",
    description: (nextLink?: string) => `Next: ${nextLink ?? "coming soon"}`,
    clockTime: 0.25,       // phút
    clockIncrement: 0,
    minutes: 60,
    rated: true,
    variant: "standard",
    intervalHours: 1,      // mỗi 1 giờ
  },
};

// === Utils ===
function assertEnv() {
  if (!config.oauthToken) throw new Error("OAUTH_TOKEN thiếu. Set trong Secrets/GitHub Actions.");
  console.log("Debug: OAUTH_TOKEN length:", config.oauthToken.trim().length);
}

function nextEvenUtcHour(from: Date): Date {
  const d = new Date(from);
  const h = d.getUTCHours();
  const nextEven = Math.floor(h / config.arena.intervalHours) * config.arena.intervalHours + config.arena.intervalHours;
  d.setUTCHours(nextEven, 0, 0, 0);
  return d;
}

// === Create Arena ===
async function createArena(startDate: Date, nextLink: string) {
  const body = new URLSearchParams({
    name: config.arena.name(),
    description: config.arena.description(nextLink),
    clockTime: String(config.arena.clockTime),
    clockIncrement: String(config.arena.clockIncrement),
    minutes: String(config.arena.minutes),
    rated: config.arena.rated ? "true" : "false",
    variant: config.arena.variant,
    startDate: startDate.toISOString(),
    teamId: config.team,        // quan trọng: tạo trong team
  });

  console.log("Creating arena on:", startDate.toISOString());

  if (config.dryRun) {
    console.log("DRY RUN body:", Object.fromEntries(body));
    return "dry-run";
  }

  // Trim token để tránh lỗi HTTP header
  const token = config.oauthToken.trim();

  const res = await fetch(`${config.server}/api/tournament`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
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

// === Main ===
async function main() {
  assertEnv();

  const now = new Date();
  const firstStart = nextEvenUtcHour(now);
  const arenasPerDay = Math.floor(24 / config.arena.intervalHours);
  const totalArenas = arenasPerDay * config.daysInAdvance;

  console.log(`Creating ${totalArenas} arenas for team ${config.team}`);

  let prevUrl: string | null = null;

  for (let i = 0; i < totalArenas; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 60000)); // tránh rate limit
    const startDate = new Date(firstStart.getTime() + i * config.arena.intervalHours * 3600 * 1000);
    const arenaUrl = await createArena(startDate, prevUrl ?? "tba");
    if (arenaUrl) prevUrl = arenaUrl;
  }
}

main().catch(err => console.error(err));
