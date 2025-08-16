# PNU Converter API (19-digit, candidates)

**규격 고정**: 총 19자리 = 법정동코드(10) + 산여부(1) + 본번(4) + 부번(4)  
**매칭 우선순위**: 완전일치 > 끝-일치 > 포함  
**모호성 처리**: 동명이 여러 지역이면 후보 목록 반환

## 배포
1) 이 레포를 GitHub에 푸시
2) Vercel에서 **New Project** → 해당 레포 선택 → Node.js 18 기본값으로 **Deploy**

## 요청
- GET: `/api/pnu/convert?text=성수동2가%20277-55`
- POST:
```bash
curl -X POST "https://<your>.vercel.app/api/pnu/convert" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"text":"도봉구 창동 715-1"}'
