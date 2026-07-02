"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GlobeAirportPicker, {
  type GlobeAirportMarker,
} from "@/components/GlobeAirportPicker";
import Gurumi, { type GurumiMood } from "@/components/Gurumi";
import ResultMap, { type MapPlace } from "@/components/ResultMap";
import {
  ACTIVITY_LABELS,
  ACTIVITY_OPTIONS,
  AIRPORT_GEO,
  ALL_DESTINATION_AIRPORTS,
  DESTINATION_REGION_OPTIONS,
  DESTINATION_TAGLINES,
  ORIGIN_REGION_MAP,
  ORIGIN_REGION_OPTIONS,
  getDestinationAirportsByRegions,
  type ActivityTag,
  type DestinationRegionCode,
  type OriginRegionCode,
} from "@/lib/recommendation/regions";
import {
  DESTINATION_LABELS,
  type RecommendationItem,
  type RecommendationMode,
  type RecommendationResponse,
  formatKrw,
} from "@/lib/recommendation/types";

type FormState = {
  origin_region: string;
  destination_regions: string[];
  earliest_departure: string;
  latest_return: string;
  min_nights: string;
  max_nights: string;
  budget_max_krw: number;
  temp_min_c: string;
  temp_max_c: string;
  max_precip_prob: string;
  max_wind_mps: string;
  nonstop_only: boolean;
};

const MODE_OPTIONS: Array<{ id: RecommendationMode; label: string; hint: string }> = [
  { id: "WEATHER_FIRST", label: "날씨 우선", hint: "딱 좋은 날씨를 최우선" },
  { id: "BALANCED", label: "균형", hint: "날씨·활동·가격 고르게" },
  { id: "DEAL_FIRST", label: "딜 우선", hint: "가성비를 최우선" },
];

const STEP_TITLES = [
  "어디서 출발해요?",
  "어디까지 가볼까요?",
  "뭐 하고 싶어요?",
  "예산은 얼마까지?",
  "언제 떠나요?",
  "어떤 날씨가 좋아요?",
] as const;
const LAST_STEP = STEP_TITLES.length - 1;

// 검색 대기 중 돌아가는 문구 — 기다림도 브랜드 톤의 일부.
const LOADING_MESSAGES = [
  "하늘 먼저 살펴보는 중 ☁️",
  "항공권 뒤적이는 중 ✈️",
  "지도에 핀 꽂는 중 📍",
  "날씨랑 협상하는 중 🌤️",
] as const;

// KST 사용자가 아침에 접속하면 toISOString(UTC)은 "어제"를 돌려준다 — 로컬 기준으로 포맷.
function toLocalIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isoAfterDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toLocalIso(date);
}

// 다가오는 토·일. 오늘이 토요일이면 오늘부터, 일요일이면 다음 주말.
// 7일 이내이므로 날씨는 항상 실제 예보([예보])로 뜬다.
function upcomingWeekend(): { sat: string; sun: string } {
  const date = new Date();
  const daysUntilSaturday = (6 - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + daysUntilSaturday);
  const sat = toLocalIso(date);
  date.setDate(date.getDate() + 1);
  return { sat, sun: toLocalIso(date) };
}

// 극한의 P 모드: 오늘 출발, 내일 복귀 (숙소는 가서 잡는 사람들).
function todayPair(): { today: string; tomorrow: string } {
  const date = new Date();
  const today = toLocalIso(date);
  date.setDate(date.getDate() + 1);
  return { today, tomorrow: toLocalIso(date) };
}

function scoreWidth(score: number): string {
  return `${Math.max(0, Math.min(100, score))}%`;
}

