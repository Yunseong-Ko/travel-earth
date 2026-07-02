export const ORIGIN_REGION_OPTIONS = [
  {
    id: "SEOUL_CAPITAL",
    label: "서울/경기",
    airports: ["ICN", "GMP"],
  },
  {
    id: "BUSAN_SOUTHEAST",
    label: "부산/울산/경남",
    airports: ["PUS"],
  },
] as const;

// 국내 근교 목적지 코드(공항 IATA 아님 — 항공권 축 없이 날씨+활동만으로 평가됨).
// 이동수단은 자가용이 지배적(국내여행의 85.2%, 국민여행조사 2024)이므로 특정 교통수단으로 프레이밍하지 않는다.
export const GROUND_DESTINATION_CODES = [
  "GANGNEUNG",
  "SOKCHO",
  "YANGYANG",
  "PYEONGCHANG",
  "JEONJU",
  "GYEONGJU",
  "TONGYEONG",
  "GEOJE",
  "NAMHAE",
  "SUNCHEON",
  "DAMYANG",
  "GAPYEONG",
  "CHUNCHEON",
  "ANDONG",
  "MOKPO",
  "DANYANG",
  "TAEAN",
  "BOSEONG",
  "BORYEONG",
  "ASAN",
  "BUYEO",
  "GANGHWA",
] as const;

const GROUND_DESTINATION_SET = new Set<string>(GROUND_DESTINATION_CODES);

export function isGroundOnlyDestination(code: string): boolean {
  return GROUND_DESTINATION_SET.has(code);
}

export const DESTINATION_REGION_OPTIONS = [
  {
    id: "KOREA_DOMESTIC",
    label: "국내선",
    airports: ["CJU", "CJJ", "TAE", "KWJ", "RSU", "USN"],
  },
  {
    id: "KOREA_GROUND",
    label: "국내 근교(주말·당일)",
    airports: [...GROUND_DESTINATION_CODES],
  },
  {
    id: "JAPAN",
    label: "일본",
    airports: ["NRT", "KIX", "FUK"],
  },
  {
    id: "TAIWAN_HK",
    label: "대만/홍콩",
    airports: ["TPE", "HKG"],
  },
  {
    id: "SOUTHEAST_ASIA",
    label: "동남아",
    airports: ["BKK", "SIN", "CEB", "DAD", "DPS"],
  },
] as const;

export type OriginRegionCode = (typeof ORIGIN_REGION_OPTIONS)[number]["id"];
export type DestinationRegionCode =
  (typeof DESTINATION_REGION_OPTIONS)[number]["id"];
export type OriginIata = "ICN" | "PUS" | "GMP";

export const ORIGIN_REGION_MAP = Object.fromEntries(
  ORIGIN_REGION_OPTIONS.map((item) => [item.id, [...item.airports]]),
) as Record<OriginRegionCode, OriginIata[]>;

export const DESTINATION_REGION_MAP = Object.fromEntries(
  DESTINATION_REGION_OPTIONS.map((item) => [item.id, [...item.airports]]),
) as Record<DestinationRegionCode, string[]>;

export const ALL_DESTINATION_REGIONS = DESTINATION_REGION_OPTIONS.map(
  (item) => item.id,
) as DestinationRegionCode[];

export const ALL_DESTINATION_AIRPORTS = [
  ...new Set(
    DESTINATION_REGION_OPTIONS.flatMap((item) => item.airports.map((code) => code)),
  ),
];

export function getDestinationAirportsByRegions(
  regionIds: DestinationRegionCode[],
): string[] {
  return [
    ...new Set(
      regionIds.flatMap((regionId) => DESTINATION_REGION_MAP[regionId] ?? []),
    ),
  ];
}

export function resolveOriginRegionByAirport(
  airportCode: string,
): OriginRegionCode | null {
  const normalized = airportCode.trim().toUpperCase();
  for (const region of ORIGIN_REGION_OPTIONS) {
    if ((region.airports as readonly string[]).includes(normalized)) {
      return region.id;
    }
  }
  return null;
}

export const ACTIVITY_OPTIONS = [
  { id: "BEACH", label: "해변/물놀이" },
  { id: "RESORT", label: "휴양/리조트" },
  { id: "SURFING", label: "서핑" },
  { id: "DIVING", label: "다이빙/스노클" },
  { id: "CITY", label: "도시관광" },
  { id: "SHOPPING", label: "쇼핑" },
  { id: "FOOD", label: "미식/맛집" },
  { id: "NIGHTVIEW", label: "야경/사진" },
  { id: "NIGHTLIFE", label: "나이트라이프" },
  { id: "THEME_PARK", label: "테마파크" },
  { id: "HOTSPRING", label: "온천/스파" },
  { id: "CULTURE", label: "역사/문화" },
  { id: "HIKING", label: "하이킹/트레킹" },
  { id: "NATURE", label: "자연/풍경" },
] as const;

export type ActivityTag = (typeof ACTIVITY_OPTIONS)[number]["id"];

