"use client";

// ---------------------------------------------------------------------------
// Нүүр хуудасны газар зүйн нэрийн статистик хэсэг.
//   • Монголын хилийн зураг дээр аймаг/нийслэл бүрийн нэрийн тоо
//   • Аймаг → сум/дүүрэг → баг/хороо гэж гурван шатаар задарна
//   • Сонгосон нутгийн нэрсийг ХАМГИЙН ДЭЭД ангиллаар (Байгаль / Хүний
//     бүтээсэн / Засаг захиргаа) зургийн дээд талд харуулна
// Өгөгдөл: /api/n/name-stat/ (нэвтрэлтгүй).
// ---------------------------------------------------------------------------

import { useMemo, useRef, useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

import { useGetNameFacts, useGetNameStat } from "src/api/geoname";
import Iconify from "src/components/iconify";

import CategoryCards from "./category-cards";
import CategoryPanel from "./category-panel";
import MongoliaMap from "./mongolia-map";

const fmt = (n) => new Intl.NumberFormat("mn-MN").format(n || 0);

// Задралын түвшин: 0 → аймаг, 1 → сум, 2 → баг
const LEVELS = ["аймаг / нийслэл", "сум / дүүрэг", "баг / хороо"];
const LEVEL_TITLE = ["Аймаг / Нийслэл", "Сум / Дүүрэг", "Баг / Хороо"];
const LEVEL_KEY = ["aimag", "sum", "bag"];
const MAX_DEPTH = LEVELS.length - 1;

// Доод талын шилдэг 3 нутгийн медаль
const MEDALS = [
  "linear-gradient(135deg, #fde68a, #f59e0b)",
  "linear-gradient(135deg, #e5e7eb, #9ca3af)",
  "linear-gradient(135deg, #fdba74, #c2703b)",
];

export default function NameStatSection() {
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up("md"));

  // Задарсан зам: [аймаг, сум] — элемент бүр нь тухайн нэгжийн бүтэн мөр
  const [path, setPath] = useState([]);
  const [sel, setSel] = useState(null); // самбарт харуулах нэгж (id)

  const parent = path.length ? path[path.length - 1] : null;
  const depth = path.length; // харагдаж буй нэгжүүдийн түвшин

  const { stat: root, statLoading } = useGetNameStat(null);
  const { stat: child } = useGetNameStat(parent?.id || null);
  // Онцлох нэрс: сонгосон нэгж → задарсан нутаг → бүх улс
  const { facts, factsLoading } = useGetNameFacts(sel || parent?.id || null);

  const data = parent ? child : root;

  // Шинэ түвшин ачаалагдтал өмнөхийг хэвээр үзүүлнэ (хоосон дэлгэц үзэгдэхгүй)
  const lastUnits = useRef([]);
  if (data?.units) lastUnits.current = data.units;
  const units = data?.units || lastUnits.current;

  // Улс даяарх дэд ангиллын нийлбэр (нэгжүүдийн задаргааг нэгтгэнэ)
  const countrySubs = useMemo(() => {
    const acc = {};
    (root?.units || []).forEach((u) =>
      Object.entries(u.subs || {}).forEach(([k, v]) => {
        acc[k] = (acc[k] || 0) + v;
      }),
    );
    return acc;
  }, [root]);

  // Дэд ангиллын нэрийн лавлах (улс + задарсан түвшнийхийг нэгтгэнэ)
  const subsMeta = useMemo(() => {
    const byId = {};
    [...(root?.subs || []), ...(child?.subs || [])].forEach((s) => {
      byId[s.id] = s;
    });
    return Object.values(byId);
  }, [root, child]);

  // Самбарын жижиг хураангуй: тухайн хэмжээнд ХАРЬЯА түвшний нэгжийн тоо +
  // нэрийн тоо (улсад → аймаг/нийслэл, аймагт → сум/дүүрэг, сумд → баг/хороо)
  const levelRow = useMemo(
    () => ({
      key: LEVEL_KEY[Math.min(depth, MAX_DEPTH)],
      name: LEVEL_TITLE[Math.min(depth, MAX_DEPTH)],
      units: units.length,
      names: units.reduce((acc, u) => acc + (u.count || 0), 0),
    }),
    [units, depth],
  );

  // Самбарт юу харуулах вэ: сонгосон нэгж → задарсан нутаг → бүх улс
  const panel = useMemo(() => {
    const selected = units.find((u) => u.id === sel);
    if (selected) {
      return {
        title: selected.name,
        subtitle: LEVELS[Math.min(depth, MAX_DEPTH)].toUpperCase(),
        total: selected.count,
        located: selected.located,
        unitId: selected.id,
        cats: selected.cats,
        subs: selected.subs,
      };
    }
    if (parent) {
      return {
        title: parent.name,
        subtitle: LEVELS[Math.min(depth - 1, MAX_DEPTH)].toUpperCase(),
        total: parent.count,
        located: parent.located,
        unitId: parent.id,
        cats: parent.cats,
        subs: parent.subs,
      };
    }
    return {
      title: "Монгол улс",
      subtitle: "УЛСЫН ДҮН",
      total: root?.total || 0,
      located: root?.located || 0,
      unitId: null,
      cats: Object.fromEntries((root?.roots || []).map((r) => [r.id, r.count])),
      subs: countrySubs,
    };
  }, [units, sel, parent, depth, root, countrySubs]);

  // Газрын зураг/жагсаалт дээр нэгж сонгох: гүн рүү задарна, хамгийн доод
  // түвшинд зөвхөн тэмдэглэнэ.
  const handleSelect = (unit) => {
    if (depth < MAX_DEPTH) {
      setPath((prev) => [...prev, unit]);
      setSel(null);
    } else {
      setSel((prev) => (prev === unit.id ? null : unit.id));
    }
  };

  const goTo = (index) => {
    setPath((prev) => prev.slice(0, index));
    setSel(null);
  };

  return (
    <Box sx={{ position: "relative", zIndex: 10, mb: 6 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Box
            sx={{
              position: "relative",
              borderRadius: 4,
              p: { xs: 1, md: 2 },
              border: "1px solid rgba(125, 211, 252, 0.18)",
              background:
                "linear-gradient(160deg, rgba(16, 38, 84, 0.35), rgba(6, 16, 40, 0.15))",
              backdropFilter: "blur(10px)",
            }}
          >
            {/* Хаана байгааг заасан мөр (Монгол улс › аймаг › сум) */}
            <Stack
              direction="row"
              alignItems="center"
              flexWrap="wrap"
              sx={{ px: 1, pt: 0.5, minHeight: 40 }}
            >
              {depth > 0 && (
                <Button
                  size="small"
                  onClick={() => goTo(0)}
                  startIcon={
                    <Iconify icon="solar:arrow-left-linear" width={16} />
                  }
                  sx={{
                    color: "#bfdbfe",
                    borderRadius: 2,
                    "&:hover": { background: "rgba(125,211,252,0.12)" },
                  }}
                >
                  Монгол улс
                </Button>
              )}
              {depth === 0 && (
                <Typography
                  sx={{ color: "#e2f0ff", fontWeight: 700, fontSize: 14 }}
                >
                  Монгол улс
                </Typography>
              )}
              {path.map((p, i) => {
                const last = i === path.length - 1;
                return (
                  <Stack key={p.id} direction="row" alignItems="center">
                    <Typography
                      sx={{ color: "rgba(226,240,255,0.35)", mx: 0.5 }}
                    >
                      ›
                    </Typography>
                    {last ? (
                      <Typography
                        sx={{ color: "#e2f0ff", fontWeight: 700, fontSize: 14 }}
                      >
                        {p.name}
                      </Typography>
                    ) : (
                      <Button
                        size="small"
                        onClick={() => goTo(i + 1)}
                        sx={{
                          minWidth: 0,
                          color: "#bfdbfe",
                          borderRadius: 2,
                          "&:hover": { background: "rgba(125,211,252,0.12)" },
                        }}
                      >
                        {p.name}
                      </Button>
                    )}
                  </Stack>
                );
              })}
              <Typography
                sx={{ color: "rgba(226,240,255,0.5)", fontSize: 12, ml: 1 }}
              >
                · {LEVELS[Math.min(depth, MAX_DEPTH)]}
              </Typography>
            </Stack>

            {/* Газрын зургийн ДЭЭД тал — нэрсийн үндсэн ангилал */}
            <CategoryCards
              total={panel.total}
              cats={panel.cats}
              subs={panel.subs}
              roots={root?.roots || []}
              subsMeta={subsMeta}
            />

            {statLoading || !root ? (
              <Skeleton
                variant="rounded"
                sx={{
                  bgcolor: "rgba(125,211,252,0.08)",
                  borderRadius: 3,
                  aspectRatio: mdUp ? 2.1 : 1.25,
                  width: 1,
                  height: "auto",
                }}
              />
            ) : (
              <MongoliaMap
                units={units}
                // Зурагдаж буй нэгжүүдийн нийт хүрээ (ачаалагдтал эцгийнхээр)
                bbox={
                  (parent ? child?.bbox || parent.bbox : root?.bbox) || null
                }
                activeId={sel}
                onSelect={handleSelect}
                minRatio={mdUp ? 1.5 : 0.85}
                maxRatio={mdUp ? 2.1 : 1.25}
              />
            )}

            {/* Газрын зургийн ДООД тал — хамгийн олон нэртэй 3 нутаг */}
            <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
              {units.slice(0, 3).map((u, i) => (
                <Grid item xs={12} sm={4} key={`${u.id}-${i}`}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1.25}
                    onClick={() => handleSelect(u)}
                    sx={{
                      p: 1.25,
                      borderRadius: 3,
                      cursor: "pointer",
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.04)",
                      transition: "all 0.3s ease",
                      "&:hover": {
                        borderColor: "rgba(125,211,252,0.55)",
                        background: "rgba(125,211,252,0.10)",
                        transform: "translateY(-2px)",
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 26,
                        height: 26,
                        flexShrink: 0,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 800,
                        color: "#071634",
                        background: MEDALS[i],
                      }}
                    >
                      {i + 1}
                    </Box>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          color: "#e9f2ff",
                          fontSize: 13.5,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {u.name}
                      </Typography>
                      <Typography
                        sx={{ color: "rgba(226,240,255,0.5)", fontSize: 11 }}
                      >
                        {LEVELS[Math.min(depth, MAX_DEPTH)]}
                      </Typography>
                    </Box>
                    <Typography
                      sx={{ color: "#8ec5ff", fontSize: 15, fontWeight: 800 }}
                    >
                      {fmt(u.count)}
                    </Typography>
                  </Stack>
                </Grid>
              ))}
            </Grid>

            <Typography
              sx={{
                mt: 1.5,
                mb: 0.5,
                textAlign: "center",
                color: "rgba(226,240,255,0.55)",
                fontSize: 12.5,
              }}
            >
              {depth === MAX_DEPTH
                ? "Баг, хорооны түвшинд зөвхөн байршил (координат) бүхий нэрс тоологдоно"
                : "Нутаг дэвсгэр дээр дарж аймаг, нийслэл, сум, дүүрэг, баг, хорооны нэрийн тоог ангиллаар нь үзнэ үү"}
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} md={4}>
          <CategoryPanel
            title={panel.title}
            subtitle={panel.subtitle}
            total={panel.total}
            located={panel.located}
            unitId={panel.unitId}
            facts={facts}
            factsLoading={factsLoading}
            levels={units.length ? [levelRow] : []}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
