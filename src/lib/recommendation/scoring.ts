import {
  WEATHER_SOURCE_LABEL,
  type FlightOffer,
  type WeatherSnapshot,
} from "@/lib/recommendation/providers";
import {
  ACTIVITY_LABELS,
  type ActivityTag,
} from "@/lib/recommendation/regions";
import { formatKrw, type WeatherPreference } from "@/lib/recommendation/types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, item) => sum + item, 0) / values.length;
}

export type WeatherSummary = {
  avgTemp: number;
  avgPrecip: number;
  avgWind: number;
};

export function scoreWeather(
  forecast: WeatherSnapshot[],
  preference: WeatherPreference,
): number {
  if (forecast.length === 0) {
    return 0;
  }

  const tempCenter = (preference.temp_min_c + preference.temp_max_c) / 2;
  const tempRadius = Math.max((preference.temp_max_c - preference.temp_min_c) / 2, 1);

  const dayScores = forecast.map((day) => {
    const meanTemp = (day.temp_high_c + day.temp_low_c) / 2;
    const tempPenalty = (Math.abs(meanTemp - tempCenter) / (tempRadius + 3)) * 65;
    const precipPenalty = Math.max(0, day.precip_prob - preference.max_precip_prob) * 1.25;
    const windPenalty = Math.max(0, day.wind_mps - preference.max_wind_mps) * 5.5;
    const extremePenalty = day.extreme_risk * 0.35;

    return clamp(100 - tempPenalty - precipPenalty - windPenalty - extremePenalty, 0, 100);
  });

  return round1(average(dayScores));
}

export function summarizeForecast(forecast: WeatherSnapshot[]): WeatherSummary {
  return {
    avgTemp: round1(
      average(forecast.map((day) => (day.temp_high_c + day.temp_low_c) / 2)),
    ),
    avgPrecip: Math.round(average(forecast.map((day) => day.precip_prob))),
    avgWind: round1(average(forecast.map((day) => day.wind_mps))),
  };
}

type ActivityWeatherProfile = {
  idealTemp: number;
  tempTolerance: number;
  precipSensitivity: number; // 0..1, 강수가 점수를 깎는 강도
  windCeiling: number; // 이 풍속(m/s)을 넘으면 감점
  windRewards: boolean; // 서핑처럼 바람이 오히려 도움이 되는가
};

// "날씨 요구": 같은 도시라도 액티비티마다 좋은 날씨가 다르다.
// 메인 날씨 축과 이중 계산을 피하려고 영향은 보수적으로 잡았다.
const ACTIVITY_WEATHER: Record<ActivityTag, ActivityWeatherProfile> = {
  BEACH: { idealTemp: 28, tempTolerance: 6, precipSensitivity: 0.9, windCeiling: 8, windRewards: false },
  RESORT: { idealTemp: 29, tempTolerance: 6, precipSensitivity: 0.7, windCeiling: 9, windRewards: false },
  SURFING: { idealTemp: 25, tempTolerance: 7, precipSensitivity: 0.4, windCeiling: 14, windRewards: true },
  DIVING: { idealTemp: 28, tempTolerance: 5, precipSensitivity: 0.5, windCeiling: 6, windRewards: false },
  CITY: { idealTemp: 21, tempTolerance: 9, precipSensitivity: 0.5, windCeiling: 12, windRewards: false },
  SHOPPING: { idealTemp: 22, tempTolerance: 14, precipSensitivity: 0.1, windCeiling: 16, windRewards: false },
  FOOD: { idealTemp: 22, tempTolerance: 14, precipSensitivity: 0.15, windCeiling: 16, windRewards: false },
  NIGHTVIEW: { idealTemp: 20, tempTolerance: 10, precipSensitivity: 0.8, windCeiling: 12, windRewards: false },
  NIGHTLIFE: { idealTemp: 22, tempTolerance: 13, precipSensitivity: 0.25, windCeiling: 16, windRewards: false },
  THEME_PARK: { idealTemp: 22, tempTolerance: 8, precipSensitivity: 0.85, windCeiling: 10, windRewards: false },
  HOTSPRING: { idealTemp: 14, tempTolerance: 13, precipSensitivity: 0.2, windCeiling: 16, windRewards: false },
  CULTURE: { idealTemp: 19, tempTolerance: 9, precipSensitivity: 0.7, windCeiling: 11, windRewards: false },
  HIKING: { idealTemp: 17, tempTolerance: 7, precipSensitivity: 0.8, windCeiling: 9, windRewards: false },
  NATURE: { idealTemp: 20, tempTolerance: 9, precipSensitivity: 0.7, windCeiling: 11, windRewards: false },
};