export const ACTIVITY_LABELS = Object.fromEntries(
  ACTIVITY_OPTIONS.map((item) => [item.id, item.label]),
) as Record<ActivityTag, string>;

export const ALL_ACTIVITY_TAGS = ACTIVITY_OPTIONS.map(
  (item) => item.id,
) as ActivityTag[];

// "장소 요구": 각 도시가 실제로 가능한 액티비티. 거의 안 변하므로 정적 캐싱한다.
// 매 요청마다 POI를 호출하지 않고 이 테이블로 장소 매치를 판정한다.
export const DESTINATION_ACTIVITIES: Record<string, ActivityTag[]> = {
  CJU: ["BEACH", "NATURE", "HIKING", "CITY", "RESORT", "FOOD", "CULTURE"],
  CJJ: ["CITY", "NATURE", "CULTURE"],
  TAE: ["CITY", "SHOPPING", "FOOD", "NIGHTVIEW"],
  KWJ: ["CITY", "NATURE", "FOOD", "CULTURE"],
  RSU: ["BEACH", "CITY", "NATURE", "NIGHTVIEW", "FOOD"],
  USN: ["CITY", "NATURE", "BEACH", "NIGHTVIEW"],
  NRT: ["CITY", "SHOPPING", "THEME_PARK", "FOOD", "NIGHTVIEW", "NIGHTLIFE", "CULTURE"],
  KIX: ["CITY", "SHOPPING", "THEME_PARK", "FOOD", "NIGHTLIFE"],
  FUK: ["CITY", "SHOPPING", "NATURE", "FOOD", "HOTSPRING"],
  TPE: ["CITY", "SHOPPING", "NATURE", "FOOD", "HOTSPRING", "NIGHTVIEW"],
  HKG: ["CITY", "SHOPPING", "THEME_PARK", "FOOD", "NIGHTVIEW", "NIGHTLIFE"],
  BKK: ["CITY", "SHOPPING", "NATURE", "BEACH", "FOOD", "NIGHTLIFE", "CULTURE"],
  SIN: ["CITY", "SHOPPING", "THEME_PARK", "FOOD", "NIGHTVIEW", "NIGHTLIFE"],
  CEB: ["BEACH", "DIVING", "NATURE", "RESORT"],
  DAD: ["BEACH", "CITY", "NATURE", "RESORT", "CULTURE"],
  DPS: ["BEACH", "SURFING", "DIVING", "NATURE", "RESORT"],
  GANGNEUNG: ["BEACH", "FOOD", "NATURE", "NIGHTVIEW"],
  SOKCHO: ["BEACH", "NATURE", "HIKING", "FOOD"],
  YANGYANG: ["BEACH", "SURFING", "NATURE"],
  PYEONGCHANG: ["NATURE", "HIKING"],
  JEONJU: ["FOOD", "CULTURE"],
  GYEONGJU: ["CULTURE", "NATURE"],
  TONGYEONG: ["BEACH", "FOOD", "NATURE"],
  GEOJE: ["BEACH", "NATURE"],
  NAMHAE: ["BEACH", "NATURE"],
  SUNCHEON: ["NATURE", "CULTURE"],
  DAMYANG: ["NATURE"],
  GAPYEONG: ["NATURE", "HIKING"],
  CHUNCHEON: ["NATURE", "FOOD"],
  ANDONG: ["CULTURE"],
  MOKPO: ["BEACH", "FOOD", "CULTURE", "NIGHTVIEW"],
  DANYANG: ["NATURE", "HIKING"],
  TAEAN: ["BEACH"],
  BOSEONG: ["NATURE"],
  BORYEONG: ["BEACH"],
  ASAN: ["HOTSPRING"],
  BUYEO: ["CULTURE"],
  GANGHWA: ["NATURE", "CULTURE"],
};

export function getDestinationActivities(
  destinationIata: string,
): ActivityTag[] {
  return DESTINATION_ACTIVITIES[destinationIata] ?? ["CITY"];
}