export default function Home() {
  const [form, setForm] = useState<FormState>({
    origin_region: ORIGIN_REGION_OPTIONS[0].id,
    // 기본값: 국내 + 근접국(일본/대만·홍콩) 중심. 동남아는 선택 가능하지만 기본은 아님.
    destination_regions: ["KOREA_DOMESTIC", "JAPAN", "TAIWAN_HK"],
    earliest_departure: isoAfterDays(14),
    latest_return: isoAfterDays(35),
    min_nights: "2",
    max_nights: "4",
    budget_max_krw: 800000,
    temp_min_c: "22",
    temp_max_c: "29",
    max_precip_prob: "40",
    max_wind_mps: "8",
    nonstop_only: false,
  });
  const [activities, setActivities] = useState<ActivityTag[]>([]);
  const [mode, setMode] = useState<RecommendationMode>("BALANCED");
  const [step, setStep] = useState(0);
  const [showIntro, setShowIntro] = useState(true);
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [viewers, setViewers] = useState(0);
  const [searchCount, setSearchCount] = useState<number | null>(null);
  const sessionIdRef = useRef<string>("");

  // 검색 중 로딩 문구 로테이션 (클릭 후에만 돌므로 SSR 불일치 없음)
  useEffect(() => {
    if (!loading) {
      return;
    }
    const id = setInterval(
      () => setLoadingMsgIdx((i) => i + 1),
      1300,
    );
    return () => clearInterval(id);
  }, [loading]);

  // 라이브 presence: 12초마다 하트비트 → "지금 보는 중 N명"
  useEffect(() => {
    if (!sessionIdRef.current) {
      sessionIdRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : String(Math.random()).slice(2);
    }
    let active = true;
    const ping = async () => {
      try {
        const res = await fetch("/api/v1/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionIdRef.current }),
        });
        const data = (await res.json()) as { viewers?: number };
        if (active && typeof data.viewers === "number") {
          setViewers(data.viewers);
        }
      } catch {
        // presence는 실패해도 무시
      }
    };
    ping();
    const id = setInterval(ping, 12000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const candidateDestinations = useMemo(
    () =>
      getDestinationAirportsByRegions(
        form.destination_regions as DestinationRegionCode[],
      ),
    [form.destination_regions],
  );

  const mapDestinations = useMemo<MapPlace[]>(
    () =>
      candidateDestinations
        .map((code) => {
          const geo = AIRPORT_GEO[code];
          if (!geo) {
            return null;
          }
          return {
            code,
            name: DESTINATION_LABELS[code] ?? geo.city,
            lat: geo.lat,
            lon: geo.lon,
          };
        })
        .filter((p): p is MapPlace => p !== null),
    [candidateDestinations],
  );

  // 진입 화면 지구본용: 전체 공항을 장식 마커로 (기능적 선택은 없음)
  const heroMarkers = useMemo<GlobeAirportMarker[]>(() => {
    const originCodes = new Set<string>(Object.values(ORIGIN_REGION_MAP).flat());
    const destinationCodes = new Set<string>(ALL_DESTINATION_AIRPORTS);
    return Object.entries(AIRPORT_GEO).map(([code, geo]) => {
      const isOrigin = originCodes.has(code);
      const isDestination = destinationCodes.has(code);
      const role: GlobeAirportMarker["role"] =
        isOrigin && isDestination ? "both" : isOrigin ? "origin" : "destination";
      return {
        code,
        label: DESTINATION_LABELS[code] ?? geo.city,
        lat: geo.lat,
        lon: geo.lon,
        role,
      };
    });
  }, []);

  const mapOrigins = useMemo<MapPlace[]>(() => {
    const codes = ORIGIN_REGION_MAP[form.origin_region as OriginRegionCode] ?? [];
    return codes
      .map((code): MapPlace | null => {
        const geo = AIRPORT_GEO[code];
        return geo
          ? { code: String(code), name: geo.city, lat: geo.lat, lon: geo.lon }
          : null;
      })
      .filter((p): p is MapPlace => p !== null);
  }, [form.origin_region]);

  const selectedItem = useMemo<RecommendationItem | null>(() => {
    if (!result || !selectedCode) {
      return null;
    }
    const matches = result.items.filter(
      (i) => i.destination_iata === selectedCode,
    );
    if (matches.length === 0) {
      return null;
    }
    return matches.reduce((best, i) => (i.rank < best.rank ? i : best));
  }, [result, selectedCode]);

  function toggleRegion(regionId: string) {
    setForm((prev) => {
      const exists = prev.destination_regions.includes(regionId);
      const next = exists
        ? prev.destination_regions.filter((item) => item !== regionId)
        : [...prev.destination_regions, regionId];
      return { ...prev, destination_regions: next };
    });
  }

  function toggleActivity(tag: ActivityTag) {
    setActivities((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function goNext() {
    if (step === 1 && form.destination_regions.length === 0) {
      setError("탐색할 도착 지역을 최소 1개 선택해 주세요.");
      return;
    }
    setError(null);
    if (step >= LAST_STEP) {
      runSearch();
      return;
    }
    setStep((s) => Math.min(LAST_STEP, s + 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  // 원탭 주말 모드: 이번 토~일 + 국내 근교. 마법사를 건너뛰고 바로 검색한다.
  function applyWeekendPreset() {
    const { sat, sun } = upcomingWeekend();
    const next: FormState = {
      ...form,
      destination_regions: ["KOREA_GROUND"],
      earliest_departure: sat,
      latest_return: sun,
      min_nights: "1",
      max_nights: "1",
    };
    setForm(next);
    setShowIntro(false);
    setStep(LAST_STEP);
    void runSearchWith(next);
  }

  // 극한의 P 모드: 오늘 출발 → 내일 복귀, 국내 근교, 지금 날씨 기준.
  function applyTodayPreset() {
    const { today, tomorrow } = todayPair();
    const next: FormState = {
      ...form,
      destination_regions: ["KOREA_GROUND"],
      earliest_departure: today,
      latest_return: tomorrow,
      min_nights: "1",
      max_nights: "1",
    };
    setForm(next);
    setShowIntro(false);
    setStep(LAST_STEP);
    void runSearchWith(next);
  }

  async function runSearch() {
    return runSearchWith(form);
  }

  // 프리셋(주말 모드 등)은 setState 직후 상태 반영을 기다릴 수 없으므로 폼을 명시적으로 받는다.
  async function runSearchWith(f: FormState) {
    setError(null);

    if (f.destination_regions.length === 0) {
      setError("탐색할 도착 지역을 최소 1개 선택해 주세요.");
      setStep(1);
      return;
    }

    setLoading(true);
    const payload = {
      origin_region: f.origin_region,
      candidate_destinations: getDestinationAirportsByRegions(
        f.destination_regions as DestinationRegionCode[],
      ),
      earliest_departure: f.earliest_departure,
      latest_return: f.latest_return,
      min_nights: Number(f.min_nights),
      max_nights: Number(f.max_nights),
      budget_max_krw: f.budget_max_krw,
      weather_preference: {
        temp_min_c: Number(f.temp_min_c),
        temp_max_c: Number(f.temp_max_c),
        max_precip_prob: Number(f.max_precip_prob),
        max_wind_mps: Number(f.max_wind_mps),
      },
      activities,
      mode,
      nonstop_only: f.nonstop_only,
    };

    try {
      const response = await fetch("/api/v1/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as
        | RecommendationResponse
        | { message?: string; errors?: string[] };

      if (!response.ok) {
        const errorData = data as { message?: string; errors?: string[] };
        const details = errorData.errors ? errorData.errors.join(" / ") : null;
        setError(details ?? errorData.message ?? "추천 요청 처리에 실패했습니다.");
        setResult(null);
        return;
      }

      const ok = data as RecommendationResponse;
      setResult(ok);
      setSelectedCode(ok.items[0]?.destination_iata ?? null);
      if (ok.social) {
        setSearchCount(ok.social.search_count);
        // viewers는 presence 폴링이 진실원본(라우트별 스토어 분리 가능성) → 여기서 덮지 않음
      }
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="te-shell">
      <header className="te-hero">
        <div>
          <p className="te-eyebrow">Travel EARTH</p>
          <h1>어디 갈지 고민은 그만, 지도가 골라줄게요</h1>
          <p className="te-sub">
            날짜랑 예산, 하고 싶은 것만 알려주세요. 국내부터 일본·대만·홍콩까지,
            날씨 좋고 가성비 맞는 곳을 지도에 핀으로 띄워드릴게요 — 왜 거기인지
            근거도 같이요.
          </p>
        </div>
        {!showIntro && (
          <div className="te-mode-toggle" role="tablist" aria-label="추천 모드">
            {MODE_OPTIONS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={mode === m.id ? "is-active" : ""}
                onClick={() => setMode(m.id)}
                title={m.hint}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {showIntro ? (
        <section className="te-intro">
          <div className="te-intro-globe">
            <GlobeAirportPicker markers={heroMarkers} showLabels={false} />
          </div>
          <div className="te-intro-actions">
            <button
              type="button"
              className="te-submit te-intro-cta te-intro-cta--weekend"
              onClick={applyWeekendPreset}
            >
              이번 주말 어디 가지? →
            </button>
            <button
              type="button"
              className="te-submit te-intro-cta"
              onClick={applyTodayPreset}
            >
              오늘 바로 떠나기 ⚡
            </button>
            <button
              type="button"
              className="te-submit te-intro-cta te-intro-cta--secondary"
              onClick={() => setShowIntro(false)}
            >
              조건 직접 정하기
            </button>
          </div>
        </section>
      ) : (
        <main className="te-main">
        <aside className="te-controls">
          <div className="te-step-head">
            <div className="te-step-progress">
              {STEP_TITLES.map((title, idx) => (
                <span
                  key={title}
                  className={`te-step-dot ${idx <= step ? "is-done" : ""} ${idx === step ? "is-current" : ""}`}
                />
              ))}
            </div>
            <p className="te-step-label">
              <span className="te-step-count">
                {step + 1}/{STEP_TITLES.length}
              </span>{" "}
              {STEP_TITLES[step]}
            </p>
          </div>

          <div className="te-step-body">
            {step === 0 && (
              <label className="te-field">
                출발 지역
                <select
                  value={form.origin_region}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, origin_region: e.target.value }))
                  }
                >
                  {ORIGIN_REGION_OPTIONS.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {step === 1 && (
              <div className="te-field">
                <span>여러 개 골라도 돼요</span>
                <div className="te-chips">
                  {DESTINATION_REGION_OPTIONS.map((region) => {
                    const on = form.destination_regions.includes(region.id);
                    return (
                      <button
                        type="button"
                        key={region.id}
                        className={`te-chip ${on ? "is-on" : ""}`}
                        onClick={() => toggleRegion(region.id)}
                      >
                        {region.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="te-field">
                <span>
                  끌리는 것만 콕콕 — 안 골라도 돼요{" "}
                  {activities.length > 0 && (
                    <>
                      <em className="te-count">{activities.length}</em>
                      <button
                        type="button"
                        className="te-clear"
                        onClick={() => setActivities([])}
                      >
                        해제
                      </button>
                    </>
                  )}
                </span>
                <div className="te-chips">
                  {ACTIVITY_OPTIONS.map((a) => {
                    const on = activities.includes(a.id);
                    return (
                      <button
                        type="button"
                        key={a.id}
                        className={`te-chip ${on ? "is-on" : ""}`}
                        onClick={() => toggleActivity(a.id)}
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 3 && (
              <label className="te-field">
                <span>
                  예산 상한 <strong>{formatKrw(form.budget_max_krw)}</strong>
                </span>
                <input
                  type="range"
                  min={100000}
                  max={3000000}
                  step={50000}
                  value={form.budget_max_krw}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      budget_max_krw: Number(e.target.value),
                    }))
                  }
                />
              </label>
            )}

            {step === 4 && (
              <>
                <div className="te-row">
                  <label className="te-field">
                    출발 가능일
                    <input
                      type="date"
                      value={form.earliest_departure}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          earliest_departure: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="te-field">
                    복귀 마감일
                    <input
                      type="date"
                      value={form.latest_return}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, latest_return: e.target.value }))
                      }
                    />
                  </label>
                </div>

                <div className="te-row">
                  <label className="te-field">
                    최소 박
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={form.min_nights}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, min_nights: e.target.value }))
                      }
                    />
                  </label>
                  <label className="te-field">
                    최대 박
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={form.max_nights}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, max_nights: e.target.value }))
                      }
                    />
                  </label>
                </div>

                <label className="te-checkbox">
                  <input
                    type="checkbox"
                    checked={form.nonstop_only}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, nonstop_only: e.target.checked }))
                    }
                  />
                  무경유만
                </label>
              </>
            )}

            {step === 5 && (
              <>
                <div className="te-row">
                  <label className="te-field">
                    최저 기온°C
                    <input
                      type="number"
                      value={form.temp_min_c}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, temp_min_c: e.target.value }))
                      }
                    />
                  </label>
                  <label className="te-field">
                    최고 기온°C
                    <input
                      type="number"
                      value={form.temp_max_c}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, temp_max_c: e.target.value }))
                      }
                    />
                  </label>
                </div>
                <div className="te-row">
                  <label className="te-field">
                    허용 강수%
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.max_precip_prob}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          max_precip_prob: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="te-field">
                    허용 풍속 m/s
                    <input
                      type="number"
                      min={1}
                      max={30}
                      step={0.5}
                      value={form.max_wind_mps}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, max_wind_mps: e.target.value }))
                      }
                    />
                  </label>
                </div>
              </>
            )}

            {error && <p className="te-error">{error}</p>}
          </div>

          <div className="te-step-nav">
            {step > 0 && (
              <button type="button" className="te-step-back" onClick={goBack}>
                ← 이전
              </button>
            )}
            <button
              type="button"
              className="te-submit"
              disabled={loading}
              onClick={goNext}
            >
              {loading
                ? LOADING_MESSAGES[loadingMsgIdx % LOADING_MESSAGES.length]
                : step === LAST_STEP
                  ? "떠날 곳 찾기 →"
                  : "다음 →"}
            </button>
          </div>
        </aside>

        <section className="te-stage">
          <div className="te-social">
            <span className="te-live">
              <i className="te-live-dot" /> 지금 <b>{viewers}</b>명이 같이 보는 중
            </span>
            {searchCount !== null && (
              <span>
                나랑 같은 조건으로 찾아본 사람 <b>{searchCount}</b>명
              </span>
            )}
          </div>
          <div className="te-mapwrap">
            <ResultMap
              destinations={mapDestinations}
              origins={mapOrigins}
              items={result?.items ?? []}
              selectedCode={selectedCode}
              onSelect={setSelectedCode}
            />
            <div className="te-legend">
              <span>
                <i className="dot coral" /> 활동 매칭
              </span>
              <span>
                <i className="dot mint" /> 추천(활동 미매칭)
              </span>
              <span>
                <i className="dot ghost" /> 후보
              </span>
              <span className="te-legend-note">핀이 클수록 저렴</span>
            </div>
          </div>

          <div className="te-detail">
            {selectedItem ? (
              <DetailCard item={selectedItem} />
            ) : result && result.items.length === 0 ? (
              <div className="te-empty">
                <Gurumi mood="cloudy" size={44} />
                <p className="te-empty-title">이번 조건으론 못 찾았어요 🥲</p>
                <ul>
                  <li>예산을 조금만 올려보면 어때요?</li>
                  <li>‘무경유만’을 끄면 선택지가 확 늘어요</li>
                  <li>탐색 범위를 한 곳만 더 열어봐요</li>
                </ul>
              </div>
            ) : result ? (
              <p className="te-placeholder">
                {selectedCode
                  ? "여긴 이번 Top 5 밖이에요. 파란 핀을 눌러보세요!"
                  : "지도의 핀을 누르면 왜 거기인지 알려줄게요."}
              </p>
            ) : (
              <p className="te-placeholder">
                왼쪽에서 조건만 정해주세요. 갈 수 있는 곳을 지도에 다
                띄워드릴게요.
              </p>
            )}

            {result && result.items.length > 0 && (
              <ol className="te-ranklist">
                {result.items.map((item) => (
                  <li key={`${item.rank}-${item.destination_iata}`}>
                    <button
                      type="button"
                      className={
                        selectedCode === item.destination_iata ? "is-active" : ""
                      }
                      onClick={() => setSelectedCode(item.destination_iata)}
                    >
                      <span className="te-rank">#{item.rank}</span>
                      <span className="te-rl-name">{item.destination_name}</span>
                      <span className="te-rl-price">
                        {item.transport_mode === "GROUND"
                          ? "근교"
                          : formatKrw(item.price_krw)}
                      </span>
                      <span className="te-rl-total">{item.total_score}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
        </main>
      )}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="te-scoreline">
      <span className="te-scorelabel">{label}</span>
      <div className="te-scoretrack">
        <div style={{ width: scoreWidth(value) }} />
      </div>
      <span className="te-scoreval">{value.toFixed(1)}</span>
    </div>
  );
}

function skyOf(precip: number): { icon: string; label: string } {
  if (precip < 20) return { icon: "☀️", label: "맑음" };
  if (precip < 45) return { icon: "🌤️", label: "대체로 맑음" };
  if (precip < 65) return { icon: "⛅", label: "구름 많음" };
  return { icon: "🌧️", label: "비 잦음" };
}

const SOURCE_BADGE: Record<
  RecommendationItem["weather_source"],
  { mark: string; text: string }
> = {
  FORECAST: { mark: "✓", text: "실시간 예보 기준" },
  NORMAL: { mark: "⚠", text: "평년(작년 같은 시기) 기준 · 실제 예보 아님" },
  ESTIMATE: { mark: "⚠", text: "추정값 (날씨 데이터 제한)" },
};

function DetailCard({ item }: { item: RecommendationItem }) {
  const { avgTemp, avgPrecip } = item.weather_summary;
  const sky = skyOf(avgPrecip);
  const month = Number(item.depart_date.slice(5, 7));
  const day = Number(item.depart_date.slice(8, 10));
  const phase = day <= 10 ? "초" : day <= 20 ? "중순" : "말";
  const isNormal = item.weather_source === "NORMAL";
  const matchedLabels = item.matched_activities.map((a) => ACTIVITY_LABELS[a] ?? a);
  const badge = SOURCE_BADGE[item.weather_source];
  // 구름이 표정: 우천 적응이거나 비 잦으면 우산, 그 외엔 강수확률 따라.
  const gurumiMood: GurumiMood =
    item.rain_adaptive || avgPrecip >= 65
      ? "rainy"
      : avgPrecip < 20
        ? "sunny"
        : avgPrecip < 45
          ? "partly"
          : "cloudy";
  // 정직한 숙소 딥링크: 날짜·목적지만 채워 보낼 뿐, 가격/절약액 주장은 하지 않는다.
  const hotelUrl = `https://www.booking.com/searchresults.ko.html?ss=${encodeURIComponent(
    item.destination_name,
  )}&checkin=${item.depart_date}&checkout=${item.return_date}`;

  // 한 줄 판정 (왜 여기?)
  const verdict: string[] = [];
  if (item.rain_adaptive) {
    // 우천 적응: "비 피해 딴 데 가라"가 아니라 "이 날씨엔 이걸 해"로 프레임 전환.
    verdict.push(
      `${month}월 ${phase}, 비 예보(강수 ${avgPrecip}%)${isNormal ? " · 평년 기준" : ""}.`,
    );
    if (matchedLabels.length > 0) {
      verdict.push(`그래서 ${matchedLabels.join("·")}가 딱이에요.`);
    } else {
      verdict.push("실내 위주로 잡는 걸 추천해요.");
    }
  } else {
    verdict.push(
      `${month}월 ${phase}, ${isNormal ? "평년 " : ""}${avgTemp}°C ${sky.label}.`,
    );
    if (matchedLabels.length > 0) {
      verdict.push(`${matchedLabels.join("·")} 다 돼.`);
    }
  }
  verdict.push(
    item.rank === 1
      ? "네 조건에 제일 가까워."
      : `네 조건엔 ${item.rank}순위로 잘 맞아.`,
  );

  return (
    <article className="te-card">
      <div className="te-card-head">
        <h3>
          {item.destination_name}{" "}
          <span className="te-iata">{item.destination_iata}</span>
        </h3>
        <span className="te-provider">
          {item.transport_mode === "GROUND"
            ? "국내 근교"
            : item.price_is_live
              ? item.provider
              : "추정가"}
        </span>
      </div>
      {DESTINATION_TAGLINES[item.destination_iata] && (
        <p className="te-tagline">
          “{DESTINATION_TAGLINES[item.destination_iata]}”
        </p>
      )}
      <p className="te-window">
        {item.transport_mode === "GROUND"
          ? `${item.depart_date} → ${item.return_date}`
          : `${item.origin_iata} 출발 · ${item.depart_date} → ${item.return_date}`}
      </p>
      {item.transport_mode === "GROUND" ? (
        <p className="te-honesty te-honesty--normal" style={{ marginTop: "0.1rem" }}>
          <span className="te-honesty-mark">🚗</span> 자차·KTX·버스로 다녀오는 근교
          (항공권 불필요)
        </p>
      ) : (
        <>
          <p className="te-price">{formatKrw(item.price_krw)}</p>
          {!item.price_is_live && (
            <p className="te-price-disclaimer">
              <span className="te-price-disclaimer-mark">⚠ 추정 가격</span>
              <span>
                이 금액은 실제 항공권 가격이 아닙니다. 실제 가격은{" "}
                <strong>항공권 보기</strong> 버튼을 눌러 Skyscanner에서
                반드시 확인하세요.
              </span>
            </p>
          )}
        </>
      )}

      <div className="te-verdict">
        <Gurumi mood={gurumiMood} size={48} />
        <p className="te-verdict-bubble">{verdict.join(" ")}</p>
      </div>

      {item.weather_daily.length > 0 &&
        (item.weather_source === "FORECAST" ? (
          // 실제 예보: 일자별로 변하므로 일별 스트립
          <div className="te-daystrip">
            {item.weather_daily.map((d) => {
              const s = skyOf(d.precip);
              return (
                <div className="te-day" key={d.date} title={`강수 ${d.precip}%`}>
                  <span className="te-day-date">
                    {d.date.slice(5, 7)}/{d.date.slice(8, 10)}
                  </span>
                  <span className="te-day-icon">{s.icon}</span>
                  <span className="te-day-temp">{Math.round(d.hi)}°</span>
                </div>
              );
            })}
          </div>
        ) : (
          // 평년/추정: 시즌 대표값 1개 (일별로 똑같으므로 반복 노이즈 제거)
          <div className="te-daystrip">
            <div className="te-day te-day--wide" title={`강수 ${avgPrecip}%`}>
              <span className="te-day-date">
                {isNormal ? "평년" : "추정"} {month}월 {phase}
              </span>
              <span className="te-day-icon">{sky.icon}</span>
              <span className="te-day-temp">
                {Math.round(item.weather_daily[0].hi)}° /{" "}
                {Math.round(item.weather_daily[0].lo)}°
              </span>
            </div>
          </div>
        ))}

      {matchedLabels.length > 0 && (
        <div className="te-actpills">
          {matchedLabels.map((label) => (
            <span className="te-actpill" key={label}>
              {label}
            </span>
          ))}
        </div>
      )}

      <p className={`te-honesty te-honesty--${item.weather_source.toLowerCase()}`}>
        <span className="te-honesty-mark">{badge.mark}</span> {badge.text}
      </p>

      <details className="te-evidence">
        <summary>점수 근거 보기</summary>
        <ScoreBar label="날씨" value={item.weather_score} />
        <p className="te-explain">{item.score_explanations.weather}</p>
        <ScoreBar label="활동" value={item.activity_score} />
        <p className="te-explain">{item.score_explanations.activity}</p>
        {item.transport_mode === "GROUND" ? (
          <p className="te-explain">
            {item.score_explanations.price} {item.score_explanations.convenience}
          </p>
        ) : (
          <>
            <ScoreBar label="가격" value={item.price_score} />
            <p className="te-explain">{item.score_explanations.price}</p>
            <ScoreBar label="편의" value={item.convenience_score} />
            <p className="te-explain">{item.score_explanations.convenience}</p>
          </>
        )}
        <p className="te-total">{item.score_explanations.total}</p>
      </details>

      <div className="te-cta-row">
        <a
          href={item.flight_deeplink_url}
          target="_blank"
          rel="noopener noreferrer"
          className="te-cta"
        >
          {item.transport_mode === "GROUND"
            ? "가는 법 찾기 →"
            : item.price_is_live
              ? "항공권 보기 →"
              : "실제 요금 검색하기 →"}
        </a>
        <a
          href={hotelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="te-cta te-cta--hotel"
        >
          🛏️ 이 날짜 숙소 보기
        </a>
      </div>
    </article>
  );
}
