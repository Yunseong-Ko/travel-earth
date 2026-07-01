import {
  addDaysIso,
  diffDaysIso,
  eachDateInclusive,
  formatIsoDateUtc,
  parseIsoDateUtc,
} from "@/lib/recommendation/date";
import { AIRPORT_GEO, type OriginIata } from "@/lib/recommendation/regions";
import { type ProviderCode } from "@/lib/recommendation/types";

// 날씨 출처: 실제 예보 / 작년 기반 평년 추정 / API 실패 시 합성 추정.
export type WeatherSource = "FORECAST" | "NORMAL" | "ESTIMATE";

export const WEATHER_SOURCE_LABEL: Record<WeatherSource, string> = {
  FORECAST: "예보",
  NORMAL: "평년",
  ESTIMATE: "추정",
};

export type WeatherSnapshot = {
  date: string;
  temp_high_c: number;
  temp_low_c: number;
  precip_prob: number;
  wind_mps: number;
  extreme_risk: number;
  source: WeatherSource;
};

export type FlightOffer = {
  provider: ProviderCode;
  provider_offer_id: string;
  origin_iata: OriginIata;
  destination_iata: string;
  depart_date: string;
  return_date: string;
  price_krw: number;
  stops: number;
  total_duration_min: number;
  baggage_included: boolean;
  deeplink_url: string;
};

type DestinationProfile = {
  base_temp_c: number;
  base_precip: number;
  base_wind_mps: number;
  base_price_from_origin: Record<OriginIata, number>;
  base_duration_from_origin: Record<OriginIata, number>;
};

type FlightSearchInput = {
  origin_iata: OriginIata;
  destination_iata: string;
  depart_date: string;
  return_date: string;
  nonstop_only: boolean;
};

