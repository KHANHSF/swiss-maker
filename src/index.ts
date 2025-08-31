import fetch from "node-fetch";
import { URLSearchParams } from "url";

export const config = {
  server: "https://lichess.org",
  teamId: "AggressiveBotTeamID",  // <- đây phải là **ID team**, không phải tên
  oauthToken: process.env.OAUTH_TOKEN!,
  daysInAdvance: 1,
  dryRun: false,
  arena: {
    name: () => "Hourly Ultrabullet",
    description: (nextLink?: string) => `Next: ${nextLink ?? "coming soon"}`,
    clockTime: 0.25,
    clockIncrement: 0,
    minutes: 60,
    rated: true,
    variant: "standard",
    intervalHours: 1,
  },
};

function assertEnv() {
  if (!config.oauthToken) {
    throw new Error("OAUTH_TOKEN fehlt. Setze die Umgebungsvariable OAUTH_TOKEN.");
  }
  if (!config.teamId) {
    throw new Error("TEAM ID fehlt. Setze die teamId in config.");
  }
}

/** nächste volle Stunde UTC */
function nextEvenUtcHour(from: Date): Date {
  const d = new Date(from);
  const h = d.getUTCHours();
  const nextEven = Math.floor(h / config.arena.intervalHours) * config.arena.intervalHours + config.arena.intervalHours;
  d.setUTCHours(nextEven, 0, 0, 0);
  return d;
}

async function createArena(startDate: Date, nextLink: string) {
  const body = new URLSearchParams();

  body.append("name", config.arena.name());
  body.append("description", config.arena.description(nextLink));
  body.append("clockTime", String(config.arena.clockTime));
  body.append("clockIncrement", String(config.arena.clockIncrement));
  body.append("minutes", String(config.arena.minutes));
  body.append("rated", config.arena.rated ? "true" : "false");
  body.append("variant", config.arena.variant);
  body.append("teamId", config.teamId);          // ID team
  body.append("teamTournament", "true");        // bắt buộc để tạo trong team
  body.append("startDate", startDate.toISOString());

  if (config.dryRun) {
    console.log("DRY RUN Arena:", Object.fromEntries(body));
    return "dry-run";
  }

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

async function main() {
  assertEnv();

  const now = new Date();
  const firstStart = nextEvenUtcHour(now);

  const arenasPerDay = Math.floor(24 / config.arena.intervalHours);
  const totalArenas = arenasPerDay * config.daysInAdvance;

  console.log(`Creating ${totalArenas} arenas for team ${config.teamId}`);

  let prevUrl: string | null = null;

  for (let i = 0; i < totalArenas; i++) {
    if (i > 0) await new Promise(resolve => setTimeout(resolve, 60000));

    const startDate = new Date(firstStart.getTime() + i * config.arena.intervalHours * 60 * 60 * 1000);
    const arenaUrl = await createArena(startDate, prevUrl ?? "tba");
    if (arenaUrl) prevUrl = arenaUrl;
  }
}

main().catch(err => console.error(err));
