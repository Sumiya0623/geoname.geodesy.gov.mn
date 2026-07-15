"use client";

import "geostyler/dist/index.css";

import PropTypes from "prop-types";
import { useRouter } from "next/navigation";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SldStyleParser from "geostyler-sld-parser";
import { LegendRenderer } from "geostyler-legend";
import { Style as GeoStylerStyle, CodeEditor, PreviewMap } from "geostyler";
import { useRef, useMemo, useState, useEffect, useCallback } from "react";

import {
  Box,
  Card,
  Stack,
  Alert,
  Button,
  Typography,
  ToggleButton,
  CircularProgress,
  ToggleButtonGroup,
} from "@mui/material";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useSnackbar } from "src/components/snackbar";

// crypto.randomUUID нь зөвхөн secure context (HTTPS/localhost)‑д байдаг. Сайт HTTP
// дээр ажиллаж байгаа тул GeoStyler‑т хэрэгтэй randomUUID‑г getRandomValues‑ээр
// polyfill хийнэ. HTTPS production дээр native байгаа тул энэ код огт ажиллахгүй.
if (
  typeof window !== "undefined" &&
  window.crypto &&
  typeof window.crypto.randomUUID !== "function"
) {
  window.crypto.randomUUID = () =>
    "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
      (
        c ^
        (window.crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
      ).toString(16),
    );
}

// geostyler-legend‑ийн LegendRenderer‑ийг React‑т багтаасан жижиг wrapper.
function GeoStylerLegend({ gsStyle }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !gsStyle) return;
    node.innerHTML = "";
    try {
      const renderer = new LegendRenderer({
        maxColumnWidth: 320,
        maxColumnHeight: 600,
        overflow: "auto",
        styles: [gsStyle],
        hideRect: true,
        size: [340, 600],
      });
      renderer.render(node);
    } catch (e) {
      node.textContent = "Legend үүсгэхэд алдаа гарлаа";
    }
  }, [gsStyle]);
  return <Box ref={ref} sx={{ minHeight: 200 }} />;
}

GeoStylerLegend.propTypes = { gsStyle: PropTypes.object };

// ----------------------------------------------------------------------
// GeoStyler дээр суурилсан style засагч (demo.geostyler.org‑тэй ижил). Зүүн талд
// Graphical Editor (Style), баруун талд Display (Split View = Code + Preview).
// ----------------------------------------------------------------------