const DESTINATION_PROFILE: Record<string, DestinationProfile> = {
  CJU: {
    base_temp_c: 20,
    base_precip: 36,
    base_wind_mps: 5.6,
    base_price_from_origin: { ICN: 145000, PUS: 85000, GMP: 95000 },
    base_duration_from_origin: { ICN: 90, PUS: 60, GMP: 70 },
  },
  CJJ: {
    base_temp_c: 16,
    base_precip: 30,
    base_wind_mps: 4.3,
    base_price_from_origin: { ICN: 90000, PUS: 110000, GMP: 85000 },
    base_duration_from_origin: { ICN: 55, PUS: 50, GMP: 50 },
  },
  TAE: {
    base_temp_c: 17,
    base_precip: 31,
    base_wind_mps: 4.4,
    base_price_from_origin: { ICN: 98000, PUS: 70000, GMP: 92000 },
    base_duration_from_origin: { ICN: 55, PUS: 35, GMP: 55 },
  },
  KWJ: {
    base_temp_c: 18,
    base_precip: 34,
    base_wind_mps: 4.5,
    base_price_from_origin: { ICN: 97000, PUS: 98000, GMP: 90000 },
    base_duration_from_origin: { ICN: 60, PUS: 55, GMP: 55 },
  },
  RSU: {
    base_temp_c: 18,
    base_precip: 33,
    base_wind_mps: 4.6,
    base_price_from_origin: { ICN: 101000, PUS: 88000, GMP: 97000 },
    base_duration_from_origin: { ICN: 65, PUS: 45, GMP: 60 },
  },
  USN: {
    base_temp_c: 17,
    base_precip: 32,
    base_wind_mps: 4.7,
    base_price_from_origin: { ICN: 95000, PUS: 76000, GMP: 90000 },
    base_duration_from_origin: { ICN: 55, PUS: 35, GMP: 50 },
  },
  NRT: {
    base_temp_c: 18,
    base_precip: 38,
    base_wind_mps: 5.4,
    base_price_from_origin: { ICN: 330000, PUS: 390000, GMP: 350000 },
    base_duration_from_origin: { ICN: 140, PUS: 125, GMP: 150 },
  },
  KIX: {
    base_temp_c: 19,
    base_precip: 35,
    base_wind_mps: 5.1,
    base_price_from_origin: { ICN: 310000, PUS: 250000, GMP: 315000 },
    base_duration_from_origin: { ICN: 115, PUS: 90, GMP: 120 },
  },
  FUK: {
    base_temp_c: 20,
    base_precip: 33,
    base_wind_mps: 4.8,
    base_price_from_origin: { ICN: 290000, PUS: 180000, GMP: 295000 },
    base_duration_from_origin: { ICN: 95, PUS: 55, GMP: 100 },
  },
  TPE: {
    base_temp_c: 24,
    base_precip: 42,
    base_wind_mps: 5.2,
    base_price_from_origin: { ICN: 350000, PUS: 380000, GMP: 355000 },
    base_duration_from_origin: { ICN: 165, PUS: 170, GMP: 170 },
  },
  HKG: {
    base_temp_c: 25,
    base_precip: 44,
    base_wind_mps: 5.9,
    base_price_from_origin: { ICN: 420000, PUS: 430000, GMP: 425000 },
    base_duration_from_origin: { ICN: 220, PUS: 215, GMP: 225 },
  },
  BKK: {
    base_temp_c: 29,
    base_precip: 48,
    base_wind_mps: 4.9,
    base_price_from_origin: { ICN: 470000, PUS: 490000, GMP: 475000 },
    base_duration_from_origin: { ICN: 350, PUS: 340, GMP: 355 },
  },
  SIN: {
    base_temp_c: 30,
    base_precip: 52,
    base_wind_mps: 4.5,
    base_price_from_origin: { ICN: 620000, PUS: 640000, GMP: 630000 },
    base_duration_from_origin: { ICN: 390, PUS: 385, GMP: 395 },
  },
  CEB: {
    base_temp_c: 30,
    base_precip: 50,
    base_wind_mps: 4.2,
    base_price_from_origin: { ICN: 460000, PUS: 450000, GMP: 465000 },
    base_duration_from_origin: { ICN: 260, PUS: 255, GMP: 265 },
  },
  DAD: {
    base_temp_c: 28,
    base_precip: 45,
    base_wind_mps: 4.7,
    base_price_from_origin: { ICN: 420000, PUS: 440000, GMP: 425000 },
    base_duration_from_origin: { ICN: 280, PUS: 275, GMP: 285 },
  },
  DPS: {
    base_temp_c: 29,
    base_precip: 47,
    base_wind_mps: 4.8,
    base_price_from_origin: { ICN: 690000, PUS: 710000, GMP: 700000 },
    base_duration_from_origin: { ICN: 430, PUS: 420, GMP: 435 },
  },
};

const DEFAULT_PROFILE: DestinationProfile = {
  base_temp_c: 24,
  base_precip: 40,
  base_wind_mps: 5,
  base_price_from_origin: { ICN: 450000, PUS: 470000, GMP: 455000 },
  base_duration_from_origin: { ICN: 280, PUS: 270, GMP: 285 },
};

let amadeusTokenCache: { accessToken: string; expiresAt: number } | null = null;

function profileOf(destinationIata: string): DestinationProfile {
  return DESTINATION_PROFILE[destinationIata] ?? DEFAULT_PROFILE;
}

