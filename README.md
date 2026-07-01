# Travel EARTH Web MVP

EARTH-2 날씨 예측 신호와 항공권 데이터를 결합해 여행지/일정/항공권을 추천하는 웹 MVP입니다.

## 현재 구현 범위

1. 입력 폼: 출발/도착 `지역 선택`, 예산, 날짜, 숙박일, 날씨 선호, 무경유 옵션
2. `지구본 선택` 모드: 출발/도착 공항을 클릭으로 선택
3. 추천 API: `POST /api/v1/recommendations`
4. 공급자 로직: `Skyscanner 우선 -> Amadeus fallback`
5. 추천 결과: Top 5 후보 + 점수(날씨/가격/편의) + `각 점수 설명` + 딥링크
6. 국내선 포함(`CJU`, `CJJ`, `TAE`, `KWJ`, `RSU`, `USN`)
7. API 키 설정 시 실연동:
- Skyscanner Live Pricing API
- Amadeus Flight Offers API

## 실행 방법

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## API 예시

```bash
curl -X POST http://localhost:3000/api/v1/recommendations \
  -H "Content-Type: application/json" \
  -d '{
    "origin_region": "SEOUL_CAPITAL",
    "destination_regions": ["JAPAN", "SOUTHEAST_ASIA"],
    "earliest_departure": "2026-05-01",
    "latest_return": "2026-05-31",
    "min_nights": 3,
    "max_nights": 6,
    "budget_max_krw": 1500000,
    "weather_preference": {
      "temp_min_c": 20,
      "temp_max_c": 28,
      "max_precip_prob": 40,
      "max_wind_mps": 8
    },
    "nonstop_only": false
  }'
```

## API 키 설정(선택)

실 API를 쓰려면 `web/.env.local` 파일에 아래 값을 설정합니다.

```bash
# Skyscanner
SKYSCANNER_API_KEY=your_key
SKYSCANNER_BASE_URL=https://partners.api.skyscanner.net
SKYSCANNER_MARKET=KR
SKYSCANNER_LOCALE=ko-KR
SKYSCANNER_CURRENCY=KRW

# Amadeus
AMADEUS_CLIENT_ID=your_client_id
AMADEUS_CLIENT_SECRET=your_client_secret
AMADEUS_BASE_URL=https://test.api.amadeus.com
AMADEUS_CURRENCY=KRW
```

키가 없으면 mock 데이터로 동작합니다.

## 로컬 성능 튜닝(권장)

추천 1회당 조합 수가 많아지면 CPU 사용량이 커질 수 있습니다. 아래 환경변수로 계산 상한을 줄일 수 있습니다.

```bash
RECO_MAX_ITINERARIES=10
RECO_MAX_DESTINATIONS=8
```

기본값:
- `RECO_MAX_ITINERARIES=12`
- `RECO_MAX_DESTINATIONS=10`

## 폴더 구조

1. `src/app/page.tsx`: 메인 UI
2. `src/app/api/v1/recommendations/route.ts`: 추천 API
3. `src/lib/recommendation/*`: 추천 엔진/공급자/점수 로직
4. `../docs/MVP_PLAN_V0.1.md`: 제품/스키마/API 계획 문서
5. `../docs/BM_V0.1.md`: 비즈니스 모델 초안

## 참고

현재 항공권/날씨 호출은 MVP 프로토타이핑을 위한 결정론적 mock 로직입니다.
운영 전환 시 실제 공급자 SDK/API 연동으로 교체하면 됩니다.
