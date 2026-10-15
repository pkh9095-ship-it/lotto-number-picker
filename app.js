// 로또 번호 추출기
// 데이터: data/draws.json (동행복권 공식 기록) + /api/latest (추첨 뒤 새 회차 자동 반영)
// 한 회차 모양: [회차, "YYYY-MM-DD", n1..n6, 보너스]

const $ = s => document.querySelector(s);
const NUMS = Array.from({ length: 45 }, (_, i) => i + 1);
const STORE_KEY = "lotto-mine-v1";

let draws = [];          // 회차 오름차순
let viewRound = 0;       // 최근 당첨 구역에서 보고 있는 회차
let lastDraw = null;     // 방금 뽑은 줄들

const colorClass = n => "c" + Math.min(5, Math.ceil(n / 10));
const fmtDate = s => { const [y, m, d] = s.split("-"); return `${y}년 ${+m}월 ${+d}일`; };
const won = n => n.toLocaleString("ko-KR");

function ballHTML(n, extra = "") {
  return `<span class="ball ${colorClass(n)} ${extra}" aria-label="${n}번"><b>${n}</b></span>`;
}

/* ---------- 통계 ---------- */
function stats(range) {
  const list = range === "all" ? draws : draws.slice(-Number(range));
  const count = new Array(46).fill(0);
  for (const d of list) for (let i = 2; i < 8; i++) count[d[i]]++;
  // 마지막으로 나온 회차 (범위와 상관없이 전체 기록에서)
  const last = new Array(46).fill(0);
  for (const d of draws) for (let i = 2; i < 8; i++) last[d[i]] = d[0];
  const latest = draws[draws.length - 1][0];
  const gap = last.map(r => latest - r); // 몇 회째 안 나왔나 (0 = 지난 회차에 나옴)
  return { list, count, last, gap, latest };
}

function currentRange() { return document.querySelector('input[name="range"]:checked').value; }

/* ---------- 용지 ---------- */
function renderSlip() {
  const s = stats(currentRange());
  const max = Math.max(...NUMS.map(n => s.count[n]));
  const min = Math.min(...NUMS.map(n => s.count[n]));
  const grid = $("#slip-grid");
  grid.innerHTML = NUMS.map(n => {
    const h = max === min ? 0.3 : 0.08 + 0.92 * (s.count[n] - min) / (max - min);
    return `<button type="button" class="cell" style="--h:${h.toFixed(3)}" ${h > 0.62 ? "data-dark" : ""}
      data-n="${n}" aria-label="${n}번, ${s.count[n]}번 나옴"><span>${n}</span></button>`;
  }).join("");
  const rangeText = { all: "전체 회차", 100: "최근 100회", 20: "최근 20회" }[currentRange()];
  $("#slip-sub").textContent = `${rangeText} 번호별 나온 횟수`;
  if (lastDraw) markSlip(lastDraw[0], false);
  showTip(null);
}

function markSlip(nums, animate = true) {
  document.querySelectorAll(".cell.mark").forEach(c => c.classList.remove("mark"));
  nums.forEach((n, i) => {
    const c = document.querySelector(`.cell[data-n="${n}"]`);
    if (!c) return;
    if (animate) setTimeout(() => c.classList.add("mark"), 260 + i * 330);
    else c.classList.add("mark");
  });
}

function showTip(n) {
  let tip = $("#cell-tip");
  if (!tip) {
    tip = document.createElement("p");
    tip.id = "cell-tip"; tip.className = "cell-tip"; tip.setAttribute("aria-live", "polite");
    $(".slip").appendChild(tip);
  }
  document.querySelectorAll('.cell[aria-pressed="true"]').forEach(c => c.removeAttribute("aria-pressed"));
  if (!n) { tip.textContent = "칸을 누르면 그 번호의 기록을 볼 수 있어요."; return; }
  const s = stats(currentRange());
  document.querySelector(`.cell[data-n="${n}"]`)?.setAttribute("aria-pressed", "true");
  const when = s.gap[n] === 0 ? "가장 최근 회차에 나왔어요" : `${s.gap[n]}회째 안 나왔어요`;
  tip.innerHTML = `<b>${n}번</b> · ${s.list.length}회 중 ${s.count[n]}번 나옴 · 마지막 ${s.last[n]}회, ${when}`;
}

/* ---------- 뽑기 ---------- */
function rand() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
}

function weightsFor(mode) {
  if (mode === "even") return NUMS.map(() => 1);
  const s = stats(currentRange());
  if (mode === "hot") return NUMS.map(n => Math.max(1, s.count[n]));
  return NUMS.map(n => s.gap[n] + 1); // cold
}

// 공을 하나씩 꺼내고 다시 넣지 않는다
function drawLine(weights) {
  const pool = NUMS.map((n, i) => ({ n, w: weights[i] }));
  const out = [];
  while (out.length < 6) {
    const total = pool.reduce((a, b) => a + b.w, 0);
    let r = rand() * total, i = 0;
    while (r >= pool[i].w && i < pool.length - 1) { r -= pool[i].w; i++; }
    out.push(pool.splice(i, 1)[0].n);
  }
  return out;
}