function hash32(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seeded(seed: string, min: number, max: number): number {
  const ratio = (hash32(seed) % 10000) / 10000;
  return min + ratio * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
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

function parseIsoDurationToMinutes(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const matched = value
    .trim()
    .match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i);
  if (!matched) {
    return null;
  }
  const days = Number(matched[1] ?? 0);
  const hours = Number(matched[2] ?? 0);
  const minutes = Number(matched[3] ?? 0);
  return days * 24 * 60 + hours * 60 + minutes;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs = 9000,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`HTTP_${response.status}_${text.slice(0, 180)}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function seasonalTempOffset(dateIso: string, seedKey: string): number {
  const month = parseIsoDateUtc(dateIso).getUTCMonth() + 1;
  const phase = seeded(`${seedKey}-phase`, -0.8, 0.8);
  return Math.sin((month / 12) * Math.PI * 2 + phase) * 5.8;
}

function toDateParts(dateIso: string): { year: number; month: number; day: number } {
  const date = parseIsoDateUtc(dateIso);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function isSkyscannerConfigured(): boolean {
  return Boolean(process.env.SKYSCANNER_API_KEY);
}

function isAmadeusConfigured(): boolean {
  return Boolean(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET);
}

function buildSkyscannerFallbackDeeplink(input: FlightSearchInput): string {
  const deeplink = new URL("https://www.skyscanner.net/transport/flights");
  deeplink.searchParams.set("from", input.origin_iata);
  deeplink.searchParams.set("to", input.destination_iata);
  deeplink.searchParams.set("depart", input.depart_date);
  deeplink.searchParams.set("return", input.return_date);
  return deeplink.toString();
}

function buildAmadeusFallbackDeeplink(input: FlightSearchInput): string {
  const deeplink = new URL("https://amadeus.com");
  deeplink.searchParams.set("origin", input.origin_iata);
  deeplink.searchParams.set("destination", input.destination_iata);
  deeplink.searchParams.set("departDate", input.depart_date);
  deeplink.searchParams.set("returnDate", input.return_date);
  return deeplink.toString();
}

function parseSkyscannerOffer(
  pollData: unknown,
  input: FlightSearchInput,
): FlightOffer | null {
  const content = asRecord(asRecord(pollData)?.content);
  const results = asRecord(content?.results);
  const itineraries = asRecord(results?.itineraries) ?? {};
  const legs = asRecord(results?.legs) ?? {};

  const parsedOffers = Object.values(itineraries)
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((itinerary) => {
      const legIds = Array.isArray(itinerary.legIds)
        ? itinerary.legIds.map((value) => String(value))
        : [];
      const pricingOptions = Array.isArray(itinerary.pricingOptions)
        ? itinerary.pricingOptions
        : [];
      const primaryOption = asRecord(pricingOptions[0]);
      const price = toNumber(asRecord(primaryOption?.price)?.amount);
      if (price === null) {
        return null;
      }

      let totalDurationMin = 0;
      let stops = 0;
      for (const legId of legIds) {
        const leg = asRecord(legs[legId]);
        if (!leg) {
          continue;
        }
        const legDuration =
          toInt(leg.durationInMinutes) ?? parseIsoDurationToMinutes(leg.duration);
        if (legDuration !== null) {
          totalDurationMin += legDuration;
        }

        const stopCount = toInt(leg.stopCount);
        if (stopCount !== null) {
          stops += Math.max(0, stopCount);
        } else if (Array.isArray(leg.segmentIds)) {
          stops += Math.max(0, leg.segmentIds.length - 1);
        }
      }

      const primaryItem = asRecord(
        Array.isArray(primaryOption?.items) ? primaryOption.items[0] : null,
      );
      const deepLink =
        typeof primaryItem?.deepLink === "string"
          ? primaryItem.deepLink
          : buildSkyscannerFallbackDeeplink(input);
      const pricingOptionFare = asRecord(primaryOption?.pricingOptionFare);
      const checkedBaggage = asRecord(pricingOptionFare?.checkedBaggage);
      const checkedPieces = toInt(checkedBaggage?.pieces);
      const itineraryId =
        typeof itinerary.id === "string"
          ? itinerary.id
          : `sky-${Math.abs(hash32(JSON.stringify(itinerary))).toString(16)}`;

      return {
        provider: "SKYSCANNER" as const,
        provider_offer_id: itineraryId,
        origin_iata: input.origin_iata,
        destination_iata: input.destination_iata,
        depart_date: input.depart_date,
        return_date: input.return_date,
        price_krw: Math.round(price),
        stops,
        total_duration_min: totalDurationMin > 0 ? totalDurationMin : 999,
        baggage_included: checkedPieces !== null ? checkedPieces > 0 : false,
        deeplink_url: deepLink,
      };
    })
    .filter((item) => item !== null)
    .filter((item) => (input.nonstop_only ? item.stops === 0 : true))
    .sort((left, right) => left.price_krw - right.price_krw) as FlightOffer[];

  return parsedOffers[0] ?? null;
}

async function searchSkyscannerLiveOffer(
  input: FlightSearchInput,
): Promise<FlightOffer | null> {
  const apiKey = process.env.SKYSCANNER_API_KEY;
  if (!apiKey) {
    return null;
  }

  const baseUrl =
    (process.env.SKYSCANNER_BASE_URL ?? "https://partners.api.skyscanner.net").replace(
      /\/$/,
      "",
    );
  const createUrl = `${baseUrl}/apiservices/v3/flights/live/search/create`;
  const createPayload = {
    query: {
      market: process.env.SKYSCANNER_MARKET ?? "KR",
      locale: process.env.SKYSCANNER_LOCALE ?? "ko-KR",
      currency: process.env.SKYSCANNER_CURRENCY ?? "KRW",
      adults: 1,
      cabinClass: "CABIN_CLASS_ECONOMY",
      queryLegs: [
        {
          originPlaceId: { iata: input.origin_iata },
          destinationPlaceId: { iata: input.destination_iata },
          date: toDateParts(input.depart_date),
        },
        {
          originPlaceId: { iata: input.destination_iata },
          destinationPlaceId: { iata: input.origin_iata },
          date: toDateParts(input.return_date),
        },
      ],
    },
  };

  const createResponse = await fetchJson(
    createUrl,
    {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createPayload),
    },
    9000,
  );
  const createData = asRecord(createResponse);
  const sessionToken =
    typeof createData?.sessionToken === "string"
      ? createData.sessionToken
      : typeof createData?.refreshSessionToken === "string"
        ? createData.refreshSessionToken
        : null;

  if (!sessionToken) {
    throw new Error("SKYSCANNER_SESSION_MISSING");
  }

  const pollUrl = `${baseUrl}/apiservices/v3/flights/live/search/poll/${sessionToken}`;
  let pollData: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    pollData = await fetchJson(
      pollUrl,
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
      9000,
    );
    const status = String(asRecord(pollData)?.status ?? "");
    if (!status.includes("INCOMPLETE")) {
      break;
    }
    await sleep(350);
  }

  return parseSkyscannerOffer(pollData, input);
}

async function getAmadeusAccessToken(): Promise<string> {
  const now = Date.now();
  if (amadeusTokenCache && amadeusTokenCache.expiresAt > now + 20_000) {
    return amadeusTokenCache.accessToken;
  }

  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("AMADEUS_CREDENTIALS_MISSING");
  }

  const baseUrl = (process.env.AMADEUS_BASE_URL ?? "https://test.api.amadeus.com").replace(
    /\/$/,
    "",
  );
  const tokenUrl = `${baseUrl}/v1/security/oauth2/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const tokenResponse = await fetchJson(
    tokenUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    },
    9000,
  );
  const tokenData = asRecord(tokenResponse);
  const accessToken =
    typeof tokenData?.access_token === "string" ? tokenData.access_token : null;
  const expiresIn = toInt(tokenData?.expires_in) ?? 900;
  if (!accessToken) {
    throw new Error("AMADEUS_TOKEN_MISSING");
  }

  amadeusTokenCache = {
    accessToken,
    expiresAt: now + expiresIn * 1000,
  };
  return accessToken;
}

