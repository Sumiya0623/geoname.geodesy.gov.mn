"use client";

// Тэмдгийн төв: тодруулгын цэгэн нэр (худаг / толгой-уул / овоо) бүрийн газрын зургийн тэмдгийн
// ЯГ ТӨВ дээр нэг товшино → тэмдэг илрүүлэгчийн цэвэр шошго (nameqc_symcenter).
// Товшоогүй карт = алгасна (хадгалахгүй). «Тэмдэг алга» = энд тэмдэг байхгүй.
// Тайрц = raster:1970 WMS (EPSG:3857), тодруулгын цэгийг төвд нь.

import { useRef, useState, useEffect, useCallback } from "react";

import { Box, Chip, Stack, Button, Typography, LinearProgress } from "@mui/material";

import { useSnackbar } from "src/components/snackbar";
import axiosInstance, { endpoints } from "src/utils/axios";

const GEOSERVER = process.env.NEXT_PUBLIC_GEOSERVER_URL;
const PAGE = 24;
const IMG = 400; // WMS тайрцын px
const HALF = 235; // тайрцын хагас өргөн (EPSG:3857 м) ≈ растерын ±60 px — тэмдэг ≈ 50 px

const CLS = {
  well: { label: "Худаг / булаг", color: "#1e88e5", hint: "⊙ цагирагийн төв" },
  peak: { label: "Толгой / уул", color: "#8d6e63", hint: "△ эсвэл өндрийн цэг" },
  ovoo: { label: "Овоо", color: "#6d4c41", hint: "овооны тэмдгийн төв" },
};

function wmsUrl(ex) {
  const q = new URLSearchParams({
    service: "WMS",
    version: "1.1.1",
    request: "GetMap",
    layers: "raster:1970",
    styles: "",
    srs: "EPSG:3857",
    bbox: ex.join(","),
    width: String(IMG),
    height: String(IMG),
    format: "image/jpeg",
  });
  return `${GEOSERVER}/raster/wms?${q}`;
}

function Card({ item, mark, onMark }) {
  const [cx, cy] = item.loc;
  const ex = [cx - HALF, cy - HALF, cx + HALF, cy + HALF];
  const c = CLS[item.cls] || CLS.peak;
  const none = mark === "none";
  const pt = mark && mark !== "none" ? mark : null;

  const click = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    onMark({ x: ex[0] + fx * 2 * HALF, y: ex[3] - fy * 2 * HALF });
  };
  const pos = (p) => ({ left: `${((p.x - ex[0]) / (2 * HALF)) * 100}%`, top: `${((ex[3] - p.y) / (2 * HALF)) * 100}%` });

  return (
    <Box
      sx={{
        border: pt ? "3px solid #43a047" : none ? "3px solid #9e9e9e" : "3px solid transparent",
        borderRadius: 1,
        overflow: "hidden",
        bgcolor: "background.paper",
        opacity: none ? 0.5 : 1,
        userSelect: "none",
      }}
    >
      <Box
        onClick={click}
        sx={{ position: "relative", width: "100%", aspectRatio: "1 / 1", bgcolor: "#eee", cursor: "crosshair" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={wmsUrl(ex)}
          alt=""
          loading="eager"
          draggable={false}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
        {/* тодруулгын цэг (зөвлөмж) — жижиг улбар шар */}
        <Box
          sx={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 8,
            height: 8,
            ml: "-4px",
            mt: "-4px",
            borderRadius: "50%",
            border: "2px solid #fb8c00",
            pointerEvents: "none",
          }}
        />
        {pt && (
          <Box
            sx={{
              position: "absolute",
              ...pos(pt),
              width: 0,
              height: 0,
              pointerEvents: "none",
              "&::before, &::after": {
                content: '""',
                position: "absolute",
                bgcolor: "#00c853",
                boxShadow: "0 0 0 1px #fff",
              },
              "&::before": { left: -12, top: -1.5, width: 24, height: 3 },
              "&::after": { left: -1.5, top: -12, width: 3, height: 24 },
            }}
          />
        )}
        <Chip
          size="small"
          label={c.label}
          sx={{ position: "absolute", top: 4, left: 4, bgcolor: c.color, color: "#fff", fontWeight: 700, pointerEvents: "none" }}
        />
      </Box>
      <Stack direction="row" alignItems="center" sx={{ px: 1, py: 0.25 }} spacing={0.5}>
        <Typography variant="caption" noWrap title={item.name} sx={{ flex: 1 }}>
          {item.name}
        </Typography>
        <Button
          size="small"
          color={none ? "inherit" : "secondary"}
          sx={{ minWidth: 0, px: 0.75, fontSize: 11 }}
          onClick={() => onMark(none ? null : "none")}
        >
          {none ? "буцаах" : "тэмдэг алга"}
        </Button>
      </Stack>
    </Box>
  );
}

