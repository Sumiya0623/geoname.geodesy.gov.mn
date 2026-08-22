"use client";

// ---------------------------------------------------------------------------
// Газрын зургийн ДЭЭД тал: сонгосон нутгийн нэрсийг ХАМГИЙН ДЭЭД ангиллаар
// (Байгаль / Хүний бүтээсэн / Засаг захиргаа) харуулна. Карт дээр дархад
// доод түвшний (Уул, Ус зүй, Суурьшил ...) задаргаа нээгдэнэ.
// ---------------------------------------------------------------------------

import PropTypes from "prop-types";
import { useState } from "react";

import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import Iconify from "src/components/iconify";

// Ангиллын код (GEONAME_TYPES-ийн үндсэн зангилаа) → өнгө, дүрс
const STYLE = {
  B: {
    color: "#34d399",
    glow: "rgba(52, 211, 153, 0.35)",
    icon: "mdi:terrain",
  },
  F: {
    color: "#fbbf24",
    glow: "rgba(251, 191, 36, 0.35)",
    icon: "solar:buildings-2-bold-duotone",
  },
  H: {
    color: "#60a5fa",
    glow: "rgba(96, 165, 250, 0.35)",
    icon: "solar:map-point-wave-bold-duotone",
  },
};
const FALLBACK = {
  color: "#a78bfa",
  glow: "rgba(167, 139, 250, 0.35)",
  icon: "solar:layers-bold-duotone",
};

const fmt = (n) => new Intl.NumberFormat("mn-MN").format(n || 0);

export default function CategoryCards({
  total = 0,
  cats = {},
  subs = {},
  roots = [],
  subsMeta = [],
}) {
  const [open, setOpen] = useState(null);

  const rows = roots
    .map((r) => ({
      ...r,
      value: cats?.[r.id] || cats?.[String(r.id)] || 0,
      style: STYLE[r.code] || FALLBACK,
    }))
    .sort((a, b) => b.value - a.value);

  const subsOf = (rootId) =>
    subsMeta
      .filter((s) => s.root === rootId)
      .map((s) => ({ ...s, value: subs?.[s.id] || subs?.[String(s.id)] || 0 }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

  return (
    <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
      {rows.map((r) => {
        const pct = total ? (r.value / total) * 100 : 0;
        const isOpen = open === r.id;
        return (
          <Grid item xs={12} sm={4} key={r.id}>
            <Box
              onClick={() => setOpen(isOpen ? null : r.id)}
              sx={{
                height: 1,
                p: 1.5,
                borderRadius: 3,
                cursor: "pointer",
                border: `1px solid ${isOpen ? r.style.color : "rgba(255,255,255,0.10)"}`,
                background: isOpen
                  ? `linear-gradient(135deg, ${r.style.glow}, rgba(255,255,255,0.02))`
                  : "rgba(255,255,255,0.04)",
                transition: "all 0.3s ease",
                "&:hover": {
                  borderColor: r.style.color,
                  transform: "translateY(-2px)",
                  boxShadow: `0 14px 30px -16px ${r.style.glow}`,
                },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.25}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    flexShrink: 0,
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: r.style.color,
                    background: r.style.glow,
                    border: `1px solid ${r.style.color}55`,
                  }}
                >
                  <Iconify icon={r.style.icon} width={20} />
                </Box>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="baseline"
                  >
                    <Typography
                      sx={{ color: "#e9f2ff", fontWeight: 600, fontSize: 13.5 }}
                    >
                      {r.name}
                    </Typography>
                    <Typography
                      sx={{
                        color: r.style.color,
                        fontWeight: 800,
                        fontSize: 15,
                      }}
                    >
                      {fmt(r.value)}
                    </Typography>
                  </Stack>
                  <Box
                    sx={{
                      mt: 0.7,
                      height: 5,
                      borderRadius: 3,
                      background: "rgba(255,255,255,0.08)",
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      sx={{
                        width: `${Math.max(pct, r.value ? 2 : 0)}%`,
                        height: 1,
                        borderRadius: 3,
                        background: `linear-gradient(90deg, ${r.style.color}, #ffffff88)`,
                        transition: "width 0.9s cubic-bezier(0.22, 1, 0.36, 1)",
                      }}
                    />
                  </Box>
                  <Typography
                    sx={{
                      mt: 0.4,
                      color: "rgba(226,240,255,0.5)",
                      fontSize: 10.5,
                    }}
                  >
                    {pct.toFixed(1)}% · дэлгэрэнгүйг харах
                  </Typography>
                </Box>
              </Stack>

              <Collapse in={isOpen} unmountOnExit>
                <Stack spacing={0.5} sx={{ mt: 1.25 }}>
                  {subsOf(r.id).length === 0 && (
                    <Typography
                      sx={{ color: "rgba(226,240,255,0.5)", fontSize: 12 }}
                    >
                      Задаргаа алга
                    </Typography>
                  )}
                  {subsOf(r.id).map((c) => (
                    <Stack
                      key={c.id}
                      direction="row"
                      justifyContent="space-between"
                      sx={{ fontSize: 12, color: "rgba(226,240,255,0.8)" }}
                    >
                      <span>{c.name}</span>
                      <b style={{ color: r.style.color }}>{fmt(c.value)}</b>
                    </Stack>
                  ))}
                </Stack>
              </Collapse>
            </Box>
          </Grid>
        );
      })}
    </Grid>
  );
}

CategoryCards.propTypes = {
  total: PropTypes.number,
  cats: PropTypes.object,
  subs: PropTypes.object,
  roots: PropTypes.array,
  subsMeta: PropTypes.array,
};