function parseAmadeusOffer(
  responseData: unknown,
  input: FlightSearchInput,
): FlightOffer | null {
  const payload = asRecord(responseData);
  const offers = Array.isArray(payload?.data) ? payload.data : [];
  const parsedOffers = offers
    .map((offer) => asRecord(offer))
    .filter((offer): offer is Record<string, unknown> => offer !== null)
    .map((offer) => {
      const priceValue = toNumber(asRecord(offer.price)?.grandTotal);
      if (priceValue === null) {
        return null;
      }

      const itineraries = Array.isArray(offer.itineraries) ? offer.itineraries : [];
      let totalDurationMin = 0;
      let stops = 0;
      for (const itineraryItem of itineraries) {
        const itinerary = asRecord(itineraryItem);
        if (!itinerary) {
          continue;
        }
        const itineraryDuration = parseIsoDurationToMinutes(itinerary.duration);
        if (itineraryDuration !== null) {
          totalDurationMin += itineraryDuration;
        }
        const segments = Array.isArray(itinerary.segments) ? itinerary.segments : [];
        stops += Math.max(0, segments.length - 1);
      }

      const travelerPricings = Array.isArray(offer.travelerPricings)
        ? offer.travelerPricings
        : [];
      const hasCheckedBag = travelerPricings.some((pricingItem) => {
        const pricing = asRecord(pricingItem);
        const fareSegments = Array.isArray(pricing?.fareDetailsBySegment)
          ? pricing.fareDetailsBySegment
          : [];
        return fareSegments.some((segmentItem) => {
          const segment = asRecord(segmentItem);
          const bagData = asRecord(segment?.includedCheckedBags);
          const quantity = toInt(bagData?.quantity);
          return quantity !== null && quantity > 0;
        });
      });

      const links = asRecord(offer.links);
      const deeplink =
        typeof links?.self === "string"
          ? links.self
          : buildAmadeusFallbackDeeplink(input);

      return {
        provider: "AMADEUS" as const,
        provider_offer_id:
          typeof offer.id === "string"
            ? offer.id
            : `ama-${Math.abs(hash32(JSON.stringify(offer))).toString(16)}`,
        origin_iata: input.origin_iata,
        destination_iata: input.destination_iata,
        depart_date: input.depart_date,
        return_date: input.return_date,
        price_krw: Math.round(priceValue),
        stops,
        total_duration_min: totalDurationMin > 0 ? totalDurationMin : 999,
        baggage_included: hasCheckedBag,
        deeplink_url: deeplink,
      };
    })
    .filter((item) => item !== null)
    .filter((item) => (input.nonstop_only ? item.stops === 0 : true))
    .sort((left, right) => left.price_krw - right.price_krw) as FlightOffer[];

  return parsedOffers[0] ?? null;
}