// 목적지 한 줄 태그라인 — 카드에 개성을 입히는 카피. 과장 없이 짧고 구체적으로.
export const DESTINATION_TAGLINES: Record<string, string> = {
  CJU: "설명이 필요 없는 그 섬",
  CJJ: "느긋한 충청 감성",
  TAE: "더위도 맛도 화끈한 도시",
  KWJ: "예향의 밥상은 못 참지",
  RSU: "밤바다는 들어봤잖아요",
  USN: "바다 옆 반전 매력",
  NRT: "갈 때마다 새로운 도시",
  KIX: "먹다가 하루 다 가는 곳",
  FUK: "퇴근하고 가는 일본",
  TPE: "야시장 냄새가 부르는 곳",
  HKG: "야경 하나로 본전 뽑기",
  BKK: "혼돈과 맛의 수도",
  SIN: "비 와도 할 게 많은 도시",
  CEB: "바다색이 반칙인 곳",
  DAD: "국민 휴양지엔 이유가 있다",
  DPS: "서퍼들의 성지",
  GANGNEUNG: "커피 한 잔에 바다 한 스푼",
  SOKCHO: "설악과 바다를 한 번에",
  YANGYANG: "서울에서 제일 가까운 서핑",
  PYEONGCHANG: "한여름에도 서늘한 고원",
  JEONJU: "한 끼도 허투루 못 먹는 도시",
  GYEONGJU: "도시 전체가 박물관",
  TONGYEONG: "바다 맛의 본고장",
  GEOJE: "몽돌 구르는 소리 들으러",
  NAMHAE: "느리게 걷고 싶은 섬",
  SUNCHEON: "갈대밭 노을 맛집",
  DAMYANG: "대나무 숲 산책 한 스푼",
  GAPYEONG: "서울 옆 초록 휴가",
  CHUNCHEON: "닭갈비만으로도 갈 이유",
  ANDONG: "고즈넉함이 필요할 때",
  MOKPO: "항구의 맛과 노을",
  DANYANG: "굽이굽이 강 따라",
  TAEAN: "서해 노을 원픽",
  BOSEONG: "초록 물결 녹차밭",
  BORYEONG: "머드 아니어도 좋은 바다",
  ASAN: "비 오면 여기지, 온천",
  BUYEO: "백제의 조용한 위엄",
  GANGHWA: "서울에서 제일 가까운 섬 여행",
};

export const AIRPORT_GEO: Record<
  string,
  { city: string; lat: number; lon: number }
> = {
  ICN: { city: "인천", lat: 37.4602, lon: 126.4407 },
  GMP: { city: "서울", lat: 37.5583, lon: 126.7906 },
  PUS: { city: "부산", lat: 35.1796, lon: 128.9382 },
  CJU: { city: "제주", lat: 33.5113, lon: 126.4928 },
  CJJ: { city: "청주", lat: 36.717, lon: 127.4989 },
  TAE: { city: "대구", lat: 35.8941, lon: 128.6588 },
  KWJ: { city: "광주", lat: 35.1264, lon: 126.8089 },
  RSU: { city: "여수", lat: 34.84, lon: 127.6169 },
  USN: { city: "울산", lat: 35.5935, lon: 129.3525 },
  NRT: { city: "도쿄", lat: 35.772, lon: 140.3929 },
  KIX: { city: "오사카", lat: 34.4347, lon: 135.244 },
  FUK: { city: "후쿠오카", lat: 33.5859, lon: 130.4507 },
  TPE: { city: "타이베이", lat: 25.0797, lon: 121.2342 },
  HKG: { city: "홍콩", lat: 22.308, lon: 113.9185 },
  BKK: { city: "방콕", lat: 13.69, lon: 100.7501 },
  SIN: { city: "싱가포르", lat: 1.3644, lon: 103.9915 },
  CEB: { city: "세부", lat: 10.3075, lon: 123.9792 },
  DAD: { city: "다낭", lat: 16.0544, lon: 108.2022 },
  DPS: { city: "발리", lat: -8.7482, lon: 115.167 },
  GANGNEUNG: { city: "강릉", lat: 37.7519, lon: 128.8761 },
  SOKCHO: { city: "속초", lat: 38.207, lon: 128.5918 },
  YANGYANG: { city: "양양", lat: 38.0755, lon: 128.6191 },
  PYEONGCHANG: { city: "평창", lat: 37.3705, lon: 128.3903 },
  JEONJU: { city: "전주", lat: 35.8242, lon: 127.148 },
  GYEONGJU: { city: "경주", lat: 35.8562, lon: 129.2247 },
  TONGYEONG: { city: "통영", lat: 34.8544, lon: 128.4331 },
  GEOJE: { city: "거제", lat: 34.8806, lon: 128.6211 },
  NAMHAE: { city: "남해", lat: 34.8375, lon: 127.8925 },
  SUNCHEON: { city: "순천", lat: 34.9506, lon: 127.4872 },
  DAMYANG: { city: "담양", lat: 35.3212, lon: 126.988 },
  GAPYEONG: { city: "가평", lat: 37.8315, lon: 127.5097 },
  CHUNCHEON: { city: "춘천", lat: 37.8813, lon: 127.73 },
  ANDONG: { city: "안동", lat: 36.5684, lon: 128.7294 },
  MOKPO: { city: "목포", lat: 34.8118, lon: 126.3922 },
  DANYANG: { city: "단양", lat: 36.9845, lon: 128.3654 },
  TAEAN: { city: "태안", lat: 36.7455, lon: 126.2977 },
  BOSEONG: { city: "보성", lat: 34.7714, lon: 127.08 },
  BORYEONG: { city: "보령", lat: 36.3335, lon: 126.6128 },
  ASAN: { city: "아산(온양온천)", lat: 36.7898, lon: 127.0019 },
  BUYEO: { city: "부여", lat: 36.2755, lon: 126.9098 },
  GANGHWA: { city: "강화", lat: 37.7465, lon: 126.4877 },
};
