// 동행복권 공식 추첨결과에서 로또 6/45 지난 당첨 번호를 모아 data/draws.json 으로 저장한다.
// 쓰는 법: node scripts/fetch-draws.mjs   (이미 있는 회차는 건너뛰고 새 회차만 더한다)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fetchAround, fetchLatest } from "../api/_dhlottery.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "data", "draws.json");

let draws = [];
try { draws = JSON.parse(await readFile(out, "utf8")).draws; } catch {}
const have = new Map(draws.map(d => [d[0], d]));

// 가장 최근 회차를 먼저 알아낸다
const latest = (await fetchLatest())[0][0];
console.log("가장 최근 회차:", latest);

for (let ep = latest; ep >= 1; ep -= 10) {
  if (have.has(ep) && have.has(Math.max(1, ep - 9))) continue;
  const list = await fetchAround(ep);
  for (const d of list) have.set(d[0], d);
  process.stdout.write(`\r${ep}회차 근처까지 받음   `);
  await new Promise(r => setTimeout(r, 400));
}

draws = [...have.values()].sort((a, b) => a[0] - b[0]);
const missing = [];
for (let i = 1; i <= latest; i++) if (!have.has(i)) missing.push(i);
if (missing.length) throw new Error("빠진 회차: " + missing.join(","));

await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify({
  source: "동행복권 공식 추첨결과 (dhlottery.co.kr)",
  updated: new Date().toISOString().slice(0, 10),
  format: "[회차, 추첨일, 번호1~6, 보너스]",
  draws,
}).replace(/\],\[/g, "],\n[") + "\n");
console.log(`\n저장: ${draws.length}회차 (1~${latest})`);