async function searchAmadeusLiveOffer(
  input: FlightSearchInput,
): Promise<FlightOffer | null> {
  const accessToken = await getAmadeusAccessToken();
  const baseUrl = (process.env.AMADEUS_BASE_URL ?? "https://test.api.amadeus.com").replace(
    /\/$/,
    "",
  );

  const query = new URLSearchParams({
    originLocationCode: input.origin_iata,
    destinationLocationCode: input.destination_iata,
    departureDate: input.depart_date,
    returnDate: input.return_date,
    adults: "1",
    max: "5",
    currencyCode: process.env.AMADEUS_CURRENCY ?? "KRW",
  });
  if (input.nonstop_only) {
    query.set("nonStop", "true");
  }

  const searchUrl = `${baseUrl}/v2/shopping/flight-offers?${query.toString()}`;
  const searchResponse = await fetchJson(
    searchUrl,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    9000,
  );

  return parseAmadeusOffer(searchResponse, input);
}

function makePriceAndDuration(input: FlightSearchInput, provider: ProviderCode) {
  const profile = profileOf(input.destination_iata);
  const nights = Math.max(1, diffDaysIso(input.depart_date, input.return_date));
  const basePrice = profile.base_price_from_origin[input.origin_iata];
  const baseDuration = profile.base_duration_from_origin[input.origin_iata];
  const marketFactor = seeded(
    `${input.origin_iata}-${input.destination_iata}-${input.depart_date}-market`,
    -90000,
    150000,
  );
  const stayFactor = nights * seeded(`${input.destination_iata}-stay-factor`, 9000, 16000);
  const providerBias = provider === "AMADEUS" ? seeded("amadeus-bias", 18000, 54000) : 0;
  const price = Math.round(basePrice + marketFactor + stayFactor + providerBias);

  const stops = input.nonstop_only
    ? 0
    : seeded(`${provider}-${input.destination_iata}-stops`, 0, 1) > 0.66
      ? 1
      : 0;
  const duration = Math.round(
    baseDuration +
      stops * seeded(`${provider}-stop-time`, 80, 150) +
      seeded(`${provider}-${input.depart_date}-duration-variance`, -24, 32),
  );

  return {
    price_krw: Math.max(price, 90000),
    stops,
    total_duration_min: Math.max(duration, 55),
  };
}

