"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Map as LMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RecommendationItem } from "@/lib/recommendation/types";

export type MapPlace = {
  code: string;
  name: string;
  lat: number;
  lon: number;
};

type Props = {
  destinations: MapPlace[];
  origins: MapPlace[];
  items: RecommendationItem[];
  selectedCode: string | null;
  onSelect: (code: string) => void;
};

function krwShort(value: number): string {
  if (value >= 10000) {
    return `₩${Math.round(value / 10000)}만`;
  }
  return `₩${value.toLocaleString("ko-KR")}`;
}

export default function ResultMap({
  destinations,
  origins,
  items,
  selectedCode,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const bestByCode = useMemo(() => {
    const map = new Map<string, RecommendationItem>();
    for (const item of items) {
      const prev = map.get(item.destination_iata);
      if (!prev || item.rank < prev.rank) {
        map.set(item.destination_iata, item);
      }
    }
    return map;
  }, [items]);

  // 지도 1회 생성
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (mapRef.current || !containerRef.current) {
        return;
      }
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) {
        return;
      }
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: false,
      }).setView([20, 120], 3);
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          subdomains: "abcd",
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        },
      ).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // 마커 갱신
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      const map = mapRef.current;
      const layer = layerRef.current;
      if (cancelled || !map || !layer) {
        return;
      }
      layer.clearLayers();

      // 후보(컨텍스트) 점
      for (const place of destinations) {
        if (bestByCode.has(place.code)) {
          continue;
        }
        const icon = L.divIcon({
          className: "te-mk-wrap",
          html: `<div class="te-mk te-mk--ctx"><span class="te-mk-dot"></span><span class="te-mk-label">${place.name}</span></div>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        });
        L.marker([place.lat, place.lon], { icon, keyboard: false })
          .addTo(layer)
          .on("click", () => onSelectRef.current(place.code));
      }

      // 결과 핀
      for (const place of destinations) {
        const item = bestByCode.get(place.code);
        if (!item) {
          continue;
        }
        const matched = item.matched_activities.length > 0;
        const selected = selectedCode === place.code;
        const cls = [
          "te-mk",
          "te-mk--res",
          matched ? "is-matched" : "",
          selected ? "is-sel" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const priceLabel =
          item.transport_mode === "GROUND"
            ? "근교"
            : krwShort(item.price_krw);
        const icon = L.divIcon({
          className: "te-mk-wrap",
          html: `<div class="${cls}"><span class="te-mk-name">${place.name}</span><span class="te-mk-pin">${item.rank}</span><span class="te-mk-price">${priceLabel}</span></div>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        });
        L.marker([place.lat, place.lon], { icon, zIndexOffset: selected ? 1000 : 500 })
          .addTo(layer)
          .on("click", () => onSelectRef.current(place.code));
      }

      // 출발 마커
      for (const place of origins) {
        const icon = L.divIcon({
          className: "te-mk-wrap",
          html: `<div class="te-mk te-mk--origin"><span class="te-mk-origin-dot"></span><span class="te-mk-label te-mk-label--origin">출발 · ${place.name}</span></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        L.marker([place.lat, place.lon], { icon, zIndexOffset: 200 }).addTo(layer);
      }

      // 뷰 맞추기: 결과가 있으면 출발+결과, 없으면 후보 전체
      const focusPts: Array<[number, number]> = [];
      if (bestByCode.size > 0) {
        for (const place of destinations) {
          if (bestByCode.has(place.code)) {
            focusPts.push([place.lat, place.lon]);
          }
        }
        for (const o of origins) {
          focusPts.push([o.lat, o.lon]);
        }
      } else {
        for (const place of destinations) {
          focusPts.push([place.lat, place.lon]);
        }
      }
      if (focusPts.length >= 1) {
        // 컨테이너 크기를 다시 읽어야 fitBounds가 올바른 줌을 계산한다.
        map.invalidateSize(false);
        const bounds = L.latLngBounds(focusPts);
        map.fitBounds(bounds.pad(0.3), { animate: true, maxZoom: 7 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [destinations, origins, bestByCode, selectedCode]);

  return <div ref={containerRef} className="te-map" />;
}
