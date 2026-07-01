"use client";

import { useEffect, useMemo, useRef } from "react";

export type GlobeAirportMarker = {
  code: string;
  label: string;
  lat: number;
  lon: number;
  role: "origin" | "destination" | "both";
};

type Props = {
  markers: GlobeAirportMarker[];
  selectedOrigin: string | null;
  selectedDestination: string | null;
  pickMode: "origin" | "destination";
  onSelectAirport: (airportCode: string) => void;
};

type ProjectedPoint = {
  marker: GlobeAirportMarker;
  x: number;
  y: number;
  z: number;
};

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function projectPoint(
  lat: number,
  lon: number,
  rotY: number,
  rotX: number,
  cx: number,
  cy: number,
  radius: number,
): { x: number; y: number; z: number } {
  const latRad = toRad(lat);
  const lonRad = toRad(lon);
  const cosLat = Math.cos(latRad);
  const x = cosLat * Math.cos(lonRad);
  const y = Math.sin(latRad);
  const z = cosLat * Math.sin(lonRad);

  const x1 = Math.cos(rotY) * x + Math.sin(rotY) * z;
  const z1 = -Math.sin(rotY) * x + Math.cos(rotY) * z;

  const y1 = Math.cos(rotX) * y - Math.sin(rotX) * z1;
  const z2 = Math.sin(rotX) * y + Math.cos(rotX) * z1;

  return {
    x: cx + radius * x1,
    y: cy - radius * y1,
    z: z2,
  };
}