function searchSkyscannerMockOffer(input: FlightSearchInput): FlightOffer | null {
  const chaos = hash32(
    `${input.origin_iata}-${input.destination_iata}-${input.depart_date}-${input.return_date}-sky`,
  );
  const chaoticBucket = chaos % 17;

  if (chaoticBucket === 0) {
    throw new Error("SKYSCANNER_TIMEOUT");
  }
  if (chaoticBucket === 1 || chaoticBucket === 2) {
    return null;
  }
  if (input.nonstop_only && chaoticBucket === 3) {
    return null;
  }

  const priceAndDuration = makePriceAndDuration(input, "SKYSCANNER");
  return {
    provider: "SKYSCANNER",
    provider_offer_id: `SKY-${chaos.toString(16)}`,
    origin_iata: input.origin_iata,
    destination_iata: input.destination_iata,
    depart_date: input.depart_date,
    return_date: input.return_date,
    price_krw: priceAndDuration.price_krw,
    stops: priceAndDuration.stops,
    total_duration_min: priceAndDuration.total_duration_min,
    baggage_included: seeded(`${chaos}-bag`, 0, 1) > 0.45,
    deeplink_url: buildSkyscannerFallbackDeeplink(input),
  };
}

function searchAmadeusMockOffer(input: FlightSearchInput): FlightOffer | null {
  const chaos = hash32(
    `${input.origin_iata}-${input.destination_iata}-${input.depart_date}-${input.return_date}-ama`,
  );
  const chaoticBucket = chaos % 13;

  if (chaoticBucket === 0) {
    throw new Error("AMADEUS_GATEWAY_ERROR");
  }
  if (chaoticBucket === 1) {
    return null;
  }
  if (input.nonstop_only && chaoticBucket === 2) {
    return null;
  }

  const priceAndDuration = makePriceAndDuration(input, "AMADEUS");
  return {
    provider: "AMADEUS",
    provider_offer_id: `AMA-${chaos.toString(16)}`,
    origin_iata: input.origin_iata,
    destination_iata: input.destination_iata,
    depart_date: input.depart_date,
    return_date: input.return_date,
    price_krw: priceAndDuration.price_krw,
    stops: priceAndDuration.stops,
    total_duration_min: priceAndDuration.total_duration_min,
    baggage_included: seeded(`${chaos}-bag`, 0, 1) > 0.57,
    deeplink_url: buildAmadeusFallbackDeeplink(input),
  };
}

function extremeRisk(precip: number, wind: number): number {
  return Math.round(clamp((precip - 60) * 0.8 + (wind - 9) * 5, 0, 70));
}