export default function GeoStylerEditor({
  layerId,
  sldUrl,
  uploadUrl,
  title,
  belowEditor,
  hideSave = false,
  sldRef,
  onClose,
}) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  // SLD унших/бичих URL: workspace layer‑ийн хувьд props‑оор, geoname навчийн
  // хувьд nameclass endpoint (layerId)‑оор. Хоёулаа GET/PUT ижил URL хэрэглэнэ.
  const readUrl = sldUrl || (layerId ? endpoints.nameclass.sld(layerId) : null);
  const upUrl =
    uploadUrl || (layerId ? endpoints.nameclass.uploadSymbol(layerId) : null);
  // SLD 1.1.0 (SE) хэрэглэнэ. LineSymbolizer‑ийн `perpendicularOffset` (шугамыг
  // перпендикуляр чиглэлд зөөх) нь зөвхөн SE 1.1‑д байдаг — 1.0.0 үед бичсэн ч
  // GeoServer үл тоомсорлож, offset хадгалагдахгүй/харагдахгүй байсан. Уншихдаа
  // parser нь XML‑ээс хувилбарыг өөрөө таних тул хуучин 1.0 SLD‑үүд ачаалагдана.
  const parser = useMemo(() => new SldStyleParser({ sldVersion: "1.1.0" }), []);

  const [gsStyle, setGsStyle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [display, setDisplay] = useState("split"); // split | code | preview | legend
  const nameGuardRef = useRef(null); // Style нэрийн input‑ыг readonly болгоход
  // Ачаалал бүрд нэмэгдэнэ — Style‑г шинээр mount хийж ачаалсан утга (масштаб г.м.)
  // гарцаагүй харагдуулна (GeoStyler‑ийн дотоод эхний төлвийг шинэчилнэ).
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    if (!readUrl) return undefined;
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axiosInstance.get(readUrl);
        const sld = res?.data?.sld;
        const { output, errors } = await parser.readStyle(sld);
        if (!active) return;
        if (output) {
          setGsStyle(output);
          setLoadKey((k) => k + 1);
        } else {
          setError(errors?.[0]?.message || "SLD задлахад алдаа гарлаа");
        }
      } catch (e) {
        if (active) setError(e?.response?.data?.detail || e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [readUrl, parser]);

  // GeoStyler‑ийн Icon Source талбар дахь upload товч (patch‑аар нэмсэн) энэ
  // global handler‑ийг дуудна: файлыг backend media‑д хуулж absolute URL буцаана.
  // URL нь browser preview ба GeoServer rendering хоёуланд хүрнэ.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    window.__geostylerUploadImage = async (file) => {
      if (!upUrl) return "";
      const fd = new FormData();
      fd.append("file", file);
      const res = await axiosInstance.post(upUrl, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res?.data?.url || "";
    };
    return () => {
      delete window.__geostylerUploadImage;
    };
  }, [upUrl]);

  // Monaco editor болон OpenLayers map нь контейнерийн хэмжээ өөрчлөгдөхөд өөрөө
  // дахин хэмжихгүй (хоосон харагдана). Display солих бүрд resize event илгээж
  // дахин layout хийлгэнэ.
  useEffect(() => {
    const t = setTimeout(() => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("resize"));
      }
    }, 80);
    return () => clearTimeout(t);
  }, [display, loadKey]);

  // Style нэр = view нэр тул засагдах ёсгүй — input‑ыг readonly болгоно (CSS дээр
  // нэмж pointer-events:none). gsStyle/loadKey өөрчлөгдөх бүрд дахин тавина.
  useEffect(() => {
    const t = setTimeout(() => {
      const el = nameGuardRef.current?.querySelector(".gs-namefield");
      if (el) {
        el.setAttribute("readonly", "readonly");
        el.setAttribute("tabindex", "-1");
      }
    }, 120);
    return () => clearTimeout(t);
  }, [gsStyle, loadKey]);

  const handleSave = useCallback(async () => {
    if (!gsStyle) return;
    setSaving(true);
    try {
      const { output: sld, errors } = await parser.writeStyle(gsStyle);
      if (!sld) throw new Error(errors?.[0]?.message || "SLD үүсгэхэд алдаа");
      await axiosInstance.put(readUrl, { sld });
      enqueueSnackbar("Style амжилттай хадгалагдлаа", { variant: "success" });
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.detail || e.message, {
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }, [gsStyle, parser, readUrl, enqueueSnackbar]);

  // Одоогийн GeoStyler style‑ийн SLD‑г гаднаас авах (хил дагуу нэр хамт хадгалахад
  // base болгон ашиглана — rule засвар алдагдахгүй).
  useEffect(() => {
    if (!sldRef) return undefined;
    sldRef.current = async () => {
      if (!gsStyle) return null;
      try {
        const { output } = await parser.writeStyle(gsStyle);
        return output || null;
      } catch {
        return null;
      }
    };
    return () => {
      if (sldRef) sldRef.current = null;
    };
  }, [sldRef, gsStyle, parser]);

  if (loading) {
    return (
      <Box sx={{ py: 8, textAlign: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{String(error)}</Alert>;
  }

  const codeEditor = gsStyle && (
    <CodeEditor
      style={gsStyle}
      parsers={[parser]}
      defaultParser={parser}
      onStyleChange={setGsStyle}
      showCopyButton
      showSaveButton
    />
  );

  const previewMap = gsStyle && (
    <PreviewMap style={gsStyle} dataProjection="EPSG:4326" mapHeight={360} />
  );

  return (
    <Stack spacing={1}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={1}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<ArrowBackIcon />}
            onClick={() => {
              if (onClose) {
                onClose();
              } else {
                // Шинэ tab‑аар нээгдсэн тул tab‑ыг хаана; үгүй бол буцна.
                window.close();
                router.back();
              }
            }}
          >
            Буцах
          </Button>
          <Typography variant="h6">
            {title || `GeoStyler${layerId ? ` · Layer #${layerId}` : ""}`}
          </Typography>
        </Stack>
      </Stack>

      {/* Демогийн адил 2 багана: зүүн Graphical Editor, баруун Display панель */}
      <Box
        sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" },
          alignItems: "start",
        }}
      >
        {/* Зүүн багана — Graphical Editor + доор нь нэмэлт (belowEditor) */}
        <Stack spacing={1}>
          <Card
            ref={nameGuardRef}
            sx={{
              py: 1,
              overflow: "auto",
              // Style нэр = view нэр тул засагдахгүй (зөвхөн харах). antd Input нь
              // gs-namefield class‑ыг input элемент дээр шууд тавьдаг.
              "& .gs-namefield, & input.gs-namefield": {
                pointerEvents: "none",
                backgroundColor: "action.disabledBackground",
                color: "text.disabled",
                cursor: "not-allowed",
              },
            }}
          >
            {gsStyle && (
              <GeoStylerStyle
                key={loadKey}
                style={gsStyle}
                onStyleChange={setGsStyle}
              />
            )}
            {/* Хадгалах — rule‑ийн доор, мөрний баруун төгсгөлд. Хил дагуу нэр
              идэвхтэй үед нуугдана (нэг зэрэг зөвхөн нэг save товч). */}
            {!hideSave && (
              <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Хадгалж байна…" : "Хадгалах"}
                </Button>
              </Stack>
            )}
          </Card>
          {belowEditor}
        </Stack>

        {/* Баруун — Display: Split View / Code Editor / Preview Map / Legend */}
        <Card
          sx={{
            p: 1,
            "& .gs-code-editor-monaco": {
              height: display === "code" ? "calc(100vh - 230px)" : 360,
              minHeight: display === "code" ? 520 : 360,
            },
            "& .gs-code-editor-monaco .monaco-editor": {
              height: "100% !important",
            },
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={display}
              onChange={(_, v) => v && setDisplay(v)}
            >
              <ToggleButton size="small" value="split">
                Split View
              </ToggleButton>

              <ToggleButton size="small" value="preview">
                Preview Map
              </ToggleButton>
              <ToggleButton size="small" value="legend">
                Legend
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          {display === "split" && (
            <Stack spacing={2}>
              <Box>{codeEditor}</Box>
              <Box>{previewMap}</Box>
            </Stack>
          )}

          {display === "preview" && <Box>{previewMap}</Box>}
          {display === "legend" && <GeoStylerLegend gsStyle={gsStyle} />}
        </Card>
      </Box>
    </Stack>
  );
}

GeoStylerEditor.propTypes = {
  layerId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  sldUrl: PropTypes.string,
  uploadUrl: PropTypes.string,
  title: PropTypes.string,
  belowEditor: PropTypes.node,
  hideSave: PropTypes.bool,
  sldRef: PropTypes.object,
  onClose: PropTypes.func,
};