function activityWeatherFit(
  activity: ActivityTag,
  summary: WeatherSummary,
): number {
  const profile = ACTIVITY_WEATHER[activity];
  const tempPenalty =
    (Math.abs(summary.avgTemp - profile.idealTemp) /
      (profile.tempTolerance + 3)) *
    55;
  const precipPenalty = summary.avgPrecip * profile.precipSensitivity * 0.7;
  const windPenalty = profile.windRewards
    ? Math.max(0, 4 - summary.avgWind) * 4 // 바람이 너무 약하면 서핑은 손해
    : Math.max(0, summary.avgWind - profile.windCeiling) * 6;

  return clamp(100 - tempPenalty - precipPenalty - windPenalty, 0, 100);
}

// 비 오는 날에도 되는(오히려 어울리는) 활동. 우천 적응 랭킹에 사용 —
// 사람들은 비가 오면 맑은 곳을 찾아 더 멀리 가는 게 아니라 활동을 실내형으로 바꾼다.
export const RAINY_DAY_ACTIVITIES: ActivityTag[] = [
  "HOTSPRING",
  "FOOD",
  "SHOPPING",
  "CULTURE",
];

export function explainRainAdaptiveScore(
  score: number,
  matched: ActivityTag[],
): string {
  if (matched.length === 0) {
    return `비 예보 구간이고 실내 대안 활동이 없어 우천 적합 ${score.toFixed(1)}점입니다.`;
  }
  const labels = matched.map((a) => ACTIVITY_LABELS[a]).join(", ");
  return `비 예보 기준, ${labels} 같은 우천 적합 활동이 가능해 ${score.toFixed(1)}점입니다.`;
}

export function scoreActivity(
  requested: ActivityTag[],
  destinationTags: ActivityTag[],
  summary: WeatherSummary,
): number {
  if (requested.length === 0) {
    return 0;
  }
  const tagSet = new Set(destinationTags);
  const perActivity = requested.map((activity) => {
    // 도시가 그 액티비티를 지원하지 않으면 장소 매치를 크게 깎는다(완전 0은 아님).
    const placeMatch = tagSet.has(activity) ? 1 : 0.15;
    return placeMatch * activityWeatherFit(activity, summary);
  });
  return round1(average(perActivity));
}

export function explainActivityScore(
  score: number,
  requested: ActivityTag[],
  destinationTags: ActivityTag[],
): string {
  if (requested.length === 0) {
    return "선택한 액티비티가 없어 활동 점수는 가중치에서 제외됩니다.";
  }
  const tagSet = new Set(destinationTags);
  const matched = requested
    .filter((activity) => tagSet.has(activity))
    .map((activity) => ACTIVITY_LABELS[activity]);
  const missing = requested
    .filter((activity) => !tagSet.has(activity))
    .map((activity) => ACTIVITY_LABELS[activity]);
  const matchedText =
    matched.length > 0 ? `가능: ${matched.join(", ")}` : "가능 활동 없음";
  const missingText = missing.length > 0 ? ` / 제한: ${missing.join(", ")}` : "";
  return `${matchedText}${missingText} 기준으로 활동 점수 ${score.toFixed(1)}점입니다.`;
}

export function scorePrice(priceKrw: number, budgetMaxKrw: number): number {
  const budget = Math.max(100000, budgetMaxKrw);

  if (priceKrw <= budget) {
    const ratio = priceKrw / budget;
    return round1(clamp(100 - ratio * 35, 64, 100));
  }

  const overRatio = (priceKrw - budget) / budget;
  return round1(clamp(68 - overRatio * 125, 0, 68));
}

