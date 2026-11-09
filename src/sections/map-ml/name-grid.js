"use client";

// Нэр шалгах: загварын олсон нэр (nameqc_place) ба нэр болоогүй бичвэр (nameqc_text)-ийг карт бүрээр шалгана.
//  • Зураг дээр товшвол = тэмдгийн ЯГ төв (зөв байрлал, ногоон +). Товшоогүй бол байрлал хэвээр.
//  • Нэр: санал болгосон нэрээс сонгох, эсвэл хайж бичих. «Нэр биш» — бичвэр нэр биш (тоо, тайлбар …).
//  • Олсон нэрийн карт анхдагчаар «зөв» (загварын нэр); бичвэрийн карт сонгоогүй бол алгасна.
// Хадгалсан бүхэн → nameqc_namerev = дараагийн сургалтын цэвэр шошго (тэмдгийн төв + нэр-хүрээ).

import { useRef, useState, useEffect, useCallback } from "react";

import { Box, Chip, Stack, Button, TextField, Typography, Autocomplete, LinearProgress } from "@mui/material";

import { useSnackbar } from "src/components/snackbar";
import axiosInstance, { endpoints } from "src/utils/axios";

const GEOSERVER = process.env.NEXT_PUBLIC_GEOSERVER_URL;
const PAGE = 12;
const IMG = 520;

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

function extentOf(item) {
  const [x, y] = item.loc;
  let [x0, y0, x1, y1] = item.box || [x, y, x, y];
  x0 = Math.min(x0, x);
  y0 = Math.min(y0, y);
  x1 = Math.max(x1, x);
  y1 = Math.max(y1, y);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const half = Math.max(330, Math.max(x1 - x0, y1 - y0) / 2 + 220);
  return [cx - half, cy - half, cx + half, cy + half];
}

