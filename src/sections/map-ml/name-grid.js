"use client";

// Нэр шалгах: загварын олсон нэр (nameqc_place) ба нэр болоогүй бичвэр (nameqc_text)-ийг карт бүрээр шалгана.
//  • Зураг дээр товшвол = тэмдгийн ЯГ төв (зөв байрлал, ногоон +). Товшоогүй бол байрлал хэвээр.
//  • Нэр: санал болгосон нэрээс сонгох, эсвэл хайж бичих. «Нэр биш» — бичвэр нэр биш (тоо, тайлбар …).
//  • Олсон нэрийн карт анхдагчаар «зөв» (загварын нэр); бичвэрийн карт сонгоогүй бол алгасна.
//  • Жагсаалтад (бүртгэлд) байхгүй нэр → «Бүртгэлгүй» (алгасна, тодруулга үүсэхгүй).
//  • Шугам/талбайн нэр (гуу, жалга, ам …) → «Шугам» / «Талбай» товчоор зураг дээр цэг цэгээр зурна → тодруулгын геометр.
// Хадгалсан бүхэн → nameqc_namerev = дараагийн сургалтын цэвэр шошго (тэмдгийн төв + нэр-хүрээ).

import { useRef, useState, useEffect, useCallback } from "react";

import {
  Box,
  Chip,
  Stack,
  Button,
  TextField,
  Typography,
  Autocomplete,
  LinearProgress,
} from "@mui/material";

import { useSnackbar } from "src/components/snackbar";
import axiosInstance, { endpoints } from "src/utils/axios";

const GEOSERVER = process.env.NEXT_PUBLIC_GEOSERVER_URL;
const PAGE = 9; // 3×3
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
        const { data } = await axiosInstance.get(
          endpoints.ml.nameRevNames(tag, input.trim()),
        );
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
            <Typography
              variant="caption"
              color={o.near ? "success.main" : "text.secondary"}
            >
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
      renderInput={(params) => (
        <TextField {...params} placeholder="Зөв нэрийг хайх / бичих…" />
      )}
    />
  );
}

