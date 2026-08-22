"use client";

// ---------------------------------------------------------------------------
// Монгол улсын хилийн SVG зураг — суурь зураггүй (дэвсгэр нь хуудасны өнгө).
// Аймаг/нийслэл (эсвэл сум/дүүрэг) бүрийг газар зүйн нэрийн ТООГООР нь өнгөөр
// зэрэглэж, дээр нь дархад дэлгэрэнгүй рүү шилжинэ. Гуравдагч сан ашиглаагүй —
// GeoJSON‑г шууд path болгож, viewBox‑оор зөөлөн ойртоно.
// ---------------------------------------------------------------------------

import PropTypes from "prop-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Box from "@mui/material/Box";

// Монголын дундаж өргөрөгт тохирсон энгийн проекц (уртрагийг cos(φ)-ээр агшаана)
const LAT0 = 46.8;
const KX = Math.cos((LAT0 * Math.PI) / 180);

// Тооны зэрэглэлийн өнгө: цөөн → гүн хөх, олон → цайвар цэнхэр
const LOW = [20, 49, 95];
const HIGH = [124, 192, 255];
const EMPTY = "#2a4470"; // нэргүй нэгж (SVG 1.1-д rgba() найдваргүй тул hex)

const project = (lon, lat) => [lon * KX, -lat];

function ringToPath(ring) {
  let d = "";
  for (let i = 0; i < ring.length; i += 1) {
    const [x, y] = project(ring[i][0], ring[i][1]);
    d += `${i ? "L" : "M"}${x.toFixed(4)} ${y.toFixed(4)}`;
  }
  return `${d}Z`;
}

function geometryToPath(geometry) {
  if (!geometry) return "";
  const polys =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polys.map((poly) => poly.map(ringToPath).join(" ")).join(" ");
}

// bbox (EPSG:4326) → проекцлосон viewBox тэгш өнцөгт. Хайрцгийг зургийн
// талбайн харьцаанд (ratio) тааруулж ТЭЛНЭ — ингэснээр нутаг дэвсгэр
// хажуу талдаа хоосон зай үлдээхгүй, дүүрэн харагдана.
function bboxToView(bbox, ratio, pad = 0.05) {
  const [minx, miny, maxx, maxy] = bbox;
  const [x1, y1] = project(minx, maxy); // зүүн дээд
  const [x2, y2] = project(maxx, miny); // баруун доод
  let w = (x2 - x1) * (1 + pad * 2);
  let h = (y2 - y1) * (1 + pad * 2);
  let x = x1 - (x2 - x1) * pad;
  let y = y1 - (y2 - y1) * pad;
  if (w / h < ratio) {
    const nw = h * ratio;
    x -= (nw - w) / 2;
    w = nw;
  } else {
    const nh = w / ratio;
    y -= (nh - h) / 2;
    h = nh;
  }
  return { x, y, w, h };
}

const mix = (t) =>
  `rgb(${LOW.map((c, i) => Math.round(c + (HIGH[i] - c) * t)).join(",")})`;

// Шошго давхцахаас сэргийлнэ — олон нэртэй нэгжийг эхэлж байрлуулна. Баруун,
// зүүн, дээш, доош гэсэн 4 байрлалыг ээлжлэн үзэж, аль нь ч багтахгүй бол
// зөвхөн цэгийг үлдээж, нэрийг нь hover дээр харуулна.
const ANCHORS = [
  { dx: 0.35, dy: 0, anchor: "start" },
  { dx: -0.35, dy: 0, anchor: "end" },
  { dx: 0, dy: -1.9, anchor: "middle" },
  { dx: 0, dy: 1.8, anchor: "middle" },
];

function placeLabels(shapes, fs) {
  const boxes = [];
  const placed = new Map();
  [...shapes]
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .forEach((s) => {
      if (!s.center) return;
      const [cx, cy] = project(s.center[0], s.center[1]);
      const w = Math.max(String(s.name || "").length * fs * 0.42, fs * 2.6);
      for (let i = 0; i < ANCHORS.length; i += 1) {
        const a = ANCHORS[i];
        const x = cx + a.dx * fs;
        const y = cy + a.dy * fs;
        const left = a.anchor === "start" ? 0 : a.anchor === "end" ? w : w / 2;
        const right = a.anchor === "start" ? w : a.anchor === "end" ? 0 : w / 2;
        const box = [
          x - left - fs * 0.25,
          y - fs * 0.85,
          x + right + fs * 0.25,
          y + fs * 1.35,
        ];
        const hit = boxes.some(
          (b) =>
            box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1],
        );
        if (!hit) {
          boxes.push(box);
          placed.set(s.id, { x, y, anchor: a.anchor });
          break;
        }
      }
    });
  return placed;
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const fmt = (n) => new Intl.NumberFormat("mn-MN").format(n || 0);

