"use client";

// ---------------------------------------------------------------------------
// Баруун талын самбар: сонгосон нутгийн нэр + нийт тоо, доор нь тухайн нутгийн
// онцлох нэрс (хамгийн их давтагдсан / урт / богино).
// ---------------------------------------------------------------------------

import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import Iconify from "src/components/iconify";

import NameFacts from "./name-facts";

// Түвшний дүрс: аймаг/нийслэл → сум/дүүрэг → баг/хороо
const LEVEL_ICON = {
  aimag: "solar:map-bold-duotone",
  sum: "solar:streets-map-point-bold-duotone",
  bag: "solar:buildings-3-bold-duotone",
};

const fmt = (n) => new Intl.NumberFormat("mn-MN").format(n || 0);

// Тоог зөөлөн өсгөж харуулах
function useCountUp(value = 0, duration = 900) {
  const [shown, setShown] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const from = 0;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / duration);
      setShown(Math.round(from + (value - from) * (1 - (1 - k) ** 3)));
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);
  return shown;
}

export default function CategoryPanel({
  title,
  subtitle,
  total = 0,
  located = 0,
  unitId = null,
  facts,
  factsLoading = false,
  levels = [],
}) {
  const shown = useCountUp(total);

  // Газрын зураг руу зөвхөн ТОДРУУЛСАН нэр бүхий ТОДОРХОЙ нэгжээс шилжинэ
  const canOpenMap = Boolean(unitId) && located > 0;
  const mapTip = !unitId
    ? "Газрын зураг дээр харахын тулд эхлээд нутаг дэвсгэр (аймаг, сум, баг) сонгоно уу"
    : located > 0
      ? `${title} — тодруулсан ${fmt(located)} нэрийг газрын зураг дээр харах`
      : `${title}: тодруулалт хийгдээгүй тул газрын зураг дээр харуулах нэр алга`;

  return (
    <Box
      sx={{
        height: 1,
        p: { xs: 2, md: 3 },
        borderRadius: 4,
        border: "1px solid rgba(125, 211, 252, 0.22)",
        background:
          "linear-gradient(160deg, rgba(20, 45, 95, 0.55), rgba(8, 20, 48, 0.35))",
        backdropFilter: "blur(14px)",
        boxShadow: "0 30px 60px -30px rgba(2, 8, 30, 0.9)",
      }}
    >
      <Typography
        sx={{
          color: "rgba(226,240,255,0.6)",
          fontSize: 12,
          letterSpacing: 1.5,
        }}
      >
        {subtitle}
      </Typography>
      <Typography
        sx={{
          color: "#ffffff",
          fontWeight: 700,
          fontSize: 24,
          lineHeight: 1.2,
        }}
      >
        {title}
      </Typography>

      {/* Зүүн талд том тоо, баруун талд түвшний хураангуй (жижиг, нэг баганад) */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={2}
        sx={{ mt: 1.5, mb: 2.5 }}
      >
        <Box sx={{ flexShrink: 0 }}>
          <Typography
            sx={{
              fontSize: 38,
              fontWeight: 800,
              lineHeight: 1,
              background: "linear-gradient(135deg, #ffffff, #7dd3fc)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            {fmt(shown)}
          </Typography>
        </Box>

        {levels.length > 0 && (
          <Stack spacing={0.35} sx={{ flexGrow: 1, minWidth: 0 }}>
            {levels.map((lv) => (
              <Stack
                key={lv.key}
                direction="row"
                alignItems="center"
                spacing={0.75}
              >
                <Iconify
                  icon={LEVEL_ICON[lv.key] || "solar:map-bold-duotone"}
                  width={13}
                  sx={{ color: "#7dd3fc", flexShrink: 0, opacity: 0.9 }}
                />
                <Typography
                  noWrap
                  sx={{
                    flexGrow: 1,
                    color: "rgba(226,240,255,0.7)",
                    fontSize: 10.5,
                  }}
                >
                  {lv.name}
                  {lv.units > 1 && (
                    <Box
                      component="span"
                      sx={{ ml: 0.5, color: "rgba(226,240,255,0.4)" }}
                    >
                      ({fmt(lv.units)})
                    </Box>
                  )}
                </Typography>
                <Typography
                  sx={{ color: "#8ec5ff", fontSize: 11.5, fontWeight: 700 }}
                >
                  {fmt(lv.names)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>

      {/* Тодруулсан = байршил (координат) бүхий нэр */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        {[
          {
            label: "Тодруулсан",
            value: located,
            color: "#34d399",
            bg: "rgba(52, 211, 153, 0.14)",
            icon: "solar:map-point-favourite-bold-duotone",
          },
          {
            label: "Тодруулаагүй",
            value: Math.max(0, total - located),
            color: "#94a3b8",
            bg: "rgba(148, 163, 184, 0.12)",
            icon: "solar:map-point-remove-bold-duotone",
          },
        ].map((c) => (
          <Stack
            key={c.label}
            direction="row"
            alignItems="center"
            spacing={0.6}
            sx={{
              px: 1,
              py: 0.5,
              borderRadius: 5,
              background: c.bg,
              border: `1px solid ${c.color}44`,
            }}
          >
            <Iconify icon={c.icon} width={14} sx={{ color: c.color }} />
            <Typography sx={{ color: "rgba(226,240,255,0.75)", fontSize: 11 }}>
              {c.label}
            </Typography>
            <Typography sx={{ color: c.color, fontSize: 12, fontWeight: 800 }}>
              {fmt(c.value)}
            </Typography>
          </Stack>
        ))}

        <Box sx={{ flexGrow: 1 }} />

        {/* Газрын зураг руу шилжих — зөвхөн тодруулсан нэртэй үед */}
        <Tooltip
          title={mapTip}
          placement="top"
          arrow
          enterTouchDelay={0}
          componentsProps={{
            tooltip: {
              sx: {
                background: "rgba(6, 20, 48, 0.96)",
                border: "1px solid rgba(125, 211, 252, 0.35)",
                color: "#e2f0ff",
                fontSize: 12.5,
                maxWidth: 280,
                px: 1.25,
                py: 0.75,
              },
            },
            arrow: { sx: { color: "rgba(6, 20, 48, 0.96)" } },
          }}
        >
          {/* disabled товч tooltip‑гүй болдог тул span‑аар ороов */}
          <Box component="span">
            <IconButton
              disabled={!canOpenMap}
              href={
                canOpenMap
                  ? `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/dashboard/map?unit=${unitId}`
                  : undefined
              }
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2.5,
                color: "#071634",
                background: "linear-gradient(135deg, #7dd3fc, #38bdf8)",
                boxShadow: "0 10px 24px -10px rgba(56,189,248,0.9)",
                transition: "all 0.3s ease",
                "&:hover": {
                  background: "linear-gradient(135deg, #bae6fd, #38bdf8)",
                  transform: "translateY(-2px) scale(1.05)",
                },
                "&.Mui-disabled": {
                  color: "rgba(226,240,255,0.35)",
                  background: "rgba(148,163,184,0.14)",
                  border: "1px solid rgba(148,163,184,0.25)",
                  boxShadow: "none",
                },
              }}
            >
              <Iconify
                icon={
                  located
                    ? "solar:map-bold-duotone"
                    : "solar:lock-keyhole-bold-duotone"
                }
                width={24}
              />
            </IconButton>
          </Box>
        </Tooltip>
      </Stack>

      <NameFacts facts={facts} loading={factsLoading} columns={1} />
    </Box>
  );
}

CategoryPanel.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  total: PropTypes.number,
  located: PropTypes.number,
  unitId: PropTypes.number,
  facts: PropTypes.object,
  factsLoading: PropTypes.bool,
  levels: PropTypes.array,
};
