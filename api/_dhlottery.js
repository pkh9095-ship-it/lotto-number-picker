// 동행복권 추첨결과 페이지가 쓰는 주소에서 회차 근처 10회차를 받아 온다.
// 돌려주는 모양: [회차, "YYYY-MM-DD", n1, n2, n3, n4, n5, n6, 보너스]
export async function fetchAround(ep) {
  const url = `https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=${ep}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://www.dhlottery.co.kr/lt645/result",
    },
  });
  if (!res.ok) throw new Error(`동행복권 응답 ${res.status}`);
  const list = (await res.json())?.data?.list;
  if (!Array.isArray(list)) throw new Error("동행복권 응답 모양이 달라졌어요");
  return list.map(x => {
    const y = String(x.ltRflYmd);
    const nums = [x.tm1WnNo, x.tm2WnNo, x.tm3WnNo, x.tm4WnNo, x.tm5WnNo, x.tm6WnNo].map(Number);
    return [Number(x.ltEpsd), `${y.slice(0, 4)}-${y.slice(4, 6)}-${y.slice(6, 8)}`, ...nums, Number(x.bnsWnNo)];
  }).filter(d => d[0] > 0 && d.slice(2).every(n => n >= 1 && n <= 45));
}

// 1회차(2002-12-07 토요일)부터 매주 한 회차씩이라, 오늘 날짜로 가장 최근 회차를 어림한다.
// 추첨은 토요일 밤이라 결과가 아직 없을 수 있으니, 받아 올 때는 이 번호 근처를 묻는다.
export function estimateLatest(now = Date.now()) {
  const kst = now + 9 * 3600e3;
  const first = Date.UTC(2002, 11, 7, 21, 0); // 첫 추첨일 밤 9시(한국 시간)
  return Math.floor((kst - first) / (7 * 86400e3)) + 1;
}

// 가장 최근 10회차 (최근 회차부터)
export async function fetchLatest() {
  const est = estimateLatest();
  let list = await fetchAround(est);
  if (!list.length) list = await fetchAround(est - 1);
  return list.sort((a, b) => b[0] - a[0]);
}
