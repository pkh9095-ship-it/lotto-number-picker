// 사이트에 저장된 기록 뒤로 새로 추첨된 회차를 동행복권에서 받아 돌려준다.
// GET /api/latest?from=1246  →  { draws: [[회차, 날짜, n1..n6, 보너스], ...] }
import { fetchAround, fetchLatest } from "./_dhlottery.js";

export default async function handler(req, res) {
  const from = Math.max(1, parseInt(req.query.from, 10) || 1);
  try {
    const recent = await fetchLatest();            // 최근 10회차
    const newest = recent[0]?.[0] ?? 0;
    const got = new Map(recent.map(d => [d[0], d]));
    // 저장된 기록이 10회차보다 더 뒤처졌으면 몇 번 더 받는다 (최대 50회차)
    for (let ep = newest - 10; ep >= from && ep > newest - 50; ep -= 10) {
      for (const d of await fetchAround(ep)) got.set(d[0], d);
    }
    const draws = [...got.values()].filter(d => d[0] >= from).sort((a, b) => a[0] - b[0]);
    res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
    res.status(200).json({ newest, draws });
  } catch (e) {
    res.setHeader("Cache-Control", "public, s-maxage=300");
    res.status(502).json({ error: "동행복권 기록을 지금 받을 수 없어요", detail: String(e.message || e) });
  }
}
