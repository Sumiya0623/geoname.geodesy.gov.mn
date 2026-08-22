import React, {
  useRef,
  useMemo,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  Box,
  IconButton,
  Typography,
  Tooltip,
  Paper,
  Divider,
  Chip,
  Collapse,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
} from "@mui/material";
import { usePathname } from "next/navigation";
import { useTheme } from "@mui/material/styles";
import {
  Add as AddIcon,
  Print as PrintIcon,
  FilterList as FilterIcon,
  Layers as LayersIcon,
  Close as CloseIcon,
  LayersClearRounded as ClearLayersIcon,
  Place as GeomPointIcon,
  Timeline as GeomLineIcon,
  CropSquare as GeomPolyIcon,
  FolderOutlined as GeomOtherIcon,
  DoNotDisturbAlt as NoLayerIcon,
  KeyboardArrowUp as CollapseAllIcon,
  KeyboardArrowDown as ExpandAllIcon,
  HighlightAlt as SelectFeatureIcon,
  ArrowDropDown as ArrowDropDownIcon,
  RadioButtonChecked as CircleSelIcon,
  CropFree as RectSelIcon,
  Pentagon as PolySelIcon,
  AccountTree as UnitTreeIcon,
  GavelRounded as LegalIcon,
  ForumRounded as RequestIcon,
} from "@mui/icons-material";

import MapAddName from "./MapAddName";
import RasterPrintPanel from "../../sections/champaign/raster/print-map-panel";
import WorkMapDialog from "../../sections/champaign/workmap/work-map-dialog";
import NameCategoryTree from "./NameCategoryTree";
import RecountPanel from "./RecountPanel";
import RecountUnitTree from "./RecountUnitTree";
import LegalUnitTree from "./LegalUnitTree";
import RequestPanel from "./RequestPanel";
import AdvancedSearch from "./AdvancedSearch";