export default function MongoliaMap({
  units = [],
  bbox = null,
  activeId = null,
  onSelect,
  onHover,
  minRatio = 1.5,
  maxRatio = 2.1,
}) {
  const wrapRef = useRef(null);
  const rafRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [tip, setTip] = useState({ x: 0, y: 0 });

  // Зургийн талбайн харьцаа: нутгийн байгалийн харьцаанд ойртуулна (улс өргөн,
  // аймаг дөрвөлжин) — ингэснээр дээд/доод талд илүү хоосон зай үлдэхгүй.
  const box = bbox || [87.7, 41.6, 120.0, 52.2];
  const ratio = useMemo(() => {
    const [x1, y1] = project(box[0], box[3]);
    const [x2, y2] = project(box[2], box[1]);
    const natural = (x2 - x1) / (y2 - y1 || 1);
    return Math.min(maxRatio, Math.max(minRatio, natural));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box[0], box[1], box[2], box[3], minRatio, maxRatio]);

  const target = useMemo(
    () => bboxToView(box, ratio),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [box[0], box[1], box[2], box[3], ratio],
  );
  const [view, setView] = useState(target);

  // viewBox‑ийн зөөлөн шилжилт (нисэх эффект)
  useEffect(() => {
    const from = { ...view };
    const to = target;
    const same =
      Math.abs(from.x - to.x) < 1e-6 &&
      Math.abs(from.y - to.y) < 1e-6 &&
      Math.abs(from.w - to.w) < 1e-6;
    if (same) return undefined;
    const t0 = performance.now();
    const DUR = 750;
    const step = (now) => {
      const k = easeInOut(Math.min(1, (now - t0) / DUR));
      setView({
        x: from.x + (to.x - from.x) * k,
        y: from.y + (to.y - from.y) * k,
        w: from.w + (to.w - from.w) * k,
        h: from.h + (to.h - from.h) * k,
      });
      if (k < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const shapes = useMemo(() => {
    const counts = units.map((u) => u.count || 0).filter((c) => c > 0);
    const max = Math.max(1, ...counts);
    const min = counts.length ? Math.min(...counts) : 0;
    const span = Math.max(1, max - min);
    return units.map((u) => ({
      ...u,
      d: geometryToPath(u.geometry),
      t: u.count ? ((u.count - min) / span) ** 0.75 * 0.85 + 0.15 : -1,
    }));
  }, [units]);

  const fs = view.w * 0.021; // үсгийн хэмжээ viewBox‑той хамт томордоггүй
  const dx = view.w * 0.007; // "зузаан" ирмэгийн шилжилт (баруун‑дээш)
  const dy = view.w * 0.013;
  const labelled = useMemo(() => placeLabels(shapes, fs), [shapes, fs]);

  const handleMove = useCallback((e) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top });
  }, []);

  const enter = (u) => {
    setHover(u.id);
    onHover?.(u);
  };
  const leave = () => {
    setHover(null);
    onHover?.(null);
  };

  const hovered = shapes.find((s) => s.id === hover);

  return (
    <Box
      ref={wrapRef}
      onMouseMove={handleMove}
      onMouseLeave={leave}
      sx={{
        position: "relative",
        width: 1,
        aspectRatio: ratio,
        overflow: "hidden", // хил нь картын бусад хэсэг рүү халихгүй
        transition: "aspect-ratio 0.75s cubic-bezier(0.4, 0, 0.2, 1)",
        cursor: "crosshair",
      }}
    >
      <Box
        component="svg"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        sx={{ width: 1, height: 1, display: "block", overflow: "visible" }}
      >
        <defs>
          <radialGradient id="ns-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </radialGradient>
          <filter id="ns-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation={view.w * 0.006}
              floodColor="#7dd3fc"
              floodOpacity="0.9"
            />
          </filter>
        </defs>

        {/* Улсын доогуур зөөлөн гэрэлтэлт */}
        <ellipse
          cx={view.x + view.w / 2}
          cy={view.y + view.h / 2}
          rx={view.w * 0.46}
          ry={view.h * 0.46}
          fill="url(#ns-halo)"
        />

        {/* Зузаан ирмэг (3D мэдрэмж) — хилийг шилжүүлж хоёр давхар зурна */}
        <g transform={`translate(${dx * 1.6} ${-dy * 1.6})`} opacity="0.55">
          {shapes.map((s) => (
            <path key={`d2-${s.id}`} d={s.d} fill="#0a1c3f" stroke="none" />
          ))}
        </g>
        <g transform={`translate(${dx} ${-dy})`}>
          {shapes.map((s) => (
            <path key={`d-${s.id}`} d={s.d} fill="#123163" stroke="none" />
          ))}
        </g>

        {/* Нэгжүүд */}
        <g>
          {shapes.map((s) => {
            const isActive = s.id === activeId;
            const isHover = s.id === hover;
            return (
              <path
                key={s.id}
                d={s.d}
                fill={
                  isActive || isHover ? "#8ec5ff" : s.t < 0 ? EMPTY : mix(s.t)
                }
                fillOpacity={isActive ? 1 : isHover ? 0.95 : 0.82}
                stroke={isActive || isHover ? "#ffffff" : "#e2f0ff"}
                strokeOpacity={isActive || isHover ? 1 : 0.45}
                strokeWidth={(isActive || isHover ? 2.2 : 0.9) * (view.w / 900)}
                strokeLinejoin="round"
                filter={isHover || isActive ? "url(#ns-glow)" : undefined}
                onMouseEnter={() => enter(s)}
                onClick={() => onSelect?.(s)}
                style={{
                  cursor: "pointer",
                  transition: "fill 0.25s ease, fill-opacity 0.25s ease",
                }}
              />
            );
          })}
        </g>

        {/* Нэр + тоо */}
        <g style={{ pointerEvents: "none" }}>
          {shapes.map((s) => {
            if (!s.center) return null;
            const on = s.id === hover || s.id === activeId;
            const spot = labelled.get(s.id);
            if (!spot && !on) {
              const [dotX, dotY] = project(s.center[0], s.center[1]);
              return (
                <circle
                  key={`t-${s.id}`}
                  cx={dotX}
                  cy={dotY}
                  r={fs * 0.13}
                  fill="#ffffff"
                  fillOpacity={0.55}
                />
              );
            }
            const [cx, cy] = project(s.center[0], s.center[1]);
            const lx = spot ? spot.x : cx + fs * 0.35;
            const ly = spot ? spot.y : cy;
            const anchor = spot ? spot.anchor : "start";
            return (
              <g key={`t-${s.id}`} opacity={on ? 1 : 0.92}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={fs * 0.16}
                  fill="#ffffff"
                  fillOpacity={on ? 1 : 0.75}
                />
                <text
                  x={lx}
                  y={ly + fs * 0.12}
                  textAnchor={anchor}
                  fontSize={fs * 0.78}
                  fill="#eaf3ff"
                  style={{
                    paintOrder: "stroke",
                    stroke: "rgba(3,10,28,0.85)",
                    strokeWidth: fs * 0.16,
                    strokeLinejoin: "round",
                    fontWeight: 500,
                  }}
                >
                  {s.name}
                </text>
                <text
                  x={lx}
                  y={ly + fs * 0.98}
                  textAnchor={anchor}
                  fontSize={fs * 0.72}
                  fill={on ? "#ffffff" : "#8ec5ff"}
                  style={{
                    paintOrder: "stroke",
                    stroke: "rgba(3,10,28,0.85)",
                    strokeWidth: fs * 0.16,
                    strokeLinejoin: "round",
                    fontWeight: 700,
                  }}
                >
                  {fmt(s.count)}
                </text>
              </g>
            );
          })}
        </g>
      </Box>

      {/* Хулганы тайлбар */}
      {hovered && (
        <Box
          sx={{
            position: "absolute",
            left: Math.min(
              tip.x + 16,
              (wrapRef.current?.clientWidth || 0) - 190,
            ),
            top: Math.max(tip.y - 20, 8),
            px: 1.5,
            py: 1,
            minWidth: 160,
            borderRadius: 2,
            pointerEvents: "none",
            background: "rgba(6, 20, 48, 0.92)",
            border: "1px solid rgba(125, 211, 252, 0.35)",
            boxShadow: "0 18px 40px -12px rgba(2, 8, 30, 0.9)",
            backdropFilter: "blur(8px)",
            color: "#e2f0ff",
            zIndex: 3,
          }}
        >
          <Box sx={{ fontSize: 13, fontWeight: 700 }}>{hovered.name}</Box>
          <Box sx={{ fontSize: 18, fontWeight: 800, color: "#8ec5ff" }}>
            {fmt(hovered.count)}
          </Box>
          <Box sx={{ fontSize: 11, opacity: 0.7 }}>газар зүйн нэр</Box>
        </Box>
      )}
    </Box>
  );
}

MongoliaMap.propTypes = {
  units: PropTypes.array,
  bbox: PropTypes.array,
  activeId: PropTypes.number,
  onSelect: PropTypes.func,
  onHover: PropTypes.func,
  minRatio: PropTypes.number,
  maxRatio: PropTypes.number,
};