// API 실패/좌표 없음 시 합성 추정 (기존 mock). source="ESTIMATE".
function getEarth2ForecastMock(
  destinationIata: string,
  departDate: string,
  returnDate: string,
): WeatherSnapshot[] {
  const profile = profileOf(destinationIata);
  const days = eachDateInclusive(departDate, returnDate);

  return days.map((date) => {
    const tempMid =
      profile.base_temp_c +
      seasonalTempOffset(date, destinationIata) +
      seeded(`${destinationIata}-${date}-temp-mid`, -2.4, 2.4);
    const daySpread = seeded(`${destinationIata}-${date}-spread`, 5.8, 8.4);
    const precip = clamp(
      profile.base_precip + seeded(`${destinationIata}-${date}-precip`, -16, 16),
      4,
      95,
    );
    const wind = clamp(
      profile.base_wind_mps + seeded(`${destinationIata}-${date}-wind`, -2.2, 2.2),
      1.5,
      16,
    );

    return {
      date,
      temp_high_c: round1(tempMid + daySpread / 2),
      temp_low_c: round1(tempMid - daySpread / 2),
      precip_prob: Math.round(precip),
      wind_mps: round1(wind),
      extreme_risk: extremeRisk(precip, wind),
      source: "ESTIMATE" as const,
    };
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftIsoYears(dateIso: string, years: number): string {
  const value = parseIsoDateUtc(dateIso);
  value.setUTCFullYear(value.getUTCFullYear() + years);
  return formatIsoDateUtc(value);
}

function numbersAt(record: Record<string, unknown> | null, key: string): number[] {
  const arr = record?.[key];
  if (!Array.isArray(arr)) {
    return [];
  }
  return arr.map((v) => toNumber(v) ?? Number.NaN);
}

// 16일 이내: 실제 예보.
async function fetchForecast(
  lat: number,
  lon: number,
  days: string[],
): Promise<WeatherSnapshot[] | null> {
  const start = days[0];
  const end = days[days.length - 1];
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max` +
    `&wind_speed_unit=ms&timezone=auto&start_date=${start}&end_date=${end}`;
  const daily = asRecord(asRecord(await fetchJson(url, { method: "GET" }, 11000))?.daily);
  const dates = Array.isArray(daily?.time) ? daily.time.map(String) : [];
  const highs = numbersAt(daily, "temperature_2m_max");
  const lows = numbersAt(daily, "temperature_2m_min");
  const precs = numbersAt(daily, "precipitation_probability_max");
  const winds = numbersAt(daily, "wind_speed_10m_max");
  if (dates.length === 0) {
    return null;
  }
  return days.map((date) => {
    const idx = Math.max(0, dates.indexOf(date));
    const high = Number.isFinite(highs[idx]) ? highs[idx] : 22;
    const low = Number.isFinite(lows[idx]) ? lows[idx] : 16;
    const precip = clamp(Number.isFinite(precs[idx]) ? precs[idx] : 30, 0, 100);
    const wind = clamp(Number.isFinite(winds[idx]) ? winds[idx] : 5, 0.5, 22);
    return {
      date,
      temp_high_c: round1(high),
      temp_low_c: round1(low),
      precip_prob: Math.round(precip),
      wind_mps: round1(wind),
      extreme_risk: extremeRisk(precip, wind),
      source: "FORECAST" as const,
    };
  });
}

// 평년값은 "월"에만 의존하므로 도시×월 단위로 1번만 집계해 재사용한다.
type NormalAggregate = { high: number; low: number; precipProb: number; wind: number };
const normalCache = new Map<string, { expires: number; agg: NormalAggregate }>();

// 작년 해당 월 15일 ±12일 윈도우를 모아 안정적인 시즌 값으로 집계.
async function getNormalAggregate(
  iata: string,
  lat: number,
  lon: number,
  month: string, // "YYYY-MM"
): Promise<NormalAggregate | null> {
  const key = `${iata}|${month}`;
  const cached = normalCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.agg;
  }
  const mid = shiftIsoYears(`${month}-15`, -1);
  const start = addDaysIso(mid, -12);
  const end = addDaysIso(mid, 12);
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
    `&start_date=${start}&end_date=${end}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max` +
    `&wind_speed_unit=ms&timezone=auto`;
  const daily = asRecord(asRecord(await fetchJson(url, { method: "GET" }, 9000))?.daily);
  const highs = numbersAt(daily, "temperature_2m_max").filter(Number.isFinite);
  const lows = numbersAt(daily, "temperature_2m_min").filter(Number.isFinite);
  const precs = numbersAt(daily, "precipitation_sum").filter(Number.isFinite);
  const winds = numbersAt(daily, "wind_speed_10m_max").filter(Number.isFinite);
  if (highs.length === 0) {
    return null;
  }
  const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const rainyFraction =
    precs.length > 0 ? precs.filter((mm) => mm >= 1).length / precs.length : 0.3;
  const agg: NormalAggregate = {
    high: round1(avg(highs)),
    low: round1(avg(lows)),
    precipProb: clamp(Math.round(rainyFraction * 100), 0, 100),
    wind: round1(clamp(winds.length ? avg(winds) : 5, 0.5, 22)),
  };
  normalCache.set(key, { expires: Date.now() + 24 * 60 * 60 * 1000, agg });
  return agg;
}

function aggregateToSnapshots(
  agg: NormalAggregate,
  days: string[],
): WeatherSnapshot[] {
  return days.map((date) => ({
    date,
    temp_high_c: agg.high,
    temp_low_c: agg.low,
    precip_prob: agg.precipProb,
    wind_mps: agg.wind,
    extreme_risk: extremeRisk(agg.precipProb, agg.wind),
    source: "NORMAL" as const,
  }));
}

// 검색 간 날씨 재사용 캐시 (인메모리). 예보는 짧게, 평년/추정은 길게 보관.
const weatherCache = new Map<string, { expires: number; data: WeatherSnapshot[] }>();
const WEATHER_TTL_MS: Record<WeatherSource, number> = {
  FORECAST: 30 * 60 * 1000, // 30분
  NORMAL: 24 * 60 * 60 * 1000, // 24시간
  ESTIMATE: 10 * 60 * 1000, // 10분 (폴백)
};

// 예보는 순간 타임아웃이 잦아 1회 재시도. throw/null 모두 재시도 대상.
async function fetchForecastWithRetry(
  lat: number,
  lon: number,
  days: string[],
  attempts = 2,
): Promise<WeatherSnapshot[] | null> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const result = await fetchForecast(lat, lon, days);
      if (result && result.length > 0) {
        return result;
      }
    } catch {
      // 다음 시도로
    }
  }
  return null;
}

export async function getDestinationForecast(
  destinationIata: string,
  departDate: string,
  returnDate: string,
): Promise<WeatherSnapshot[]> {
  const cacheKey = `${destinationIata}|${departDate}|${returnDate}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const geo = AIRPORT_GEO[destinationIata];
  const days = eachDateInclusive(departDate, returnDate);
  let data: WeatherSnapshot[] | null = null;
  if (geo) {
    const daysUntilDeparture = diffDaysIso(todayIso(), departDate);
    if (daysUntilDeparture >= 0 && daysUntilDeparture <= 15) {
      data = await fetchForecastWithRetry(geo.lat, geo.lon, days);
    } else {
      try {
        // 평년: 도시×월 집계(캐시)를 받아 일자에 펼침 → 일정별 중복 호출 제거
        const agg = await getNormalAggregate(
          destinationIata,
          geo.lat,
          geo.lon,
          departDate.slice(0, 7),
        );
        data = agg ? aggregateToSnapshots(agg, days) : null;
      } catch {
        // 네트워크/쿼터 실패 → 합성 추정으로 폴백
      }
    }
  }
  if (!data || data.length === 0) {
    data = getEarth2ForecastMock(destinationIata, departDate, returnDate);
  }

  // 추정값(ESTIMATE)은 캐시하지 않는다 → 다음 검색이 진짜 예보/평년을 재시도.
  const source = data[0]?.source ?? "ESTIMATE";
  if (source !== "ESTIMATE") {
    weatherCache.set(cacheKey, {
      expires: Date.now() + WEATHER_TTL_MS[source],
      data,
    });
  }
  return data;
}

export async function searchSkyscannerOffer(
  input: FlightSearchInput,
): Promise<FlightOffer | null> {
  if (isSkyscannerConfigured()) {
    return searchSkyscannerLiveOffer(input);
  }
  if (isAmadeusConfigured()) {
    return null;
  }
  return searchSkyscannerMockOffer(input);
}

export async function searchAmadeusOffer(
  input: FlightSearchInput,
): Promise<FlightOffer | null> {
  if (isAmadeusConfigured()) {
    return searchAmadeusLiveOffer(input);
  }
  return searchAmadeusMockOffer(input);
}
