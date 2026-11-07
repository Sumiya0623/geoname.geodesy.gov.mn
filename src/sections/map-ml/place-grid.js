"use client";

// Байрлал шалгах: тэмдэг илрүүлэгч нэрийг тавьсан байрлал (улаан дугуй) зөв тэмдгийн төв дээр байна уу?
// Бүгд анхдагчаар «зөв»; зөвхөн буруу (үсэг, шугам, хоосон газар) картыг дарна → «энэ тэмдэг биш»
// сөрөг жишээ болж дараагийн загварт орно (nameqc_place.pos_ok).

import { useRef, useState, useEffect, useCallback } from "react";

import { Box, Chip, Stack, Button, Typography, LinearProgress } from "@mui/material";

import { useSnackbar } from "src/components/snackbar";
import axiosInstance, { endpoints } from "src/utils/axios";

const GEOSERVER = process.env.NEXT_PUBLIC_GEOSERVER_URL;
const PAGE = 30;
const IMG = 400;
const HALF = 235; // ref56 шалгалтын зурагтай ижил (≈ растерын ±60 px)

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

function Card({ item, bad, onToggle }) {
  const [cx, cy] = item.loc;
  const ex = [cx - HALF, cy - HALF, cx + HALF, cy + HALF];
  return (
    <Box
      onClick={onToggle}
      sx={{
        cursor: "pointer",
        border: bad ? "4px solid #e53935" : "2px solid #43a047",
        borderRadius: 1,
        overflow: "hidden",
        bgcolor: "background.paper",
        userSelect: "none",
      }}
    >
      <Box sx={{ position: "relative", width: "100%", aspectRatio: "1 / 1", bgcolor: "#eee" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={wmsUrl(ex)}
          alt=""
          loading="eager"
          draggable={false}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
        <Box
          sx={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 18,
            height: 18,
            ml: "-9px",
            mt: "-9px",
            borderRadius: "50%",
            border: "2.5px solid #e53935",
            pointerEvents: "none",
          }}
        />
        {bad && (
          <Chip size="small" color="error" label="✗ буруу" sx={{ position: "absolute", top: 6, right: 6, fontWeight: 700 }} />
        )}
      </Box>
      <Box sx={{ px: 1, py: 0.25 }}>
        <Typography variant="caption" noWrap component="div" title={item.name}>
          {item.name}
          <Typography component="span" variant="caption" color="text.secondary">
            {" "}
            · {item.type || "—"}
          </Typography>
        </Typography>
      </Box>
    </Box>
  );
}

export default function PlaceGrid() {
  const { enqueueSnackbar } = useSnackbar();
  const [items, setItems] = useState(null);
  const [bad, setBad] = useState({});
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [p, s] = await Promise.all([
        axiosInstance.get(endpoints.ml.placePage(PAGE)),
        axiosInstance.get(endpoints.ml.placeStats),
      ]);
      setItems(p.data);
      setStats(s.data);
      setBad({});
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

  const submit = useCallback(async () => {
    if (busy || !items?.length) return;
    const b = items.filter((it) => bad[it.id]).map((it) => it.id);
    const ok = items.filter((it) => !bad[it.id]).map((it) => it.id);
    setBusy(true);
    try {
      await axiosInstance.post(endpoints.ml.placeBatch, { ok, bad: b });
      enqueueSnackbar(`Хадгаллаа: ${ok.length} зөв · ${b.length} буруу`, { variant: "success" });
      await load();
    } catch (e) {
      enqueueSnackbar("Хадгалж чадсангүй", { variant: "error" });
      setBusy(false);
    }
  }, [busy, items, bad, load, enqueueSnackbar]);

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

  const nBad = Object.values(bad).filter(Boolean).length;
  return (
    <Box ref={rootRef} sx={{ position: "absolute", inset: 0, overflowY: "auto", bgcolor: "grey.100", p: 2 }}>
      {busy && <LinearProgress sx={{ position: "sticky", top: -16, mx: -2, mt: -2, mb: 2 }} />}
      <Typography variant="body2" sx={{ mb: 0.5 }}>
        <b>Улаан дугуй тэмдгийн (⊙ худаг, △, өндрийн цэг, овоо) төв дээр байна уу?</b> Бүгд анхдагчаар <b>зөв</b>.
        Үсэг, шугам, хоосон газар дээр буусан бол картыг <b>дарж «буруу»</b> болгоно. Дуусаад <b>Enter</b>.
      </Typography>
      {stats && (
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1.5 }}>
          Шалгасан: {stats.ok} зөв · {stats.bad} буруу · үлдсэн {stats.todo}
        </Typography>
      )}
      {items && items.length === 0 && <Typography sx={{ p: 4 }}>Шалгах байрлал алга.</Typography>}
      {items && items.length > 0 && (
        <>
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
            {items.map((it) => (
              <Card key={it.id} item={it} bad={!!bad[it.id]} onToggle={() => setBad((s) => ({ ...s, [it.id]: !s[it.id] }))} />
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
              {items.length - nBad} зөв · {nBad} буруу
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
