import {
  addDaysIso,
  eachDateInclusive,
} from "@/lib/recommendation/date";
import {
  getDestinationForecast,
  searchAmadeusOffer,
  searchSkyscannerOffer,
  type FlightOffer,
  type WeatherSnapshot,
} from "@/lib/recommendation/providers";
import {
  buildRationale,
  explainActivityScore,
  explainConvenienceScore,
  explainPriceScore,
  explainTotalScore,
  explainWeatherScore,
  scoreActivity,
  scoreConvenience,
  scorePrice,
  scoreWeather,
  summarizeForecast,
  type ScoreParts,
} from "@/lib/recommendation/scoring";
import {
  DESTINATION_LABELS,
  type RecommendationItem,
  type RecommendationMode,
  type RecommendationRequest,
  type RecommendationResponse,
} from "@/lib/recommendation/types";
import {
  getDestinationActivities,
  type OriginIata,
} from "@/lib/recommendation/regions";

type Itinerary = {
  depart_date: string;
  return_date: string;
};

// A/B는 코드상으론 가중치 프리셋일 뿐이다. 같은 엔진, 가중치만 다르다.
// 액티비티 미선택 시 활동 가중치는 0이고 나머지가 기존 비율(0.5/0.3/0.2)로 복원된다.
function resolveWeights(
  mode: RecommendationMode,
  hasActivities: boolean,
): ScoreParts {
  if (!hasActivities) {
    if (mode === "DEAL_FIRST") {
      return { weather: 0.3, activity: 0, price: 0.5, convenience: 0.2 };
    }
    if (mode === "WEATHER_FIRST") {
      return { weather: 0.6, activity: 0, price: 0.2, convenience: 0.2 };
    }
    return { weather: 0.5, activity: 0, price: 0.3, convenience: 0.2 };
  }
  if (mode === "DEAL_FIRST") {
    return { weather: 0.2, activity: 0.25, price: 0.45, convenience: 0.1 };
  }
  if (mode === "WEATHER_FIRST") {
    return { weather: 0.4, activity: 0.3, price: 0.2, convenience: 0.1 };
  }
  return { weather: 0.35, activity: 0.3, price: 0.25, convenience: 0.1 };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function readLimitFromEnv(
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = process.env[key];
  const parsed = raw ? Number(raw) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function buildItineraries(input: RecommendationRequest): Itinerary[] {
  const { earliest_departure, latest_return, min_nights, max_nights } = input;
  const latestDeparture = addDaysIso(latest_return, -min_nights);
  const departures = eachDateInclusive(earliest_departure, latestDeparture);
  const itineraries: Itinerary[] = [];

  for (const departDate of departures) {
    for (let nights = min_nights; nights <= max_nights; nights += 1) {
      const returnDate = addDaysIso(departDate, nights);
      if (returnDate <= latest_return) {
        itineraries.push({
          depart_date: departDate,
          return_date: returnDate,
        });
      }
    }
  }

  const itineraryLimit = readLimitFromEnv(
    "RECO_MAX_ITINERARIES",
    12,
    4,
    28,
  );
  if (itineraries.length <= itineraryLimit) {
    return itineraries;
  }

  const stride = Math.max(1, Math.floor(itineraries.length / itineraryLimit));
  return itineraries
    .filter((_, index) => index % stride === 0)
    .slice(0, itineraryLimit);
}

function toFailureCode(provider: string, error: unknown): string {
  const fallback = `${provider}_ERROR`;
  if (!error || typeof error !== "object") {
    return fallback;
  }
  const message = "message" in error ? String(error.message) : fallback;
  const normalized = message.replaceAll(/\s+/g, "_").toUpperCase();
  return normalized || fallback;
}

async function searchWithFallback(
  originIata: OriginIata,
  nonstopOnly: boolean,
  destinationIata: string,
  itinerary: Itinerary,
  partialFailures: Set<string>,
): Promise<FlightOffer | null> {
  try {
    const skyscanner = await searchSkyscannerOffer({
      origin_iata: originIata,
      destination_iata: destinationIata,
      depart_date: itinerary.depart_date,
      return_date: itinerary.return_date,
      nonstop_only: nonstopOnly,
    });
    if (skyscanner) {
      return skyscanner;
    }
  } catch (error) {
    partialFailures.add(toFailureCode("SKYSCANNER", error));
  }

  try {
    const amadeus = await searchAmadeusOffer({
      origin_iata: originIata,
      destination_iata: destinationIata,
      depart_date: itinerary.depart_date,
      return_date: itinerary.return_date,
      nonstop_only: nonstopOnly,
    });
    if (amadeus) {
      return amadeus;
    }
  } catch (error) {
    partialFailures.add(toFailureCode("AMADEUS", error));
  }

  return null;
}

export async function runRecommendationEngine(
  input: RecommendationRequest,
): Promise<RecommendationResponse> {
  const runId = crypto.randomUUID();
  const partialFailures = new Set<string>();
  const itineraries = buildItineraries(input);
  const maxDestinations = readLimitFromEnv(
    "RECO_MAX_DESTINATIONS",
    10,
    3,
    30,
  );
  const hasActivities = input.activities.length > 0;
  const weights = resolveWeights(input.mode, hasActivities);
  // 액티비티가 선택되면, 10개 슬라이스 전에 매칭 도시를 앞으로 끌어올린다.
  // (안 그러면 후보 순서상 동남아 해변 도시가 채점 전에 잘려나간다.)
  const rankedCandidates = hasActivities
    ? [...input.candidate_destinations].sort(
        (a, b) =>
          getDestinationActivities(b).filter((tag) =>
            input.activities.includes(tag),
          ).length -
          getDestinationActivities(a).filter((tag) =>
            input.activities.includes(tag),
          ).length,
      )
    : input.candidate_destinations;
  const destinations = rankedCandidates.slice(0, maxDestinations);
  const results: RecommendationItem[] = [];

  // 날씨는 출발지와 무관(도시+일정에만 의존)하므로 유니크 조합만 병렬 프리페치한다.
  const weatherKey = (dest: string, itin: Itinerary) =>
    `${dest}|${itin.depart_date}|${itin.return_date}`;
  const weatherJobs = new Map<string, Itinerary & { dest: string }>();
  for (const destinationIata of destinations) {
    for (const itinerary of itineraries) {
      weatherJobs.set(weatherKey(destinationIata, itinerary), {
        dest: destinationIata,
        ...itinerary,
      });
    }
  }
  const weatherMap = new Map<string, WeatherSnapshot[]>();
  const jobList = [...weatherJobs.entries()];
  const WEATHER_CONCURRENCY = 12;
  for (let i = 0; i < jobList.length; i += WEATHER_CONCURRENCY) {
    const batch = jobList.slice(i, i + WEATHER_CONCURRENCY);
    const fetched = await Promise.all(
      batch.map(async ([key, job]) => {
        const snapshots = await getDestinationForecast(
          job.dest,
          job.depart_date,
          job.return_date,
        );
        return [key, snapshots] as const;
      }),
    );
    for (const [key, snapshots] of fetched) {
      weatherMap.set(key, snapshots);
    }
  }

  for (const originIata of input.origin_iatas) {
    for (const destinationIata of destinations) {
      for (const itinerary of itineraries) {
        const weatherForecast =
          weatherMap.get(weatherKey(destinationIata, itinerary)) ?? [];
        const offer = await searchWithFallback(
          originIata,
          input.nonstop_only,
          destinationIata,
          itinerary,
          partialFailures,
        );

        if (!offer) {
          continue;
        }

        const weatherScore = scoreWeather(weatherForecast, input.weather_preference);
        const priceScore = scorePrice(offer.price_krw, input.budget_max_krw);
        const convenienceScore = scoreConvenience(offer, input.nonstop_only);
        const weatherSummary = summarizeForecast(weatherForecast);
        const destinationActivities = getDestinationActivities(destinationIata);
        const activityScore = scoreActivity(
          input.activities,
          destinationActivities,
          weatherSummary,
        );
        const matchedActivities = input.activities.filter((activity) =>
          destinationActivities.includes(activity),
        );
        const scoreParts: ScoreParts = {
          weather: weatherScore,
          activity: activityScore,
          price: priceScore,
          convenience: convenienceScore,
        };
        const totalScore = round1(
          weatherScore * weights.weather +
            activityScore * weights.activity +
            priceScore * weights.price +
            convenienceScore * weights.convenience,
        );
        const destinationName =
          DESTINATION_LABELS[destinationIata] ?? destinationIata;

        results.push({
          rank: 0,
          provider: offer.provider,
          origin_iata: originIata,
          destination_iata: destinationIata,
          destination_name: destinationName,
          depart_date: itinerary.depart_date,
          return_date: itinerary.return_date,
          price_krw: offer.price_krw,
          price_is_live: offer.is_live,
          weather_score: weatherScore,
          activity_score: activityScore,
          price_score: priceScore,
          convenience_score: convenienceScore,
          total_score: totalScore,
          matched_activities: matchedActivities,
          weather_source: weatherForecast[0]?.source ?? "ESTIMATE",
          weather_summary: weatherSummary,
          weather_daily: weatherForecast.map((day) => ({
            date: day.date,
            hi: day.temp_high_c,
            lo: day.temp_low_c,
            precip: day.precip_prob,
          })),
          score_explanations: {
            weather: explainWeatherScore(
              weatherScore,
              weatherSummary,
              input.weather_preference,
              weatherForecast,
            ),
            activity: explainActivityScore(
              activityScore,
              input.activities,
              destinationActivities,
            ),
            price: explainPriceScore(
              priceScore,
              offer.price_krw,
              input.budget_max_krw,
            ),
            convenience: explainConvenienceScore(
              convenienceScore,
              offer,
              input.nonstop_only,
            ),
            total: explainTotalScore(totalScore, scoreParts, weights),
          },
          rationale: buildRationale(destinationName, offer, weatherForecast),
          flight_deeplink_url: offer.deeplink_url,
        });
      }
    }
  }

  const items = results
    .sort((left, right) => {
      if (right.total_score !== left.total_score) {
        return right.total_score - left.total_score;
      }
      return left.price_krw - right.price_krw;
    })
    .slice(0, 5)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  if (items.length === 0 && partialFailures.size === 0) {
    partialFailures.add("NO_ELIGIBLE_OFFERS");
  }

  return {
    run_id: runId,
    scoring_version: "v1.0.0",
    status: items.length > 0 ? "SUCCESS" : "PARTIAL_FAILURE",
    items,
    partial_failures: [...partialFailures].slice(0, 10),
  };
}