// geoname:geoname_view (бүх геонэр) WMS суурь URL — Нэрийн ангилал филтерт
const GEONAME_VIEW_URL = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/geoname/wms?service=WMS&version=1.1.0&request=GetMap&bbox=87,41,120,52&layers=geoname:geoname_view&srs=EPSG:4326&width=768&height=330&format=image/png`;
// geoname:recount_view (бүх тодруулалт) WMS суурь URL — Тодруулалтын сан табд
const RECOUNT_VIEW_URL = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/geoname/wms?service=WMS&version=1.1.0&request=GetMap&bbox=87,41,120,52&layers=geoname:recount_view&srs=EPSG:4326&width=768&height=330&format=image/png`;
// ЗЗ нэгжийн хил (point:core_adminunit) WMS суурь URL — сонгосон нэгжийн хүрээнд
const ADMIN_UNIT_URL = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/point/wms?service=WMS&version=1.1.0&request=GetMap&bbox=87,41,120,52&layers=point:core_adminunit&srs=EPSG:4326&width=768&height=330&format=image/png`;

// Идэвхтэй давхаргын геометрийн дүрс (Цэг/Шугам/Талбай)
function ActiveGeomIcon({ desc }) {
  const d = (desc || "").trim();
  if (d === "Цэг")
    return <GeomPointIcon sx={{ fontSize: 16, color: "#16a34a" }} />;
  if (d === "Шугам")
    return <GeomLineIcon sx={{ fontSize: 16, color: "#2563eb" }} />;
  if (d === "Талбай")
    return <GeomPolyIcon sx={{ fontSize: 16, color: "#d97706" }} />;
  return <GeomOtherIcon sx={{ fontSize: 16, color: "#0675c9" }} />;
}

// Панелийн табууд — толгойн доор хэвтээ toggle товчлуураар харагдана
const PANEL_TABS = [
  {
    value: "layers",
    label: "Нэрийн сан",
    Icon: LayersIcon,
    color: "#0675c9",
    id: "geoserver-network",
  },
  {
    value: "recount",
    label: "Тодруулалт",
    Icon: UnitTreeIcon,
    color: "#7c3aed",
    id: "geoserver-recount",
  },
  {
    value: "legal",
    label: "Шийдвэр",
    Icon: LegalIcon,
    color: "#b45309",
    id: "geoserver-legal",
  },
  // Иргэдийн нэр өөрчлөх/нэмэх санал — ЗӨВХӨН ерөнхий газрын зураг дээр
  {
    value: "request",
    label: "Хүсэлт",
    Icon: RequestIcon,
    color: "#0891b2",
    id: "geoserver-request",
    mainOnly: true,
  },
];

function GeoserverDialog({
  enabledFilters = new Set(),
  onFilterChange,
  onSearchChange,
  searchValue = "",
  title = "Удирдлага",
  onStartDrawing,
  onDrawCircle,
  onStartPickPoint,
  onStartDrawRectangle,
  onStartDrawPolygon,
  onClearSearchArea,
  onResults,
  forceOpen = false,
  forceTab = null,
  onFlyTo,
  // Төслийн ажлын талбай (ProjectArea) — зурагт дамжуулна
  onProjectAreas,
  onPanelClose,
  geonameSearchTerm,
  geonameSeedUnit,
  scaleDenom,
  onRecountCql,
  // Ангиллын мөрийн 3 цэгийн цэс (Zoom/Feature table/Чанар) — map боловсруулна
  onNodeAction,
  // Панелийн өргөн өөрчлөгдөхөд эцэгт мэдэгдэнэ (доод хүснэгт мөрөө тааруулна)
  onWidthChange,
  // Идэвхтэй таб солигдоход эцэгт мэдэгдэнэ (ж: Шийдвэрийн сан → хилийн overlay)
  onTabChange,
  // Шийдвэрийн модны хүснэгтийн дүрс дарахад доод жагсаалтыг нээнэ
  onLegalOpenList,
}) {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));
  const [open, setOpen] = useState(false);
  // Панелийн ӨРГӨН — баруун ирмэгээс чирж солино
  const [panelW, setPanelW] = useState(440);
  // Орон зайн сонголтын (Select Feature) цэс
  const [selMenu, setSelMenu] = useState(null);
  const [hasActive, setHasActive] = useState(false);
  // Идэвхтэй давхаргын нэр/геометрийн төрөл (толгойн мөрөнд харуулна)
  const [activeLayer, setActiveLayer] = useState(null);
  // Тооллогын модонд сонгогдсон ангиллын тоо (доод мөрийн тоолуур)
  const [recountChecked, setRecountChecked] = useState(0);
  useEffect(() => {
    const h = (e) => {
      setHasActive(!!e?.detail?.id);
      setActiveLayer(
        e?.detail?.id ? { name: e.detail.name, desc: e.detail.desc } : null,
      );
      setRecountChecked(e?.detail?.checkedCount ?? 0);
    };
    window.addEventListener("recount:active", h);
    return () => window.removeEventListener("recount:active", h);
  }, []);
  // QGIS маягийн мэдэгдэл — идэвхтэй давхаргагүй үед
  const noActiveNotice = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("map:notice", {
        detail: {
          title: "Идэвхтэй вектор давхарга алга:",
          text: "Объект сонгохын тулд давхаргын жагсаалтаас давхарга сонгоно уу",
        },
      }),
    );
  }, []);
  const widthDragRef = useRef(null);
  const startWidthResize = useCallback(
    (e) => {
      e.preventDefault();
      widthDragRef.current = { x: e.clientX, w: panelW };
      const onMove = (ev) => {
        const d = widthDragRef.current;
        if (!d) return;
        setPanelW(
          Math.min(
            Math.max(300, d.w + (ev.clientX - d.x)),
            window.innerWidth - 320,
          ),
        );
      };
      const onUp = () => {
        widthDragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [panelW],
  );
  // Төслийн зураг дээр «Нэрийн сан» таб байхгүй — бүх үйлдэл «Тодруулалт» дотор
  const [tab, setTab] = useState("layers");
  const [addOpen, setAddOpen] = useState(false);

  // Идэвхтэй табыг эцэгт мэдэгдэнэ (панель нээлттэй үед л)
  const onTabChangeRef = useRef(onTabChange);
  onTabChangeRef.current = onTabChange;
  useEffect(() => {
    onTabChangeRef.current?.(open ? tab : null);
  }, [tab, open]);

  // Зөвхөн төслийн газрын зураг (/dashboard/champaign/<id>/map) — шинэ нэр нэмэх
  const pathname = usePathname();
  const _cm = (pathname || "").match(/^\/dashboard\/champaign\/([^/]+)\/map/);
  const addProjectId = _cm ? _cm[1] : null;

  // Төслийн зураг (champaign/<id>/map) дээр харуулах табууд — «Нэрийн сан»‑гүй
  const visibleTabs = useMemo(
    () =>
      addProjectId
        ? PANEL_TABS.filter((t) => t.value !== "layers" && !t.mainOnly)
        : PANEL_TABS,
    [addProjectId],
  );
  // Табын МӨРҮҮД: [Нэрийн сан] / [Тодруулалт, Шийдвэр, Хүсэлт]
  const tabRows = useMemo(() => {
    const wide = visibleTabs.filter((t) => t.value === "layers");
    const rest = visibleTabs.filter((t) => t.value !== "layers");
    return [wide, rest].filter((r) => r.length);
  }, [visibleTabs]);

  // Төслийн горимд анхдагч таб = Тодруулалт
  useEffect(() => {
    if (addProjectId && tab === "layers") setTab("recount");
  }, [addProjectId, tab]);

  // Панелийн эзлэх өргөнийг эцэгт мэдэгдэнэ (хаалттай бол 0)
  useEffect(() => {
    if (onWidthChange) onWidthChange(open && !isSmall ? panelW : 0);
  }, [open, panelW, isSmall, onWidthChange]);

  // forceOpen‑ийг бодит open төлөвтэй синк (толгойн товч toggle хийнэ)
  useEffect(() => {
    setOpen(forceOpen);
    if (forceOpen && forceTab !== null) {
      setTab(forceTab);
    }
  }, [forceOpen, forceTab]);
  const [nameChecked, setNameChecked] = useState(() => new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [treeFilters, setTreeFilters] = useState(null);
  const [extraCql, setExtraCql] = useState("");
  const [printOpen, setPrintOpen] = useState(false);
  useEffect(() => {
    if (geonameSearchTerm?.term) setSearchOpen(true);
  }, [geonameSearchTerm]);

  // URL‑ээс ЗЗ нэгж ирвэл (нүүрийн статистикаас) дэлгэрэнгүй хайлтыг нээнэ
  useEffect(() => {
    if (geonameSeedUnit?.id) setSearchOpen(true);
  }, [geonameSeedUnit]);
  const checkedNodesRef = useRef(new Map());
  const onFilterChangeRef = useRef(onFilterChange);
  onFilterChangeRef.current = onFilterChange;
  const extraCqlRef = useRef(extraCql);
  extraCqlRef.current = extraCql;
  const applyNameLayer = useCallback((node, enabled) => {
    const onFilterChange = onFilterChangeRef.current;
    if (!onFilterChange) return;
    const fid = `name_${node.id}`;
    // Хуучин давхаргыг эхлээд авна — CQL солигдоход зөв шинэчлэгдэнэ
    onFilterChange(fid, false, { id: fid });
    if (!enabled) return;
    // ГАНЦ geoname_view (default style = geoname_types, per‑type тэмдэг).
    // type_l1/l2/id‑ээр ангиллыг, + сонгосон нэгж/бусад шүүлтийг (extraCql) шүүнэ.
    const typeCql = `type_l1=${node.id} OR type_l2=${node.id} OR type_id=${node.id}`;
    const extra = extraCqlRef.current;
    const cql = extra ? `(${typeCql}) AND (${extra})` : typeCql;
    onFilterChange(fid, true, {
      id: fid,
      name: node.name,
      layer: "geoname:geoname_view",
      cql_filter: cql,
      nameCached: true, // z5‑12 GWC кэш, >12 амьд WMS
      groupUrl: GEONAME_VIEW_URL,
      isFromStaticLayer: false,
    });
  }, []);

  const handleNameToggle = useCallback(
    (node, enabled) => {
      setNameChecked((prev) => {
        const next = new Set(prev);
        if (enabled) next.add(node.id);
        else next.delete(node.id);
        return next;
      });
      if (enabled) checkedNodesRef.current.set(node.id, node);
      else checkedNodesRef.current.delete(node.id);
      applyNameLayer(node, enabled);
    },
    [applyNameLayer],
  );

  // Хайлтын шүүлт (extraCql) өөрчлөгдөхөд идэвхтэй ангиллын давхаргуудыг
  // шинэ CQL‑ээр дахин тавина — сонгосон нэгжийн нэрс л харагдана.
  useEffect(() => {
    checkedNodesRef.current.forEach((node) => applyNameLayer(node, true));
  }, [extraCql, applyNameLayer]);

  // Газар зүйн нэрийн дэлгэрэнгүй хайлт — CQL‑ийг geoname_view‑д тавина
  const handleGeonameSearch = useCallback(
    (cql) => {
      if (!onFilterChange) return;
      onFilterChange("geoname_search", false, { id: "geoname_search" });
      onFilterChange("geoname_search", true, {
        id: "geoname_search",
        name: "Хайлт",
        layer: "geoname:geoname_view",
        cql_filter: cql,
        groupUrl: GEONAME_VIEW_URL,
        isFromStaticLayer: false,
      });
    },
    [onFilterChange],
  );

  const handleGeonameSearchClear = useCallback(() => {
    if (onFilterChange) {
      onFilterChange("geoname_search", false, { id: "geoname_search" });
    }
  }, [onFilterChange]);

  // Тодруулалтын сан — сонгосон recount‑уудыг recount_view WMS‑ээр газрын
  // зурагт тодруулна (onFilterChange overlay pipeline — ямар ч map дээр ажиллана).
  const handleRecountHighlight = useCallback(
    (cql) => {
      if (!onFilterChange) return;
      onFilterChange("recount_highlight", false, { id: "recount_highlight" });
      if (!cql) return;
      onFilterChange("recount_highlight", true, {
        id: "recount_highlight",
        name: "Тодруулалт",
        layer: "geoname:recount_view",
        cql_filter: cql,
        recountView: true, // recount_view‑г өөрийн (geoname төрлийн) style‑аар рендерлэ
        groupUrl: RECOUNT_VIEW_URL,
        isFromStaticLayer: false,
      });
    },
    [onFilterChange],
  );

  // Тодруулалтын панелиас сонгосон нэгжийн ЗӨВХӨН ХҮРЭЭГ зурна (дүүргэлтгүй).
  // GeoServer‑ийн built‑in 'line' style нь полигоныг зөвхөн контуроор рендерлэнэ.
  const handleUnitBoundary = useCallback(
    (unitId) => {
      if (!onFilterChange) return;
      onFilterChange("unit_boundary", false, { id: "unit_boundary" });
      if (!unitId) return;
      onFilterChange("unit_boundary", true, {
        id: "unit_boundary",
        name: "Сонгосон нэгжийн хил",
        layer: "point:core_adminunit",
        cql_filter: `IN ('core_adminunit.${unitId}')`,
        styles: "line",
        groupUrl: ADMIN_UNIT_URL,
        isFromStaticLayer: false,
      });
    },
    [onFilterChange],
  );

  const isLeaf = useCallback(
    (node) => !node?.children || node.children.length === 0,
    [],
  );

  const collectLeaves = useCallback(
    (nodes = [], acc = []) => {
      nodes.forEach((n) => {
        if (isLeaf(n)) acc.push(n);
        else collectLeaves(n.children || [], acc);
      });
      return acc;
    },
    [isLeaf],
  );

  const filterNodesBySearch = useCallback(
    (nodes = [], term = "") => {
      if (!term) return nodes;
      const t = term.toLowerCase();
      const res = [];
      nodes.forEach((n) => {
        const nameMatch = (n.name || "").toLowerCase().includes(t);
        if (!isLeaf(n)) {
          const kids = filterNodesBySearch(n.children || [], term);
          if (nameMatch || kids.length > 0) res.push({ ...n, children: kids });
        } else if (nameMatch) {
          res.push(n);
        }
      });
      return res;
    },
    [isLeaf],
  );

  const handleClose = () => {
    setOpen(false);
    if (onPanelClose) onPanelClose();
  };
  const handleTabChange = (_e, value) => setTab(value);

  return (
    <Box
      sx={{
        position: "absolute",
        top: isSmall ? 8 : 16,
        left: isSmall ? 8 : 16,
        // right: isSmall && open ? 8 : "auto",
        zIndex: 1,
        width: isSmall && open ? "calc(100dvw - 16px)" : "auto",
        boxSizing: "border-box",
      }}
    >
      {open && (
        <Paper
          elevation={8}
          sx={{
            position: "fixed",
            top: 60,
            left: 0,
            // Цонхны ёроол хүртэл — доод attribute хүснэгт нь панелийн БАРУУН
            // талаас эхэлдэг тул давхцахгүй.
            bottom: 0,
            zIndex: 1300,
            width: isSmall ? "100dvw" : panelW,
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            borderRight: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 0,
            backgroundColor: "rgba(255,255,255,0.90)",
            backdropFilter: "blur(6px)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
          id="geoserver-dialog-container"
        >
          {/* Баруун ирмэгийн чирэх бариул — панелийн ӨРГӨНийг солино */}
          {!isSmall && (
            <Box
              onMouseDown={startWidthResize}
              sx={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                width: 6,
                cursor: "col-resize",
                zIndex: 5,
                "&:hover": { bgcolor: "primary.light" },
              }}
            />
          )}
          <Box
            sx={{
              p: 1.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              bgcolor: "primary.main",
              color: "primary.contrastText", // доторх текст/икон энэ өнгийг өвлөнө
            }}
          >
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 700, color: "inherit" }}
            >
              {title}
            </Typography>

            <IconButton onClick={handleClose} color="inherit">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          {/* Табууд — «Нэрийн сан» дээд мөрөнд БҮТЭН ӨРГӨН, доор нь
              Тодруулалт | Шийдвэр | Хүсэлт гурав тэнцүү хуваагдана */}
          <Box
            sx={{
              px: 1,
              py: 0.75,
              display: "flex",
              flexDirection: "column",
              gap: 0.75,
              bgcolor: "#fff",
              borderBottom: "1px solid #f0f0f0",
              flexShrink: 0,
              "& .MuiToggleButtonGroup-grouped": {
                border: "1px solid #e5e7eb !important",
                borderRadius: "8px !important",
                px: 1,
                py: 0.5,
                gap: 0.5,
                textTransform: "none",
                fontSize: 12,
                fontWeight: 600,
                color: "text.secondary",
                whiteSpace: "nowrap",
              },
            }}
          >
            {tabRows.map((row, ri) => (
              <ToggleButtonGroup
                // eslint-disable-next-line react/no-array-index-key
                key={ri}
                exclusive
                value={tab}
                onChange={(e, v) => v && handleTabChange(e, v)}
                sx={{ gap: 0.75, "& .MuiToggleButton-root": { flex: 1 } }}
              >
                {row.map(({ value, label, Icon, color, id }) => (
                  <ToggleButton
                    key={value}
                    value={value}
                    id={id}
                    sx={{
                      "&.Mui-selected": {
                        color,
                        bgcolor: `${color}14`,
                        borderColor: `${color}66 !important`,
                        "&:hover": { bgcolor: `${color}1f` },
                      },
                    }}
                  >
                    <Icon sx={{ fontSize: 18, color }} />
                    {!isSmall && label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            ))}
          </Box>

          <Box
            sx={{
              display: "flex",
              flex: 1,
              minHeight: 0,
              flexDirection: "column",
              height: "100%",
            }}
          >
            <Box
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                position: "relative",
                zIndex: 2,
              }}
            >
              {(tab === "layers" || (addProjectId && tab === "recount")) && (
                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Box
                    sx={{
                      px: 1.5,
                      py: 1,
                      borderBottom: "1px solid #f0f0f0",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        minWidth: 0,
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{ color: "#0675c9", flexShrink: 0 }}
                      >
                        {addProjectId
                          ? "Тооллогын ангилал"
                          : "Газар зүйн нэрийн ангилал"}
                      </Typography>
                      {/* Идэвхтэй ДАВХАРГА — нэр + геометрийн дүрс. Байхгүй бол
                          "сонгоогүй" тэмдэг. */}
                      <Tooltip
                        title={
                          activeLayer
                            ? `Идэвхтэй давхарга: ${activeLayer.name}`
                            : "Идэвхтэй давхарга сонгоогүй — модноос ангилал дарна уу"
                        }
                      >
                        <Chip
                          icon={
                            activeLayer ? (
                              <ActiveGeomIcon desc={activeLayer.desc} />
                            ) : (
                              <NoLayerIcon sx={{ fontSize: 16 }} />
                            )
                          }
                          label={
                            activeLayer ? activeLayer.name : "Давхарга алга"
                          }
                          sx={{
                            height: 22,
                            maxWidth: 160,
                            fontSize: 11,
                            fontWeight: 600,
                            color: activeLayer ? "#0675c9" : "text.disabled",
                            bgcolor: activeLayer ? "#0675c914" : "transparent",
                            border: "1px solid",
                            borderColor: activeLayer ? "#0675c933" : "divider",
                          }}
                        />
                      </Tooltip>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center" }}></Box>
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.25,
                      px: 1,
                      py: 0.5,
                      flexShrink: 0,
                      borderBottom: "1px solid #f0f0f0",
                      bgcolor: "#fafafa",
                    }}
                  >
                    <Tooltip title="Идэвхтэй ангиллыг ДЭЭШ (эхэнд зурагдана)">
                      <span>
                        <IconButton
                          disabled={!hasActive}
                          onClick={() =>
                            window.dispatchEvent(new Event("recount:moveUp"))
                          }
                        >
                          <CollapseAllIcon sx={{ fontSize: 20 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Идэвхтэй ангиллыг ДООШ (дээр нь зурагдана)">
                      <span>
                        <IconButton
                          disabled={!hasActive}
                          onClick={() =>
                            window.dispatchEvent(new Event("recount:moveDown"))
                          }
                        >
                          <ExpandAllIcon sx={{ fontSize: 20 }} />
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

                    <Tooltip title="Select Feature — газрын зураг дээрээс сонгох">
                      <IconButton
                        onClick={() =>
                          hasActive ? onStartPickPoint?.() : noActiveNotice()
                        }
                        sx={{ color: hasActive ? "#f59e0b" : "text.disabled" }}
                      >
                        <SelectFeatureIcon sx={{ fontSize: 20 }} />
                      </IconButton>
                    </Tooltip>
                    <IconButton
                      sx={{ p: 0, ml: -0.5 }}
                      onClick={(e) => setSelMenu(e.currentTarget)}
                    >
                      <ArrowDropDownIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                    <Menu
                      anchorEl={selMenu}
                      open={Boolean(selMenu)}
                      onClose={() => setSelMenu(null)}
                      slotProps={{ paper: { sx: { minWidth: 210 } } }}
                    >
                      <MenuItem
                        onClick={() => {
                          setSelMenu(null);
                          if (!hasActive) {
                            noActiveNotice();
                            return;
                          }
                          onStartDrawing?.();
                        }}
                      >
                        <ListItemIcon>
                          <CircleSelIcon
                            sx={{ fontSize: 18, color: "#f59e0b" }}
                          />
                        </ListItemIcon>
                        <ListItemText>Тойргоор</ListItemText>
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          setSelMenu(null);
                          if (!hasActive) {
                            noActiveNotice();
                            return;
                          }
                          onStartDrawRectangle?.();
                        }}
                      >
                        <ListItemIcon>
                          <RectSelIcon
                            sx={{ fontSize: 18, color: "#f59e0b" }}
                          />
                        </ListItemIcon>
                        <ListItemText>Тэгш өнцөгтөөр</ListItemText>
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          setSelMenu(null);
                          if (!hasActive) {
                            noActiveNotice();
                            return;
                          }
                          onStartDrawPolygon?.();
                        }}
                      >
                        <ListItemIcon>
                          <PolySelIcon
                            sx={{ fontSize: 18, color: "#f59e0b" }}
                          />
                        </ListItemIcon>
                        <ListItemText>Полигоноор</ListItemText>
                      </MenuItem>
                      <Divider />
                      <MenuItem
                        onClick={() => {
                          setSelMenu(null);
                          onClearSearchArea?.();
                        }}
                      >
                        <ListItemIcon>
                          <ClearLayersIcon
                            sx={{ fontSize: 18, color: "#d32f2f" }}
                          />
                        </ListItemIcon>
                        <ListItemText>Сонголтын мужийг цэвэрлэх</ListItemText>
                      </MenuItem>
                    </Menu>

                    {/* Баруун тал — хайлт / хэвлэх / нэр нэмэх */}
                    <Box sx={{ flex: 1 }} />
                    <Tooltip title="Дэлгэрэнгүй хайлт">
                      <IconButton
                        onClick={() => setSearchOpen((v) => !v)}
                        sx={{
                          color: searchOpen ? "#0675c9" : "text.secondary",
                        }}
                      >
                        <FilterIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip
                      title={
                        addProjectId
                          ? "Хээрийн тодруулалтын зураг хэвлэх"
                          : "Газар зүйн нэрийн зураг хэвлэх"
                      }
                    >
                      <IconButton
                        onClick={() => setPrintOpen(true)}
                        sx={{ color: "#2e7d32" }}
                      >
                        <PrintIcon sx={{ fontSize: 20 }} />
                      </IconButton>
                    </Tooltip>
                    {addProjectId && (
                      <Tooltip title="Шинэ нэр нэмэх">
                        <IconButton
                          onClick={() => setAddOpen((v) => !v)}
                          sx={{ color: addOpen ? "#16a34a" : "text.secondary" }}
                        >
                          <AddIcon sx={{ fontSize: 20 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>

                  <Collapse
                    in={searchOpen && !addProjectId}
                    timeout="auto"
                    unmountOnExit
                  >
                    <AdvancedSearch
                      onSearch={handleGeonameSearch}
                      onClear={handleGeonameSearchClear}
                      onFlyTo={onFlyTo}
                      seed={geonameSearchTerm}
                      seedUnit={geonameSeedUnit}
                      onStartDrawRectangle={onStartDrawRectangle}
                      onStartDrawCircle={onStartDrawing}
                      onStartDrawPolygon={onStartDrawPolygon}
                      onClearSearchArea={onClearSearchArea}
                      onResults={onResults}
                      onTreeFilters={setTreeFilters}
                      onExtraCql={setExtraCql}
                    />
                  </Collapse>
                  {addProjectId && (
                    <Collapse in={addOpen} timeout="auto" unmountOnExit>
                      <MapAddName
                        projectId={addProjectId}
                        onClose={() => setAddOpen(false)}
                      />
                    </Collapse>
                  )}
                  <Box sx={{ flex: 1, overflowY: "auto", px: 0.5 }}>
                    {addProjectId ? (
                      <RecountPanel
                        projectId={addProjectId}
                        onCql={onRecountCql}
                        searchOpen={searchOpen}
                        onNodeAction={onNodeAction}
                        onFlyTo={onFlyTo}
                        onUnitBoundary={handleUnitBoundary}
                        onAreas={onProjectAreas}
                      />
                    ) : (
                      <NameCategoryTree
                        onToggle={handleNameToggle}
                        checkedSet={nameChecked}
                        filters={treeFilters}
                        autoCheck={geonameSeedUnit?.n}
                      />
                    )}
                  </Box>
                  {/* Хэвлэх — ТӨСЛИЙН газрын зураг дээр ТОДРУУЛАЛТЫН (recount)
                      ажлын зураг, бусад үед батлагдсан нэрийн зураг. */}
                  {addProjectId ? (
                    <WorkMapDialog
                      open={printOpen}
                      projectId={addProjectId}
                      onClose={() => setPrintOpen(false)}
                    />
                  ) : (
                    <RasterPrintPanel
                      open={printOpen}
                      onClose={() => setPrintOpen(false)}
                    />
                  )}
                  <Divider />
                  <Box sx={{ p: 1.5, textAlign: "center", flexShrink: 0 }}>
                    <Typography variant="caption" color="text.secondary">
                      {addProjectId ? recountChecked : nameChecked.size} ангилал
                      идэвхтэй
                      {typeof scaleDenom === "number" &&
                        scaleDenom > 0 &&
                        ` • Zoom ~ ${Math.round(Math.log2(559082264.028 / scaleDenom))}`}
                    </Typography>
                  </Box>
                </Box>
              )}

              {tab === "recount" && !addProjectId && (
                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Box
                    sx={{
                      px: 1.5,
                      py: 1,
                      borderBottom: "1px solid #f0f0f0",
                      flexShrink: 0,
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      sx={{
                        color: "#7c3aed",
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                      }}
                    >
                      <UnitTreeIcon sx={{ fontSize: 18 }} />
                      Тодруулалтын сан
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <RecountUnitTree
                      onCql={handleRecountHighlight}
                      onFlyTo={onFlyTo}
                    />
                  </Box>
                </Box>
              )}

              {tab === "legal" && (
                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Box
                    sx={{
                      px: 1.5,
                      py: 1,
                      borderBottom: "1px solid #f0f0f0",
                      flexShrink: 0,
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      sx={{
                        color: "#b45309",
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                      }}
                    >
                      <LegalIcon sx={{ fontSize: 18 }} />
                      Шийдвэрийн сан
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <LegalUnitTree
                      onFlyTo={onFlyTo}
                      onOpenList={onLegalOpenList}
                    />
                  </Box>
                </Box>
              )}

              {/* Хүсэлт — газрын зурагт geoname:request_view WMS‑ээр харагдана */}
              {tab === "request" && (
                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Box
                    sx={{
                      px: 1.5,
                      py: 1,
                      borderBottom: "1px solid #f0f0f0",
                      flexShrink: 0,
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      sx={{
                        color: "#0891b2",
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                      }}
                    >
                      <RequestIcon sx={{ fontSize: 18 }} />
                      Нэрийн хүсэлт
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <RequestPanel onFlyTo={onFlyTo} />
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </Paper>
      )}
    </Box>
  );
}

export default GeoserverDialog;