export function NameSearch({ tag, onPick, initial = "" }) {
  const [opts, setOpts] = useState([]);
  const [input, setInput] = useState(initial);
  useEffect(() => {
    if (input.trim().length < 2) {
      setOpts([]);
      return undefined;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await axiosInstance.get(endpoints.ml.nameRevNames(tag, input.trim()));
        setOpts(data);
      } catch (e) {
        setOpts([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [input, tag]);
  return (
    <Autocomplete
      size="small"
      freeSolo
      options={opts}
      filterOptions={(x) => x}
      getOptionLabel={(o) => (typeof o === "string" ? o : o.name)}
      renderOption={(props, o) => (
        <li {...props} key={o.id}>
          <Box>
            <Typography variant="body2">{o.name}</Typography>
            <Typography variant="caption" color={o.near ? "success.main" : "text.secondary"}>
              {o.type || "—"} · {o.units || "бүртгэлгүй"}
            </Typography>
          </Box>
        </li>
      )}
      inputValue={input}
      onInputChange={(e, v) => setInput(v)}
      onChange={(e, v) => {
        if (!v) return;
        if (typeof v === "string") onPick({ id: null, name: v.trim() });
        else onPick({ id: v.id, name: v.name });
      }}
      renderInput={(params) => <TextField {...params} placeholder="Зөв нэрийг хайх / бичих…" />}
    />
  );
}

function Card({ item, tag, st, onChange }) {
  const ex = extentOf(item);
  const W = ex[2] - ex[0];
  const pos = (p) => ({ left: `${((p[0] - ex[0]) / W) * 100}%`, top: `${((ex[3] - p[1]) / W) * 100}%` });
  const click = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    onChange({ pos: [ex[0] + fx * W, ex[3] - fy * W] });
  };
  const isText = item.kind === "text";
  const border =
    st.verdict === "notname" ? "#9e9e9e" : st.verdict === "skip" ? "#bdbdbd" : st.verdict === "fixed" ? "#fb8c00" : "#43a047";
  const box = item.box && {
    left: `${((item.box[0] - ex[0]) / W) * 100}%`,
    top: `${((ex[3] - item.box[3]) / W) * 100}%`,
    width: `${((item.box[2] - item.box[0]) / W) * 100}%`,
    height: `${((item.box[3] - item.box[1]) / W) * 100}%`,
  };
  return (
    <Box sx={{ border: `3px solid ${border}`, borderRadius: 1, overflow: "hidden", bgcolor: "background.paper" }}>
      <Box
        onClick={click}
        sx={{ position: "relative", width: "100%", aspectRatio: "1 / 1", bgcolor: "#eee", cursor: "crosshair", opacity: st.verdict === "notname" ? 0.5 : 1 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={wmsUrl(ex)} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        {box && <Box sx={{ position: "absolute", ...box, border: "2px dashed #43a047", pointerEvents: "none" }} />}
        {/* загварын байрлал */}
        <Box
          sx={{
            position: "absolute",
            ...pos(item.loc),
            width: 16,
            height: 16,
            ml: "-8px",
            mt: "-8px",
            borderRadius: "50%",
            border: "2.5px solid #e53935",
            pointerEvents: "none",
          }}
        />
        {st.pos && (
          <Box
            sx={{
              position: "absolute",
              ...pos(st.pos),
              width: 0,
              height: 0,
              pointerEvents: "none",
              "&::before, &::after": { content: '""', position: "absolute", bgcolor: "#00c853", boxShadow: "0 0 0 1px #fff" },
              "&::before": { left: -13, top: -1.5, width: 26, height: 3 },
              "&::after": { left: -1.5, top: -13, width: 3, height: 26 },
            }}
          />
        )}
        <Chip
          size="small"
          label={isText ? `Бичвэр: «${item.ocr}»` : `Олсон нэр${item.doubt ? " (эргэлзээтэй)" : ""}`}
          sx={{ position: "absolute", top: 4, left: 4, maxWidth: "95%", bgcolor: isText ? "#546e7a" : "#c62828", color: "#fff", pointerEvents: "none" }}
        />
      </Box>
      <Stack spacing={0.75} sx={{ p: 1 }}>
        <Stack direction="row" flexWrap="wrap" gap={0.5}>
          {item.cands.map((c) => {
            const sel = st.name === c.name && st.verdict !== "notname";
            return (
              <Chip
                key={`${c.id}-${c.name}`}
                size="small"
                label={c.name}
                color={sel ? "success" : "default"}
                variant={sel ? "filled" : "outlined"}
                onClick={() =>
                  onChange({
                    name: c.name,
                    geoname_id: c.id,
                    verdict: !isText && c.name === item.name ? "ok" : "fixed",
                  })
                }
              />
            );
          })}
        </Stack>
        <NameSearch tag={tag} onPick={(c) => onChange({ name: c.name, geoname_id: c.id, verdict: "fixed" })} />
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" sx={{ flex: 1 }} noWrap title={st.name || ""}>
            {st.verdict === "notname"
              ? "✗ нэр биш"
              : st.verdict === "skip"
                ? "— алгасна"
                : `✓ ${st.name}${st.pos ? " · байрлал заасан" : ""}`}
          </Typography>
          <Button
            size="small"
            color="inherit"
            onClick={() => onChange({ verdict: st.verdict === "notname" ? (isText ? "skip" : "ok") : "notname", ...(st.verdict === "notname" && !isText ? { name: item.name } : {}) })}
          >
            {st.verdict === "notname" ? "буцаах" : "Нэр биш"}
          </Button>
          {(st.pos || st.verdict !== (isText ? "skip" : "ok")) && (
            <Button size="small" color="inherit" onClick={() => onChange(null)}>
              цэвэрлэх
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}

const init = (it) =>
  it.kind === "place"
    ? { verdict: "ok", name: it.name, geoname_id: it.cands[0]?.id ?? null, pos: null }
    : { verdict: "skip", name: null, geoname_id: null, pos: null };

export default function NameGrid({ tag }) {
  const { enqueueSnackbar } = useSnackbar();
  const [kind, setKind] = useState("all");
  const [items, setItems] = useState(null);
  const [st, setSt] = useState({});
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef(null);
  const key = (it) => `${it.kind}:${it.id}`;

  const load = useCallback(async () => {
    if (!tag) return;
    setBusy(true);
    try {
      const [p, s] = await Promise.all([
        axiosInstance.get(endpoints.ml.nameRevPage(tag, PAGE, kind)),
        axiosInstance.get(endpoints.ml.nameRevStats(tag)),
      ]);
      setItems(p.data);
      setStats(s.data);
      setSt(Object.fromEntries(p.data.map((it) => [key(it), init(it)])));
      rootRef.current?.scrollTo({ top: 0 });
    } catch (e) {
      enqueueSnackbar("Ачаалж чадсангүй", { variant: "error" });
    } finally {
      setBusy(false);
    }
  }, [tag, kind, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = useCallback(async () => {
    if (busy || !items?.length) return;
    const list = items
      .map((it) => ({ it, s: st[key(it)] }))
      .filter(({ s }) => s && s.verdict !== "skip")
      .map(({ it, s }) => ({ kind: it.kind, id: it.id, verdict: s.verdict, name: s.name, geoname_id: s.geoname_id, pos: s.pos }));
    setBusy(true);
    try {
      if (list.length) await axiosInstance.post(endpoints.ml.nameRevBatch, { items: list });
      enqueueSnackbar(`Хадгаллаа: ${list.length}`, { variant: "success" });
      await load();
    } catch (e) {
      enqueueSnackbar("Хадгалж чадсангүй", { variant: "error" });
      setBusy(false);
    }
  }, [busy, items, st, load, enqueueSnackbar]);

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

  const change = (it) => (patch) =>
    setSt((s) => ({ ...s, [key(it)]: patch === null ? init(it) : { ...s[key(it)], ...patch } }));

  if (!tag) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>Зүүн самбарын «Нэр илрүүлсэн сум»-аас сум сонгоно уу.</Typography>
      </Box>
    );
  }
  return (
    <Box ref={rootRef} sx={{ position: "absolute", inset: 0, overflowY: "auto", bgcolor: "grey.100", p: 2 }}>
      {busy && <LinearProgress sx={{ position: "sticky", top: -16, mx: -2, mt: -2, mb: 2 }} />}
      <Typography variant="body2" sx={{ mb: 0.5 }}>
        <b>1. Тэмдгийн төв дээр товш</b> (ногоон +) — улаан дугуй буруу бол. <b>2. Нэр</b> — зөв нэрийг сонго эсвэл хайж
        бич; нэр биш бол «Нэр биш». Олсон нэрийн карт анхдагчаар зөв; бичвэрийн картад нэр сонгоогүй бол алгасна.{" "}
        <b>Enter</b> — хадгалаад дараагийнх.
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        {[
          ["all", "Бүгд"],
          ["place", "Олсон нэр"],
          ["text", "Нэр болоогүй бичвэр"],
        ].map(([k, l]) => (
          <Chip key={k} size="small" label={l} color={kind === k ? "primary" : "default"} onClick={() => setKind(k)} />
        ))}
        {stats && (
          <Typography variant="caption" color="text.secondary">
            Шалгасан: {stats.ok} зөв · {stats.fixed} зассан · {stats.notname} нэр биш · {stats.pos} байрлал заасан · үлдсэн{" "}
            {stats.todo}
          </Typography>
        )}
      </Stack>
      {items && items.length === 0 && <Typography sx={{ p: 4 }}>Шалгах зүйл алга.</Typography>}
      {items && items.length > 0 && (
        <>
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))" }}>
            {items.map((it) => (
              <Card key={key(it)} item={it} tag={tag} st={st[key(it)] || init(it)} onChange={change(it)} />
            ))}
          </Box>
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            justifyContent="flex-end"
            sx={{ position: "sticky", bottom: -16, mx: -2, mb: -2, mt: 2, p: 1.5, bgcolor: "background.paper", boxShadow: 3 }}
          >
            <Button size="large" variant="contained" color="success" disabled={busy} onClick={submit}>
              Хадгалаад дараагийнх (Enter)
            </Button>
          </Stack>
        </>
      )}
    </Box>
  );
}
