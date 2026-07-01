import { diffDaysIso } from "@/lib/recommendation/date";
import {
  ALL_ACTIVITY_TAGS,
  ALL_DESTINATION_AIRPORTS,
  ALL_DESTINATION_REGIONS,
  DESTINATION_REGION_OPTIONS,
  GROUND_DESTINATION_CODES,
  ORIGIN_REGION_MAP,
  ORIGIN_REGION_OPTIONS,
  getDestinationAirportsByRegions,
  resolveOriginRegionByAirport,
  type ActivityTag,
  type DestinationRegionCode,
  type OriginIata,
  type OriginRegionCode,
} from "@/lib/recommendation/regions";

const KNOWN_DESTINATION_CODES = new Set<string>([
  ...ALL_DESTINATION_AIRPORTS,
  ...GROUND_DESTINATION_CODES,
]);

export type ProviderCode = "SKYSCANNER" | "AMADEUS" | "GROUND";

// 점수 가중치 프리셋. A(날씨우선) / B(딜우선) / 균형.
export type RecommendationMode = "BALANCED" | "WEATHER_FIRST" | "DEAL_FIRST";

export const DESTINATION_LABELS: Record<string, string> = {
  CJU: "제주",
  CJJ: "청주",
  TAE: "대구",
  KWJ: "광주",
  RSU: "여수",
  USN: "울산",
  NRT: "도쿄",
  KIX: "오사카",
  FUK: "후쿠오카",
  TPE: "타이베이",
  HKG: "홍콩",
  BKK: "방콕",
  SIN: "싱가포르",
  CEB: "세부",
  DAD: "다낭",
  DPS: "발리",
  GANGNEUNG: "강릉",
  SOKCHO: "속초",
  YANGYANG: "양양",
  PYEONGCHANG: "평창",
  JEONJU: "전주",
  GYEONGJU: "경주",
  TONGYEONG: "통영",
  GEOJE: "거제",
  NAMHAE: "남해",
  SUNCHEON: "순천",
  DAMYANG: "담양",
  GAPYEONG: "가평",
  CHUNCHEON: "춘천",
  ANDONG: "안동",
  MOKPO: "목포",
  DANYANG: "단양",
  TAEAN: "태안",
  BOSEONG: "보성",
  BORYEONG: "보령",
  ASAN: "아산(온양온천)",
  BUYEO: "부여",
  GANGHWA: "강화",
};

export const DEFAULT_DESTINATIONS = getDestinationAirportsByRegions(
  ALL_DESTINATION_REGIONS,
);

export type WeatherPreference = {
  temp_min_c: number;
  temp_max_c: number;
  max_precip_prob: number;
  max_wind_mps: number;
};

export type RecommendationRequest = {
  origin_region: OriginRegionCode;
  origin_iatas: OriginIata[];
  destination_regions: DestinationRegionCode[];
  candidate_destinations: string[];
  earliest_departure: string;
  latest_return: string;
  min_nights: number;
  max_nights: number;
  budget_max_krw: number;
  weather_preference: WeatherPreference;
  activities: ActivityTag[];
  mode: RecommendationMode;
  nonstop_only: boolean;
};

export type RecommendationItem = {
  rank: number;
  provider: ProviderCode;
  // FLIGHT: 항공권 기반(공항). GROUND: 국내 근교, 기차/버스로 이동(항공권 축 없음).
  transport_mode: "FLIGHT" | "GROUND";
  origin_iata: OriginIata;
  destination_iata: string;
  destination_name: string;
  depart_date: string;
  return_date: string;
  price_krw: number;
  price_is_live: boolean;
  weather_score: number;
  activity_score: number;
  price_score: number;
  convenience_score: number;
  total_score: number;
  matched_activities: ActivityTag[];
  weather_source: "FORECAST" | "NORMAL" | "ESTIMATE";
  weather_summary: { avgTemp: number; avgPrecip: number; avgWind: number };
  weather_daily: Array<{ date: string; hi: number; lo: number; precip: number }>;
  score_explanations: {
    weather: string;
    activity: string;
    price: string;
    convenience: string;
    total: string;
  };
  rationale: string;
  flight_deeplink_url: string;
};

export type RecommendationResponse = {
  run_id: string;
  scoring_version: string;
  status: "SUCCESS" | "PARTIAL_FAILURE";
  items: RecommendationItem[];
  partial_failures: string[];
  social?: {
    search_count: number;
    viewers: number;
  };
};

type ValidationResult =
  | { ok: true; value: RecommendationRequest }
  | { ok: false; errors: string[] };

