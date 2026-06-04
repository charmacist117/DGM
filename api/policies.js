import { collectPolicies } from "../lib/scraper.js";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function secondsUntilNextKstMidnight(now = new Date()) {
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const nextKstMidnightUtcMs =
    Date.UTC(
      kstNow.getUTCFullYear(),
      kstNow.getUTCMonth(),
      kstNow.getUTCDate() + 1,
      0,
      0,
      0
    ) - KST_OFFSET_MS;

  return Math.max(60, Math.floor((nextKstMidnightUtcMs - now.getTime()) / 1000));
}

function currentKstMidnightIso(now = new Date()) {
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const kstMidnightUtcMs =
    Date.UTC(
      kstNow.getUTCFullYear(),
      kstNow.getUTCMonth(),
      kstNow.getUTCDate(),
      0,
      0,
      0
    ) - KST_OFFSET_MS;

  return new Date(kstMidnightUtcMs).toISOString();
}

export default async function handler(request, response) {
  try {
    const payload = await collectPolicies();
    const maxAge = secondsUntilNextKstMidnight();

    response.setHeader(
      "Cache-Control",
      `s-maxage=${maxAge}, stale-while-revalidate=3600`
    );
    response.setHeader("X-Refresh-Basis", "00:00 Asia/Seoul");
    response.status(200).json(payload);
  } catch (error) {
    response.status(500).json({
      generatedAt: currentKstMidnightIso(),
      error: error.message,
      policies: []
    });
  }
}