export function scoreConvenience(
  offer: FlightOffer,
  nonstopOnly: boolean,
): number {
  let score = 100;
  score -= offer.stops * 20;
  score -= Math.max(0, offer.total_duration_min - 210) / 8;

  if (nonstopOnly && offer.stops > 0) {
    score -= 20;
  }
  if (offer.baggage_included) {
    score += 4;
  }

  return round1(clamp(score, 0, 100));
}

export function explainWeatherScore(
  score: number,
  summary: WeatherSummary,
  preference: WeatherPreference,
  forecast: WeatherSnapshot[],
): string {
  const source = forecast[0]?.source ?? "ESTIMATE";
  const tag = WEATHER_SOURCE_LABEL[source];
  return `[${tag}] 평균 ${summary.avgTemp}°C / 강수 ${summary.avgPrecip}% / 풍속 ${summary.avgWind}m/s, 선호(${preference.temp_min_c}~${preference.temp_max_c}°C) 대비 ${score.toFixed(
    1,
  )}점입니다.`;
}

export function explainPriceScore(
  score: number,
  priceKrw: number,
  budgetMaxKrw: number,
): string {
  const ratio = (priceKrw / Math.max(1, budgetMaxKrw)) * 100;
  return `운임 ${formatKrw(priceKrw)} (예산의 ${ratio.toFixed(1)}%)로 가격 점수 ${score.toFixed(
    1,
  )}점입니다.`;
}

export function explainConvenienceScore(
  score: number,
  offer: FlightOffer,
  nonstopOnly: boolean,
): string {
  const durationHours = (offer.total_duration_min / 60).toFixed(1);
  const nonstopText = offer.stops === 0 ? "무경유" : `${offer.stops}회 경유`;
  const baggageText = offer.baggage_included ? "수하물 포함" : "수하물 미포함";
  const preferenceText = nonstopOnly ? " (무경유 선호 반영)" : "";
  return `${nonstopText}, 총 ${durationHours}시간, ${baggageText}${preferenceText} 기준으로 ${score.toFixed(
    1,
  )}점입니다.`;
}

export type ScoreParts = {
  weather: number;
  activity: number;
  price: number;
  convenience: number;
};

export function explainTotalScore(
  totalScore: number,
  parts: ScoreParts,
  weights: ScoreParts,
): string {
  const labels: Array<[keyof ScoreParts, string]> = [
    ["weather", "날씨"],
    ["activity", "활동"],
    ["price", "가격"],
    ["convenience", "편의"],
  ];
  const terms = labels
    .filter(([key]) => weights[key] > 0)
    .map(
      ([key, label]) =>
        `${label} ${parts[key].toFixed(1)}×${weights[key].toFixed(2)}`,
    );
  return `총점 ${totalScore.toFixed(1)} = ${terms.join(" + ")}`;
}

export function buildRationale(
  destinationName: string,
  offer: FlightOffer,
  forecast: WeatherSnapshot[],
): string {
  const summary = summarizeForecast(forecast);
  const durationHour = (offer.total_duration_min / 60).toFixed(1);

  return `${destinationName} 평균 기온 ${summary.avgTemp}°C, 강수확률 ${summary.avgPrecip}% 구간으로 예산 대비 ${formatKrw(
    offer.price_krw,
  )} 운임이며 총 비행시간 약 ${durationHour}시간입니다.`;
}

// 국내 근교 목적지는 항공권이 없어 별도 문구를 쓴다. 이동수단은 자차/대중교통 중립으로 표현.
export function explainGroundPrice(): string {
  return "국내 근교 목적지라 항공권 가격 축은 적용하지 않습니다 (자차·KTX·버스로 이동).";
}

export function explainGroundConvenience(): string {
  return "항공편이 아니라 경유/소요시간 정보는 제공하지 않습니다.";
}

export function buildGroundRationale(
  destinationName: string,
  forecast: WeatherSnapshot[],
): string {
  const summary = summarizeForecast(forecast);
  return `${destinationName} 평균 기온 ${summary.avgTemp}°C, 강수확률 ${summary.avgPrecip}% 구간입니다. 자차나 KTX·버스로 다녀오는 국내 근교입니다.`;
}