const DEFAULT_WEATHER: WeatherPreference = {
  temp_min_c: 20,
  temp_max_c: 28,
  max_precip_prob: 40,
  max_wind_mps: 8,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function toInt(value: unknown): number | null {
  const parsed = toNumber(value);
  if (parsed === null) {
    return null;
  }
  return Math.round(parsed);
}

export function validateRecommendationRequest(raw: unknown): ValidationResult {
  const body = asRecord(raw);
  if (!body) {
    return { ok: false, errors: ["JSON object payload is required."] };
  }

  const errors: string[] = [];
  const validOriginRegionSet = new Set(
    ORIGIN_REGION_OPTIONS.map((item) => item.id),
  );
  const rawOriginRegion = String(body.origin_region ?? "")
    .trim()
    .toUpperCase() as OriginRegionCode;
  const rawOriginAirport = String(body.origin_iata ?? "").trim().toUpperCase();

  let originRegion: OriginRegionCode | null = null;
  if (validOriginRegionSet.has(rawOriginRegion)) {
    originRegion = rawOriginRegion;
  } else if (rawOriginAirport) {
    originRegion = resolveOriginRegionByAirport(rawOriginAirport);
  }

  if (!originRegion) {
    errors.push(
      `origin_region must be one of: ${ORIGIN_REGION_OPTIONS.map((item) => item.id).join(", ")}.`,
    );
  }

  const earliestDeparture = String(body.earliest_departure ?? "");
  const latestReturn = String(body.latest_return ?? "");
  if (!isIsoDate(earliestDeparture)) {
    errors.push("earliest_departure must be YYYY-MM-DD.");
  }
  if (!isIsoDate(latestReturn)) {
    errors.push("latest_return must be YYYY-MM-DD.");
  }
  if (isIsoDate(earliestDeparture) && isIsoDate(latestReturn)) {
    if (earliestDeparture > latestReturn) {
      errors.push("earliest_departure must be before latest_return.");
    }
    if (diffDaysIso(earliestDeparture, latestReturn) > 60) {
      errors.push("search window must be 60 days or less.");
    }
  }

  const minNights = toInt(body.min_nights);
  const maxNights = toInt(body.max_nights);
  if (minNights === null || minNights < 1) {
    errors.push("min_nights must be >= 1.");
  }
  if (maxNights === null || maxNights < 1) {
    errors.push("max_nights must be >= 1.");
  }
  if (minNights !== null && maxNights !== null && maxNights < minNights) {
    errors.push("max_nights must be >= min_nights.");
  }

  const budgetMax = toInt(body.budget_max_krw);
  if (budgetMax === null || budgetMax < 100000) {
    errors.push("budget_max_krw must be >= 100000.");
  }

  const weatherRaw = asRecord(body.weather_preference) ?? {};
  const weatherPreference: WeatherPreference = {
    temp_min_c: toNumber(weatherRaw.temp_min_c) ?? DEFAULT_WEATHER.temp_min_c,
    temp_max_c: toNumber(weatherRaw.temp_max_c) ?? DEFAULT_WEATHER.temp_max_c,
    max_precip_prob:
      toNumber(weatherRaw.max_precip_prob) ?? DEFAULT_WEATHER.max_precip_prob,
    max_wind_mps:
      toNumber(weatherRaw.max_wind_mps) ?? DEFAULT_WEATHER.max_wind_mps,
  };

  if (weatherPreference.temp_max_c < weatherPreference.temp_min_c) {
    errors.push("weather_preference.temp_max_c must be >= temp_min_c.");
  }
  if (
    weatherPreference.max_precip_prob < 0 ||
    weatherPreference.max_precip_prob > 100
  ) {
    errors.push("weather_preference.max_precip_prob must be 0-100.");
  }
  if (weatherPreference.max_wind_mps <= 0) {
    errors.push("weather_preference.max_wind_mps must be > 0.");
  }

  const validDestinationRegionSet = new Set(
    DESTINATION_REGION_OPTIONS.map((item) => item.id),
  );
  const rawDestinationRegions = Array.isArray(body.destination_regions)
    ? body.destination_regions
    : [];
  const normalizedDestinationRegions = rawDestinationRegions
    .map((item) => String(item).trim().toUpperCase())
    .filter((item): item is DestinationRegionCode =>
      validDestinationRegionSet.has(item as DestinationRegionCode),
    );
  if (rawDestinationRegions.length > 0 && normalizedDestinationRegions.length === 0) {
    errors.push(
      `destination_regions must include one of: ${DESTINATION_REGION_OPTIONS.map((item) => item.id).join(", ")}.`,
    );
  }

  let destinationRegions: DestinationRegionCode[] =
    normalizedDestinationRegions.length > 0
      ? [...new Set(normalizedDestinationRegions)]
      : ALL_DESTINATION_REGIONS;

  const rawDestinations = body.candidate_destinations;
  let candidateDestinations = getDestinationAirportsByRegions(destinationRegions);
  if (Array.isArray(rawDestinations) && rawDestinations.length > 0) {
    const normalized = rawDestinations
      .map((item) => String(item).trim().toUpperCase())
      .filter((item) => KNOWN_DESTINATION_CODES.has(item));
    candidateDestinations = [...new Set(normalized)];
    destinationRegions = ALL_DESTINATION_REGIONS;
  }

  if (candidateDestinations.length === 0) {
    errors.push("candidate_destinations must include at least one IATA code.");
  }

  const validActivitySet = new Set<ActivityTag>(ALL_ACTIVITY_TAGS);
  const rawActivities = Array.isArray(body.activities) ? body.activities : [];
  const activities = [
    ...new Set(
      rawActivities
        .map((item) => String(item).trim().toUpperCase())
        .filter((item): item is ActivityTag =>
          validActivitySet.has(item as ActivityTag),
        ),
    ),
  ];

  const rawMode = String(body.mode ?? "BALANCED").trim().toUpperCase();
  const mode: RecommendationMode =
    rawMode === "WEATHER_FIRST" || rawMode === "DEAL_FIRST"
      ? rawMode
      : "BALANCED";

  if (
    errors.length > 0 ||
    !originRegion ||
    minNights === null ||
    maxNights === null ||
    budgetMax === null
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      origin_region: originRegion,
      origin_iatas: ORIGIN_REGION_MAP[originRegion],
      destination_regions: destinationRegions,
      candidate_destinations: candidateDestinations,
      earliest_departure: earliestDeparture,
      latest_return: latestReturn,
      min_nights: minNights,
      max_nights: maxNights,
      budget_max_krw: budgetMax,
      weather_preference: weatherPreference,
      activities,
      mode,
      nonstop_only: Boolean(body.nonstop_only),
    },
  };
}

export function formatKrw(value: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
}
