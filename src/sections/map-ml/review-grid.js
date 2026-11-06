"use client";

// Хүснэгтэн шалгалт: олон автомат шошгыг нэг дор харуулна. Бүгд анхдагчаар «зөв»;
// хэрэглэгч зөвхөн буруу (эсвэл мэдэхгүй) картыг дарж тэмдэглээд «Хуудсыг батлах».
// Тайрц = raster:1970 WMS (EPSG:3857, гажилтгүй), дээр нь хүрээг SVG-ээр зурна.

import { useRef, useState, useEffect, useCallback } from "react";

import { Box, Chip, Stack, Button, Typography, LinearProgress } from "@mui/material";

import { useSnackbar } from "src/components/snackbar";
import axiosInstance, { endpoints } from "src/utils/axios";

const GEOSERVER = process.env.NEXT_PUBLIC_GEOSERVER_URL;
const PAGE = 24;
const IMG_W = 420;
const IMG_H = 180; // карт бүрийн тайрцын харьцаа (IMG_W:IMG_H)

// карт: ok (анхдагч) → bad → skip → ok
const NEXT = { ok: "bad", bad: "skip", skip: "ok" };
const LOOK = {
  ok: { border: "2px solid #43a047", label: "✓ зөв", color: "success" },
  bad: { border: "4px solid #e53935", label: "✗ буруу", color: "error" },
  skip: { border: "2px dashed #9e9e9e", label: "? алгасах", color: "default" },
};

// Хүрээний эргэн тойрон зай нэмж, картын харьцаанд тааруулна (метр, EPSG:3857)
function cropExtent([x0, y0, x1, y1]) {
  const w = x1 - x0;
  const h = y1 - y0;
  const pad = Math.max(w, h) * 0.2 + 120;
  let ex = [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
  const ew = ex[2] - ex[0];
  const eh = ex[3] - ex[1];
  const want = IMG_W / IMG_H;
  if (ew / eh < want) {
    const d = (eh * want - ew) / 2;
    ex = [ex[0] - d, ex[1], ex[2] + d, ex[3]];
  } else {
    const d = (ew / want - eh) / 2;
    ex = [ex[0], ex[1] - d, ex[2], ex[3] + d];
  }
  return ex;
}

function wmsUrl(ex) {
  const q = new URLSearchParams({
    service: "WMS",
    version: "1.1.1",
    request: "GetMap",
    layers: "raster:1970",
    styles: "",
    srs: "EPSG:3857",
    bbox: ex.join(","),
    width: String(IMG_W),
    height: String(IMG_H),
    format: "image/jpeg",
  });
  return `${GEOSERVER}/raster/wms?${q}`;
}

function Card({ item, state, onToggle }) {
  const ex = cropExtent(item.bbox);
  const [w, h] = [ex[2] - ex[0], ex[3] - ex[1]];
  const look = LOOK[state];
  const [lx, ly] = item.loc;
  const locInside = lx >= ex[0] && lx <= ex[2] && ly >= ex[1] && ly <= ex[3];
  return (
    <Box
      onClick={onToggle}
      sx={{
        cursor: "pointer",
        border: look.border,
        borderRadius: 1,
        overflow: "hidden",
        bgcolor: "background.paper",
        opacity: state === "skip" ? 0.55 : 1,
        userSelect: "none",
      }}
    >
      <Box sx={{ position: "relative", width: "100%", aspectRatio: `${IMG_W} / ${IMG_H}`, bgcolor: "#eee" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={wmsUrl(ex)}
          alt=""
          loading="eager"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          draggable={false}
        />
        <svg
          viewBox={`${ex[0]} ${-ex[3]} ${w} ${h}`}
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          {item.boxes.map((ring, i) => (
            <polygon
              key={i}
              points={ring.map(([x, y]) => `${x},${-y}`).join(" ")}
              fill="none"
              stroke="#ffd600"
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {locInside && (
            <circle cx={lx} cy={-ly} r={w / 70} fill="#e53935" stroke="#fff" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {state !== "ok" && (
          <Chip
            size="small"
            color={look.color}
            label={look.label}
            sx={{ position: "absolute", top: 6, right: 6, fontWeight: 700 }}
          />
        )}
      </Box>
      <Box sx={{ px: 1, py: 0.5 }}>
        <Typography variant="subtitle2" noWrap title={item.name}>
          {item.name}
          <Typography component="span" variant="caption" color="text.secondary">
            {" "}
            · {item.type || "—"}
          </Typography>
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="div" title={item.ocr.join(" / ")}>
          уншсан: {item.ocr.join(" / ") || "—"}
        </Typography>
      </Box>
    </Box>
  );
}

export default function ReviewGrid({ onSaved }) {
  const { enqueueSnackbar } = useSnackbar();
  const [items, setItems] = useState(null);
  const [state, setState] = useState({});
  const [busy, setBusy] = useState(false);
  const rootRef = useRef(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const { data } = await axiosInstance.get(endpoints.ml.reviewPage(PAGE));
      setItems(data);
      setState(Object.fromEntries(data.map((it) => [it.recount_id, "ok"])));
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

  const counts = Object.values(state).reduce((a, s) => ({ ...a, [s]: (a[s] || 0) + 1 }), {});

  const submit = useCallback(async () => {
    if (busy || !items?.length) return;
    const ok = items.filter((it) => state[it.recount_id] === "ok").map((it) => it.recount_id);
    const bad = items.filter((it) => state[it.recount_id] === "bad").map((it) => it.recount_id);
    setBusy(true);
    try {
      await axiosInstance.post(endpoints.ml.reviewBatch, { ok, bad });
      enqueueSnackbar(`Хадгаллаа: ${ok.length} зөв · ${bad.length} буруу`, { variant: "success" });
      onSaved?.();
      await load();
    } catch (e) {
      enqueueSnackbar("Хадгалж чадсангүй", { variant: "error" });
      setBusy(false);
    }
  }, [busy, items, state, load, onSaved, enqueueSnackbar]);

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

  return (
    <Box ref={rootRef} sx={{ position: "absolute", inset: 0, overflowY: "auto", bgcolor: "grey.100", p: 2 }}>
      {busy && <LinearProgress sx={{ position: "sticky", top: -16, mx: -2, mt: -2, mb: 2 }} />}
      {items && items.length === 0 && <Typography sx={{ p: 4 }}>Шалгах автомат шошго алга.</Typography>}
      {items && items.length > 0 && (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Шар хүрээнд доор бичсэн нэр байна уу? Бүгд анхдагчаар <b>зөв</b>. Зөвхөн <b>буруу</b>-г дарна уу (дахин
            дарвал «алгасах», гурав дахь удаад буцаад «зөв»). Дуусаад <b>Enter</b> эсвэл доорх товч.
          </Typography>
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            }}
          >
            {items.map((it) => (
              <Card
                key={it.recount_id}
                item={it}
                state={state[it.recount_id] || "ok"}
                onToggle={() => setState((s) => ({ ...s, [it.recount_id]: NEXT[s[it.recount_id] || "ok"] }))}
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
              {counts.ok || 0} зөв · {counts.bad || 0} буруу · {counts.skip || 0} алгасах
            </Typography>
            <Button size="large" variant="contained" color="success" disabled={busy} onClick={submit}>
              Хуудсыг батлах (Enter)
            </Button>
          </Stack>
        </>
      )}
    </Box>
  );
}