const MODE_NOTE = {
  even: "45개 공이 모두 같은 확률이에요. 실제 추첨기와 같아요.",
  hot: "고른 범위에서 많이 나온 번호일수록 공을 더 넣고 굴려요.",
  cold: "마지막으로 나온 뒤 오래 지난 번호일수록 공을 더 넣고 굴려요.",
};
const MODE_NAME = { even: "그냥 추첨", hot: "자주 나온 쪽으로", cold: "오래 쉰 쪽으로" };

function onDraw(e) {
  e.preventDefault();
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const lines = Number(document.querySelector('input[name="lines"]:checked').value);
  const w = weightsFor(mode);
  const drawn = Array.from({ length: lines }, () => drawLine(w));
  lastDraw = drawn;

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tags = "ABCDE";
  $("#result").innerHTML = `<ol class="lines">${drawn.map((nums, li) => `
    <li class="line">
      <span class="line-tag" aria-label="${tags[li]}줄">${tags[li]}</span>
      <span class="balls" data-order="${nums.join(",")}">${nums.map(n => ballHTML(n, reduce ? "" : "wait")).join("")}</span>
      <button type="button" class="save" data-li="${li}" aria-pressed="false">저장</button>
    </li>`).join("")}</ol>`;

  // 꺼낸 순서대로 하나씩 떨어지고, 다 나오면 작은 수부터 정렬 (방송 추첨처럼)
  const go = $("#go");
  go.disabled = true;
  const step = reduce ? 0 : 330;
  document.querySelectorAll("#result .balls").forEach(row => {
    [...row.children].forEach((b, i) => setTimeout(() => { b.classList.remove("wait"); if (!reduce) b.classList.add("drop"); }, i * step));
  });
  setTimeout(() => {
    document.querySelectorAll("#result .balls").forEach(row => {
      const sorted = row.dataset.order.split(",").map(Number).sort((a, b) => a - b);
      row.innerHTML = sorted.map(n => ballHTML(n)).join("");
    });
    go.disabled = false;
    go.textContent = "다시 뽑기";
  }, 6 * step + (reduce ? 0 : 500));

  markSlip(drawn[0], !reduce);
  $("#result").dataset.mode = mode;
}

/* ---------- 최근 당첨 ---------- */
function renderLatest() {
  const d = draws.find(x => x[0] === viewRound) || draws[draws.length - 1];
  viewRound = d[0];
  $("#round-label").textContent = `${won(d[0])}회`;
  $("#latest-balls").innerHTML = `<div class="balls">${d.slice(2, 8).map(n => ballHTML(n, "big")).join("")}<span class="plus">+</span>${ballHTML(d[8], "big")}</div>`;
  const newest = draws[draws.length - 1][0];
  $("#latest-date").textContent = `${fmtDate(d[1])} 추첨 · 마지막 공은 보너스 번호${d[0] === newest ? " · 가장 최근 회차" : ""}`;
  $("#prev-round").disabled = d[0] <= draws[0][0];
  $("#next-round").disabled = d[0] >= newest;
}

/* ---------- 통계 구역 ---------- */
function renderStats() {
  const s = stats(currentRange());
  const hot = [...NUMS].sort((a, b) => s.count[b] - s.count[a] || a - b).slice(0, 6);
  const cold = [...NUMS].sort((a, b) => s.gap[b] - s.gap[a] || a - b).slice(0, 6);
  const maxC = s.count[hot[0]] || 1, maxG = s.gap[cold[0]] || 1;
  $("#hot-list").innerHTML = hot.map(n => `<li>${ballHTML(n)}<span class="meter"><i style="width:${(s.count[n] / maxC * 100).toFixed(1)}%"></i></span><span class="val">${s.count[n]}번</span></li>`).join("");
  $("#cold-list").innerHTML = cold.map(n => `<li>${ballHTML(n)}<span class="meter"><i style="width:${(s.gap[n] / maxG * 100).toFixed(1)}%"></i></span><span class="val">${s.gap[n]}회째</span></li>`).join("");

  const max = Math.max(...NUMS.map(n => s.count[n])) || 1;
  const bars = $("#bars");
  bars.innerHTML = NUMS.map(n => `<i style="height:${(s.count[n] / max * 100).toFixed(1)}%;--c:var(--b${Math.min(5, Math.ceil(n / 10))})" title="${n}번: ${s.count[n]}번"></i>`).join("");
  bars.setAttribute("aria-label", `${s.list.length}회 동안 번호별 나온 횟수. 가장 많이 나온 번호는 ${hot[0]}번(${s.count[hot[0]]}번).`);
}

function renderTotals() {
  const first = draws[0], last = draws[draws.length - 1];
  document.querySelectorAll("[data-total]").forEach(el => {
    el.textContent = `${first[0]}~${won(last[0])}회차(${fmtDate(last[1])}까지)`;
  });
}

/* ---------- 내 번호 (브라우저에만 저장) ---------- */
function loadMine() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; } }
function saveMine(list) { try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); return true; } catch { return false; } }

