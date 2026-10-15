# 로또 번호 추출기

동행복권 공식 지난 당첨 기록으로 자주 나온 번호와 오래 쉰 번호를 보고, 추첨하듯 공을 굴려 번호를 뽑는 사이트.

- 사이트: https://lotto-number-picker-one.vercel.app
- 설계도: [docs/PRD.md](docs/PRD.md)

## 구성
- `index.html`, `styles.css`, `app.js` — 화면 (빌드 없음)
- `data/draws.json` — 1회차부터의 당첨 번호 (동행복권 공식 추첨결과)
- `api/latest.js` — 저장된 기록 뒤로 새로 추첨된 회차를 받아 오는 Vercel 함수 (서울 리전)
- `scripts/fetch-draws.mjs` — `data/draws.json` 을 새 회차까지 채우기: `npm run fetch-draws`

`main` 브랜치에 Push 하면 Vercel이 자동으로 배포한다.