export default function GlobeAirportPicker({
  markers,
  selectedOrigin,
  selectedDestination,
  pickMode,
  onSelectAirport,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestMarkersRef = useRef<ProjectedPoint[]>([]);
  const dragStateRef = useRef({
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
  });
  const rotationRef = useRef({
    y: -1.45,
    x: 0.16,
  });

  const markerMap = useMemo(() => {
    return new Map(markers.map((marker) => [marker.code, marker]));
  }, [markers]);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!(canvasEl instanceof HTMLCanvasElement)) {
      return;
    }
    const canvas = canvasEl;

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    const ctx = context;

    let raf = 0;

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawGlobe() {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.42;

      ctx.clearRect(0, 0, width, height);

      const backdrop = ctx.createRadialGradient(
        cx - radius * 0.45,
        cy - radius * 0.65,
        radius * 0.2,
        cx,
        cy,
        radius * 1.12,
      );
      backdrop.addColorStop(0, "rgba(170, 220, 205, 0.28)");
      backdrop.addColorStop(1, "rgba(37, 44, 26, 0.03)");
      ctx.fillStyle = backdrop;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.18, 0, Math.PI * 2);
      ctx.fill();

      const ocean = ctx.createRadialGradient(
        cx - radius * 0.32,
        cy - radius * 0.55,
        radius * 0.12,
        cx + radius * 0.2,
        cy + radius * 0.2,
        radius * 1.1,
      );
      ocean.addColorStop(0, "#d8efe9");
      ocean.addColorStop(0.45, "#8fbdb2");
      ocean.addColorStop(1, "#507c79");
      ctx.fillStyle = ocean;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      ctx.strokeStyle = "rgba(235, 255, 250, 0.22)";
      ctx.lineWidth = 1;

      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 6) {
          const point = projectPoint(
            lat,
            lon,
            rotationRef.current.y,
            rotationRef.current.x,
            cx,
            cy,
            radius,
          );
          if (point.z > -0.12) {
            if (!started) {
              ctx.moveTo(point.x, point.y);
              started = true;
            } else {
              ctx.lineTo(point.x, point.y);
            }
          } else if (started) {
            ctx.stroke();
            ctx.beginPath();
            started = false;
          }
        }
        if (started) {
          ctx.stroke();
        }
      }

      for (let lon = -180; lon < 180; lon += 30) {
        ctx.beginPath();
        let started = false;
        for (let lat = -86; lat <= 86; lat += 4) {
          const point = projectPoint(
            lat,
            lon,
            rotationRef.current.y,
            rotationRef.current.x,
            cx,
            cy,
            radius,
          );
          if (point.z > -0.12) {
            if (!started) {
              ctx.moveTo(point.x, point.y);
              started = true;
            } else {
              ctx.lineTo(point.x, point.y);
            }
          } else if (started) {
            ctx.stroke();
            ctx.beginPath();
            started = false;
          }
        }
        if (started) {
          ctx.stroke();
        }
      }

      const projectedPoints = markers
        .map((marker) => {
          const projected = projectPoint(
            marker.lat,
            marker.lon,
            rotationRef.current.y,
            rotationRef.current.x,
            cx,
            cy,
            radius,
          );
          return {
            marker,
            ...projected,
          };
        })
        .filter((item) => item.z > -0.08)
        .sort((left, right) => left.z - right.z);

      latestMarkersRef.current = projectedPoints;

      for (const point of projectedPoints) {
        const isOrigin = point.marker.code === selectedOrigin;
        const isDestination = point.marker.code === selectedDestination;
        const isActive = isOrigin || isDestination;
        const baseColor = isOrigin
          ? "#dd7f4d"
          : isDestination
            ? "#5f9f8b"
            : point.marker.role === "origin"
              ? "#f2c08f"
              : "#bee3d8";
        const alpha = 0.4 + point.z * 0.55;
        const radiusPx = isActive ? 5.8 : 4;

        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.8, alpha)})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radiusPx + 1.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radiusPx, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.56)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "rgba(31,34,26,0.72)";
      ctx.font = "600 12px Manrope, sans-serif";
      const modeLabel = pickMode === "origin" ? "출발 선택 모드" : "도착 선택 모드";
      ctx.fillText(modeLabel, 12, 20);

      const selectedOriginLabel =
        selectedOrigin && markerMap.get(selectedOrigin)
          ? `${selectedOrigin} (${markerMap.get(selectedOrigin)?.label})`
          : "-";
      const selectedDestinationLabel =
        selectedDestination && markerMap.get(selectedDestination)
          ? `${selectedDestination} (${markerMap.get(selectedDestination)?.label})`
          : "-";
      ctx.fillText(`출발: ${selectedOriginLabel}`, 12, height - 26);
      ctx.fillText(`도착: ${selectedDestinationLabel}`, 12, height - 10);
    }

    function render() {
      const dragging = dragStateRef.current.dragging;
      if (!dragging) {
        rotationRef.current.y += 0.0025;
      }
      rotationRef.current.x = clamp(rotationRef.current.x, -0.75, 0.75);
      drawGlobe();
      raf = window.requestAnimationFrame(render);
    }

    function handlePointerDown(event: PointerEvent) {
      const state = dragStateRef.current;
      state.dragging = true;
      state.moved = false;
      state.startX = event.clientX;
      state.startY = event.clientY;
      state.lastX = event.clientX;
      state.lastY = event.clientY;
    }

    function handlePointerMove(event: PointerEvent) {
      const state = dragStateRef.current;
      if (!state.dragging) {
        return;
      }
      const dx = event.clientX - state.lastX;
      const dy = event.clientY - state.lastY;
      if (Math.abs(event.clientX - state.startX) > 3 || Math.abs(event.clientY - state.startY) > 3) {
        state.moved = true;
      }
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      rotationRef.current.y += dx * 0.008;
      rotationRef.current.x += dy * 0.0065;
    }

    function handlePointerUp(event: PointerEvent) {
      const state = dragStateRef.current;
      const wasDragging = state.dragging;
      state.dragging = false;
      if (!wasDragging || state.moved) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      let nearest: ProjectedPoint | null = null;
      let nearestDist = Number.POSITIVE_INFINITY;

      for (const point of latestMarkersRef.current) {
        const dx = point.x - x;
        const dy = point.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = point;
        }
      }

      if (nearest && nearestDist <= 14) {
        onSelectAirport(nearest.marker.code);
      }
    }

    resizeCanvas();
    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(canvas);

    canvas.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    raf = window.requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [markerMap, markers, onSelectAirport, pickMode, selectedDestination, selectedOrigin]);

  return <canvas ref={canvasRef} className="globe-canvas" />;
}
