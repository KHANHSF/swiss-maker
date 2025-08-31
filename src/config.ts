export const config = {
  server: "https://lichess.org",
  team: "aggressivebot",        // <- Đây là team slug, không phải name
  oauthToken: process.env.OAUTH_TOKEN!, // Token phải có quyền tạo giải trong team
  daysInAdvance: 1,
  dryRun: false,                 // true = chỉ test, false = tạo thật

  arena: {
    name: () => "Hourly Ultrabullet",
    description: (nextLink?: string) =>
      `Next: ${nextLink ?? "coming soon"}`,
    clockTime: 0.25,             // 15 giây
    clockIncrement: 0,
    minutes: 90,                 // 1h30 phút
    rated: true,
    variant: "standard",
    intervalHours: 1,            // mỗi 1h tạo 1 giải
    startHour: 14,               // giờ UTC bắt đầu
  },
};