function grade(nums, d) {
  const win = new Set(d.slice(2, 8));
  const hit = nums.filter(n => win.has(n)).length;
  const bonus = nums.includes(d[8]);
  if (hit === 6) return { hit, rank: 1 };
  if (hit === 5 && bonus) return { hit, rank: 2, bonus };
  if (hit === 5) return { hit, rank: 3 };
  if (hit === 4) return { hit, rank: 4 };
  if (hit === 3) return { hit, rank: 5 };
  return { hit, rank: 0 };
}

function renderMine() {
  const list = loadMine();
  const ul = $("#mine-list");
  $("#clear-mine").hidden = !list.length;
  if (!list.length) { ul.innerHTML = ""; return; }
  const newest = draws[draws.length - 1];
  // 저장한 날 다음 추첨 회차와 맞춰 본다. 아직 추첨 전이면 가장 최근 회차와 비교만 보여 준다.
  ul.innerHTML = list.map((m, i) => {
    const target = draws.find(d => d[0] === m.round) ;
    const d = target || newest;
    const g = grade(m.nums, d);
    const win = new Set(d.slice(2, 8));
    const verdict = target
      ? (g.rank ? `${m.round}회 ${g.rank}등이에요` : `${m.round}회 ${g.hit}개 맞음`)
      : `${m.round}회 추첨 전 · ${newest[0]}회와 비교하면 ${g.hit}개 같음`;
    return `<li>
      <span class="meta">${fmtDate(m.saved)} 저장<br>${MODE_NAME[m.mode] || ""}</span>
      <span class="balls">${m.nums.map(n => ballHTML(n, win.has(n) ? "hit" : (target ? "dim" : ""))).join("")}</span>
      <span class="verdict ${target && g.rank ? "win" : ""}">${verdict}</span>
      <button type="button" class="del" data-i="${i}">지우기</button>
    </li>`;
  }).join("");
}

function todayKST() {
  return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
}
// 지금 산 표가 들어갈 회차: 가장 최근 회차 다음 회차
function nextRound() { return draws[draws.length - 1][0] + 1; }

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("on");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2200);
}

/* ---------- 시작 ---------- */
function bind() {
  $("#picker").addEventListener("submit", onDraw);
  document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener("change", () => { $("#mode-note").textContent = MODE_NOTE[r.value]; }));
  document.querySelectorAll('input[name="range"]').forEach(r => r.addEventListener("change", () => { renderSlip(); renderStats(); }));
  $("#slip-grid").addEventListener("click", e => { const c = e.target.closest(".cell"); if (c) showTip(Number(c.dataset.n)); });
  $("#prev-round").addEventListener("click", () => { viewRound--; renderLatest(); });
  $("#next-round").addEventListener("click", () => { viewRound++; renderLatest(); });

  $("#result").addEventListener("click", e => {
    const b = e.target.closest(".save");
    if (!b || b.getAttribute("aria-pressed") === "true" || !lastDraw) return;
    const nums = [...lastDraw[Number(b.dataset.li)]].sort((a, c) => a - c);
    const list = loadMine();
    list.unshift({ nums, mode: $("#result").dataset.mode, saved: todayKST(), round: nextRound() });
    if (!saveMine(list.slice(0, 50))) { toast("이 브라우저에서는 저장할 수 없어요. 개인정보 보호 모드인지 확인해 주세요."); return; }
    b.setAttribute("aria-pressed", "true"); b.textContent = "저장됨";
    renderMine();
    toast(`${nextRound()}회 번호로 저장했어요`);
  });
  $("#mine-list").addEventListener("click", e => {
    const b = e.target.closest(".del"); if (!b) return;
    const list = loadMine(); list.splice(Number(b.dataset.i), 1); saveMine(list); renderMine();
  });
  $("#clear-mine").addEventListener("click", () => {
    if (!confirm("저장한 번호를 모두 지울까요?")) return;
    saveMine([]); renderMine();
  });
}

function renderAll() { renderTotals(); renderSlip(); renderStats(); renderLatest(); renderMine(); }

async function start() {
  bind();
  try {
    const res = await fetch("data/draws.json");
    draws = (await res.json()).draws;
  } catch {
    $("#result").innerHTML = `<p class="result-empty">당첨 기록을 불러오지 못했어요. 새로고침해 보세요.</p>`;
    return;
  }
  viewRound = draws[draws.length - 1][0];
  renderAll();

  // 추첨 뒤 새 회차가 있으면 더한다
  try {
    const have = draws[draws.length - 1][0];
    const res = await fetch(`/api/latest?from=${have + 1}`);
    if (!res.ok) return;
    const { draws: fresh } = await res.json();
    const add = (fresh || []).filter(d => d[0] > have).sort((a, b) => a[0] - b[0]);
    if (!add.length) return;
    // 회차가 빠짐없이 이어질 때만 더한다
    if (add.some((d, i) => d[0] !== have + 1 + i)) return;
    const wasNewest = viewRound === have;
    draws = draws.concat(add);
    if (wasNewest) viewRound = draws[draws.length - 1][0];
    renderAll();
  } catch { /* 새 회차를 못 받아도 저장된 기록으로 계속 쓴다 */ }
}

start();
