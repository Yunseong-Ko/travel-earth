// 가벼운 인메모리 소셜 신호 스토어 (실험용).
// 서버 인스턴스 메모리에만 존재 → 재시작 시 리셋, 멀티 인스턴스 비공유.
// 수요가 검증되면 KV/DB(예: Upstash, Postgres)로 승격한다.

import type { RecommendationRequest } from "@/lib/recommendation/types";

const VIEWER_TTL_MS = 30_000;

const searchCounts = new Map<string, number>();
const viewers = new Map<string, number>(); // sessionId -> lastSeen(ms)

// "의도 지문": 비슷한 검색을 한 묶음으로 모으는 키.
// 출발지 + 후보 목적지 + 출발 월 + 예산 버킷 + 활동 + 모드.
export function intentFingerprint(req: RecommendationRequest): string {
  const dests = [...req.candidate_destinations].sort().join(",");
  const acts = [...req.activities].sort().join(",");
  const month = req.earliest_departure.slice(0, 7);
  const budgetBucket = Math.round(req.budget_max_krw / 100000);
  return `${req.origin_region}|${dests}|${month}|${budgetBucket}|${acts}|${req.mode}`;
}

export function recordSearch(fingerprint: string): number {
  const next = (searchCounts.get(fingerprint) ?? 0) + 1;
  searchCounts.set(fingerprint, next);
  return next;
}

function pruneViewers(now: number): void {
  for (const [id, lastSeen] of viewers) {
    if (now - lastSeen > VIEWER_TTL_MS) {
      viewers.delete(id);
    }
  }
}

export function heartbeat(sessionId: string): number {
  const now = Date.now();
  viewers.set(sessionId, now);
  pruneViewers(now);
  return viewers.size;
}

export function activeViewers(): number {
  pruneViewers(Date.now());
  return viewers.size;
}