export default function SymGrid() {
  const { enqueueSnackbar } = useSnackbar();
  const [items, setItems] = useState(null);
  const [marks, setMarks] = useState({});
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [p, s] = await Promise.all([
        axiosInstance.get(endpoints.ml.symPage(PAGE)),
        axiosInstance.get(endpoints.ml.symStats),
      ]);
      setItems(p.data);
      setStats(s.data);
      setMarks({});
      rootRef.current?.scrollTo({ top: 0 });
    } catch (e) {
      enqueueSnackbar("Ачаалж чадсангүй", { variant: "error" });
    } finally {
      setBusy(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const placed = Object.values(marks).filter((m) => m && m !== "none").length;
  const nNone = Object.values(marks).filter((m) => m === "none").length;

  const submit = useCallback(async () => {
    if (busy || !items?.length) return;
    const list = Object.entries(marks).filter(([, m]) => m && m !== "none");
    const none = Object.entries(marks)
      .filter(([, m]) => m === "none")
      .map(([id]) => Number(id));
    if (!list.length && !none.length) {
      await load(); // юу ч тэмдэглээгүй бол дараагийн хуудас
      return;
    }
    setBusy(true);
    try {
      await axiosInstance.post(endpoints.ml.symBatch, {
        items: list.map(([id, m]) => ({ recount_id: Number(id), x: m.x, y: m.y })),
        none,
      });
      enqueueSnackbar(`Хадгаллаа: ${list.length} төв · ${none.length} тэмдэггүй`, { variant: "success" });
      await load();
    } catch (e) {
      enqueueSnackbar("Хадгалж чадсангүй", { variant: "error" });
      setBusy(false);
    }
  }, [busy, items, marks, load, enqueueSnackbar]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA") return;
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit]);

  const goal = 300;
  return (
    <Box ref={rootRef} sx={{ position: "absolute", inset: 0, overflowY: "auto", bgcolor: "grey.100", p: 2 }}>
      {busy && <LinearProgress sx={{ position: "sticky", top: -16, mx: -2, mt: -2, mb: 2 }} />}
      <Typography variant="body2" sx={{ mb: 0.5 }}>
        <b>Тэмдгийн яг төв дээр нэг товшино</b> (ногоон +). Буруу бол дахин товшиж зөөнө.
        Худаг = ⊙ цагирагийн төв · Толгой/уул = △ эсвэл өндрийн цэг · Овоо = овооны тэмдэг.
        Тэмдэг харагдахгүй бол «тэмдэг алга», эргэлзвэл зүгээр орхи (алгасна). Дуусаад <b>Enter</b>.
      </Typography>
      {stats && (
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1.5 }}>
          Тавьсан: <b>{stats.done}</b> / {goal} зорилт (худаг {stats.by_cls?.well || 0} · толгой{" "}
          {stats.by_cls?.peak || 0} · овоо {stats.by_cls?.ovoo || 0}) · тэмдэггүй {stats.none}
          {stats.done >= goal && (
            <b style={{ color: "#2e7d32" }}> — ✓ зорилт биелсэн, цааш хийх шаардлагагүй (нэмбэл зөвхөн овоо, худаг тус болно)</b>
          )}
        </Typography>
      )}
      {items && items.length === 0 && <Typography sx={{ p: 4 }}>Бүх цэгийг тавьж дууссан.</Typography>}
      {items && items.length > 0 && (
        <>
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {items.map((it) => (
              <Card
                key={it.recount_id}
                item={it}
                mark={marks[it.recount_id]}
                onMark={(m) => setMarks((s) => ({ ...s, [it.recount_id]: m }))}
              />
            ))}
          </Box>
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            justifyContent="flex-end"
            sx={{ position: "sticky", bottom: -16, mx: -2, mb: -2, mt: 2, p: 1.5, bgcolor: "background.paper", boxShadow: 3 }}
          >
            <Typography variant="body2">
              {placed} төв · {nNone} тэмдэггүй · {items.length - placed - nNone} алгасах
            </Typography>
            <Button size="large" variant="contained" color="success" disabled={busy} onClick={submit}>
              Хадгалаад дараагийнх (Enter)
            </Button>
          </Stack>
        </>
      )}
    </Box>
  );
}