function Card({ item, tag, st, onChange }) {
  // харагдац: дугуйгаар томруулах/жижигрүүлэх, чирж хөдөлгөх; хөдөлгөөгүй товшилт = тэмдгийн төв
  const [ex, setEx] = useState(() => extentOf(item));
  const [drag, setDrag] = useState(null); // {x0, y0, dx, dy}
  const boxRef = useRef(null);
  const W = ex[2] - ex[0];
  const pos = (p) => ({
    left: `${((p[0] - ex[0]) / W) * 100}%`,
    top: `${((ex[3] - p[1]) / W) * 100}%`,
  });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const fx = (e.clientX - r.left) / r.width;
      const fy = (e.clientY - r.top) / r.height;
      setEx((o) => {
        const w = o[2] - o[0];
        const k = e.deltaY > 0 ? 1.25 : 0.8;
        const nw = Math.min(Math.max(w * k, 120), 6000);
        const mx = o[0] + fx * w;
        const my = o[3] - fy * w;
        return [
          mx - fx * nw,
          my - (1 - fy) * nw,
          mx + (1 - fx) * nw,
          my + fy * nw,
        ];
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  const down = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 });
  };
  const move = (e) => {
    if (drag)
      setDrag({ ...drag, dx: e.clientX - drag.x0, dy: e.clientY - drag.y0 });
  };
  const [drawing, setDrawing] = useState(null); // null | "line" | "area"
  const up = (e) => {
    if (!drag) return;
    const r = e.currentTarget.getBoundingClientRect();
    const { dx, dy } = drag;
    setDrag(null);
    if (Math.hypot(dx, dy) < 4) {
      const fx = (e.clientX - r.left) / r.width;
      const fy = (e.clientY - r.top) / r.height;
      const p = [ex[0] + fx * W, ex[3] - fy * W];
      if (drawing) {
        const pts = st.geom && st.geom.t === drawing ? st.geom.pts : [];
        onChange({ geom: { t: drawing, pts: [...pts, p] } });
      } else onChange({ pos: p });
      return;
    }
    const mx = (dx / r.width) * W;
    const my = (dy / r.height) * W;
    setEx((o) => [o[0] - mx, o[1] + my, o[2] - mx, o[3] + my]);
  };
  const isText = item.kind === "text";
  const border =
    st.verdict === "notname"
      ? "#9e9e9e"
      : st.verdict === "unreg"
        ? "#6d4c41"
        : st.verdict === "later"
          ? "#8e24aa"
          : st.verdict === "skip"
            ? "#bdbdbd"
            : st.verdict === "fixed"
              ? "#fb8c00"
              : "#43a047";
  const box = item.box && {
    left: `${((item.box[0] - ex[0]) / W) * 100}%`,
    top: `${((ex[3] - item.box[3]) / W) * 100}%`,
    width: `${((item.box[2] - item.box[0]) / W) * 100}%`,
    height: `${((item.box[3] - item.box[1]) / W) * 100}%`,
  };
  return (
    <Box
      sx={{
        border: `3px solid ${border}`,
        borderRadius: 1,
        overflow: "hidden",
        bgcolor: "background.paper",
      }}
    >
      <Box
        ref={boxRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          bgcolor: "#eee",
          overflow: "hidden",
          touchAction: "none",
          cursor:
            drag && Math.hypot(drag.dx, drag.dy) >= 4
              ? "grabbing"
              : drawing
                ? "copy"
                : "crosshair",
          opacity: st.verdict === "notname" ? 0.5 : 1,
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            transform: drag ? `translate(${drag.dx}px, ${drag.dy}px)` : "none",
            pointerEvents: "none",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={wmsUrl(ex)}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
            }}
          />
          {box && (
            <Box
              sx={{
                position: "absolute",
                ...box,
                border: "2px dashed #43a047",
                pointerEvents: "none",
              }}
            />
          )}
          {st.geom && st.geom.pts.length > 0 && (
            <svg
              viewBox={`0 0 ${W} ${W}`}
              preserveAspectRatio="none"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
              }}
            >
              {(() => {
                const pts = st.geom.pts
                  .map((p) => `${p[0] - ex[0]},${ex[3] - p[1]}`)
                  .join(" ");
                const sty = {
                  stroke: "#2962ff",
                  strokeWidth: 3,
                  vectorEffect: "non-scaling-stroke",
                };
                return st.geom.t === "area" ? (
                  <polygon points={pts} fill="rgba(41,98,255,0.18)" {...sty} />
                ) : (
                  <polyline points={pts} fill="none" {...sty} />
                );
              })()}
              {st.geom.pts.length <= 40 &&
                st.geom.pts.map((p, i) => (
                  <circle
                    key={i}
                    cx={p[0] - ex[0]}
                    cy={ex[3] - p[1]}
                    r={W / 120}
                    fill="#2962ff"
                  />
                ))}
            </svg>
          )}
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
                "&::before, &::after": {
                  content: '""',
                  position: "absolute",
                  bgcolor: "#00c853",
                  boxShadow: "0 0 0 1px #fff",
                },
                "&::before": { left: -13, top: -1.5, width: 26, height: 3 },
                "&::after": { left: -1.5, top: -13, width: 3, height: 26 },
              }}
            />
          )}
          <Chip
            size="small"
            label={
              isText
                ? `Бичвэр: «${item.ocr}»`
                : `Олсон нэр${item.doubt ? " (эргэлзээтэй)" : ""}`
            }
            sx={{
              position: "absolute",
              top: 4,
              left: 4,
              maxWidth: "95%",
              bgcolor: isText ? "#546e7a" : "#c62828",
              color: "#fff",
              pointerEvents: "none",
            }}
          />
        </Box>
        <Button
          size="small"
          variant="contained"
          color="inherit"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={() => setEx(extentOf(item))}
          sx={{
            position: "absolute",
            bottom: 4,
            right: 4,
            minWidth: 0,
            px: 1,
            py: 0,
            fontSize: 12,
            opacity: 0.85,
          }}
        >
          ↺
        </Button>
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
        <NameSearch
          tag={tag}
          onPick={(c) =>
            onChange({ name: c.name, geoname_id: c.id, verdict: "fixed" })
          }
        />
        <Typography variant="caption" noWrap title={st.name || ""}>
          {st.verdict === "notname"
            ? "✗ нэр биш"
            : st.verdict === "later"
              ? "⏭ алгасна (дахин гарахгүй)"
              : st.verdict === "unreg"
                ? `⊘ бүртгэлгүй — алгасна${st.name ? ` («${st.name}»)` : ""}`
                : st.verdict === "skip"
                  ? "— алгасна"
                  : `✓ ${st.name}${st.pos ? " · байрлал заасан" : ""}${
                      st.geom
                        ? ` · ${st.geom.t === "area" ? "талбай" : "шугам"} ${st.geom.pts.length} цэг`
                        : ""
                    }`}
        </Typography>
        {drawing ? (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="caption" color="primary" sx={{ flex: 1 }}>
              {drawing === "area" ? "Талбай" : "Шугам"}: зураг дээр цэг цэгээр
              товш
            </Typography>
            <Button
              size="small"
              color="inherit"
              disabled={!st.geom?.pts.length}
              onClick={() =>
                onChange({
                  geom:
                    st.geom.pts.length > 1
                      ? { ...st.geom, pts: st.geom.pts.slice(0, -1) }
                      : null,
                })
              }
            >
              ↶ цэг
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() => setDrawing(null)}
            >
              Дуусгах
            </Button>
          </Stack>
        ) : (
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            flexWrap="wrap"
          >
            <Button
              size="small"
              color="primary"
              onClick={() => {
                onChange({ geom: null });
                setDrawing("line");
              }}
            >
              Шугам
            </Button>
            <Button
              size="small"
              color="primary"
              onClick={() => {
                onChange({ geom: null });
                setDrawing("area");
              }}
            >
              Талбай
            </Button>
            <Button
              size="small"
              color="inherit"
              title="Нэр жагсаалтад (бүртгэлд) байхгүй — алгасна, тодруулга үүсэхгүй"
              onClick={() =>
                onChange({
                  verdict:
                    st.verdict === "unreg" ? (isText ? "skip" : "ok") : "unreg",
                  ...(st.verdict === "unreg" && !isText
                    ? { name: item.name }
                    : {}),
                })
              }
            >
              {st.verdict === "unreg" ? "буцаах" : "Бүртгэлгүй"}
            </Button>
            <Button
              size="small"
              color="inherit"
              onClick={() =>
                onChange({
                  verdict:
                    st.verdict === "notname"
                      ? isText
                        ? "skip"
                        : "ok"
                      : "notname",
                  ...(st.verdict === "notname" && !isText
                    ? { name: item.name }
                    : {}),
                })
              }
            >
              {st.verdict === "notname" ? "буцаах" : "Нэр биш"}
            </Button>
            <Button
              size="small"
              color="secondary"
              title="Хэт их зурах шаардлагатай, эсвэл эргэлзээтэй — алгасна (устахгүй, дахин гарахгүй, сургалтад «нэр биш» гэж орохгүй)"
              onClick={() => {
                setDrawing(null);
                onChange({
                  verdict:
                    st.verdict === "later" ? (isText ? "skip" : "ok") : "later",
                  geom: null,
                  ...(st.verdict === "later" && !isText
                    ? { name: item.name }
                    : {}),
                });
              }}
            >
              {st.verdict === "later" ? "буцаах" : "Алгасах"}
            </Button>
            {(st.pos || st.geom || st.verdict !== (isText ? "skip" : "ok")) && (
              <Button
                size="small"
                color="inherit"
                onClick={() => {
                  setDrawing(null);
                  onChange(null);
                }}
              >
                цэвэрлэх
              </Button>
            )}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

const init = (it) =>
  it.kind === "place"
    ? {
        verdict: "ok",
        name: it.name,
        geoname_id: it.cands[0]?.id ?? null,
        pos: null,
        // талбайн нэр (нуур): урьдчилан ялгасан цэнхэр дүүргэлтийн полигон — зөвшөөрөх эсвэл дахин зурна
        geom:
          it.shape && it.shape.length >= 3
            ? { t: "area", pts: it.shape }
            : null,
      }
    : { verdict: "skip", name: null, geoname_id: null, pos: null, geom: null };

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
      .map(({ it, s }) => ({
        kind: it.kind,
        id: it.id,
        verdict: s.verdict,
        name: s.name,
        geoname_id: s.geoname_id,
        pos: s.pos,
        geom:
          s.geom && s.geom.pts.length >= (s.geom.t === "area" ? 3 : 2)
            ? s.geom
            : null,
      }));
    setBusy(true);
    try {
      if (list.length)
        await axiosInstance.post(endpoints.ml.nameRevBatch, {
          items: list,
          recount: true,
        });
      enqueueSnackbar(`Хадгаллаа: ${list.length}`, { variant: "success" });
      await load();
    } catch (e) {
      enqueueSnackbar("Хадгалж чадсангүй", { variant: "error" });
      setBusy(false);
    }
  }, [busy, items, st, load, enqueueSnackbar]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA")
        return;
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit]);

  const change = (it) => (patch) =>
    setSt((s) => ({
      ...s,
      [key(it)]: patch === null ? init(it) : { ...s[key(it)], ...patch },
    }));

  if (!tag) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>
          Зүүн самбарын «Нэр илрүүлсэн сум»-аас сум сонгоно уу.
        </Typography>
      </Box>
    );
  }
  return (
    <Box
      ref={rootRef}
      sx={{
        position: "absolute",
        inset: 0,
        overflowY: "auto",
        bgcolor: "grey.100",
        p: 2,
      }}
    >
      {busy && (
        <LinearProgress
          sx={{ position: "sticky", top: -16, mx: -2, mt: -2, mb: 2 }}
        />
      )}
      <Typography variant="body2" sx={{ mb: 0.5 }}>
        <b>1. Тэмдгийн төв дээр товш</b> (ногоон +) — улаан дугуй буруу бол.{" "}
        <b>2. Нэр</b> — зөв нэрийг сонго эсвэл хайж бич; бүртгэлд байхгүй бол
        «Бүртгэлгүй», нэр биш бол «Нэр биш», хэт их зурах шаардлагатай бол
        «Алгасах». <b>3. Шугам/талбайн нэр</b> бол «Шугам» / «Талбай» дараад
        зураг дээр цэг цэгээр зур. Олсон нэрийн карт анхдагчаар зөв; бичвэрийн
        картад нэр сонгоогүй бол алгасна. <b>Enter</b> — хадгалаад дараагийнх.
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        {[
          ["all", "Бүгд"],
          ["place", "Олсон нэр"],
          ["text", "Нэр болоогүй бичвэр"],
        ].map(([k, l]) => (
          <Chip
            key={k}
            size="small"
            label={l}
            color={kind === k ? "primary" : "default"}
            onClick={() => setKind(k)}
          />
        ))}
        {stats && (
          <Typography variant="caption" color="text.secondary">
            Шалгасан: {stats.ok} зөв · {stats.fixed} зассан · {stats.notname}{" "}
            нэр биш · {stats.unreg || 0} бүртгэлгүй · {stats.shape || 0} зурсан
            · {stats.later || 0} алгассан · {stats.pos} байрлал заасан · үлдсэн{" "}
            {stats.todo}
          </Typography>
        )}
      </Stack>
      {items && items.length === 0 && (
        <Typography sx={{ p: 4 }}>Шалгах зүйл алга.</Typography>
      )}
      {items && items.length > 0 && (
        <>
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            }}
          >
            {items.map((it) => (
              <Card
                key={key(it)}
                item={it}
                tag={tag}
                st={st[key(it)] || init(it)}
                onChange={change(it)}
              />
            ))}
          </Box>
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            justifyContent="flex-end"
            sx={{
              position: "sticky",
              bottom: -16,
              mx: -2,
              mb: -2,
              mt: 2,
              p: 1.5,
              bgcolor: "background.paper",
              boxShadow: 3,
            }}
          >
            <Button
              size="large"
              variant="contained"
              color="success"
              disabled={busy}
              onClick={submit}
            >
              Хадгалаад дараагийнх (Enter)
            </Button>
          </Stack>
        </>
      )}
    </Box>
  );
}
