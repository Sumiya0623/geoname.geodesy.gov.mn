import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  Box,
  IconButton,
  Typography,
  Tooltip,
  Paper,
  Avatar,
  Checkbox,
  Divider,
  Chip,
  Collapse,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tabs,
  Tab,
  useMediaQuery,
} from "@mui/material";
import { usePathname } from "next/navigation";
import { useTheme } from "@mui/material/styles";
import {
  Add as AddIcon,
  Print as PrintIcon,
  FilterList as FilterIcon,
  Layers as LayersIcon,
  FiberManualRecord as DotIcon,
  Close as CloseIcon,
  Satellite as SatelliteIcon,
  Map as MapIcon,
  Terrain as TerrainIcon,
  Public as PublicIcon,
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
} from "@mui/icons-material";

import { useGetGeoserver } from "src/api/map";
import MapAddName from "./MapAddName";
import RasterPrintPanel from "../../sections/raster/print-map-panel";
import NameCategoryTree from "./NameCategoryTree";
import RecountPanel from "./RecountPanel";
import AdvancedSearch from "./AdvancedSearch";

// geoname:geoname_view (бүх геонэр) WMS суурь URL — Нэрийн ангилал филтерт
const GEONAME_VIEW_URL = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/geoname/wms?service=WMS&version=1.1.0&request=GetMap&bbox=87,41,120,52&layers=geoname:geoname_view&srs=EPSG:4326&width=768&height=330&format=image/png`;

const isLeaf = (node) => !node?.children || node.children.length === 0;

// Идэвхтэй давхаргын геометрийн дүрс (Цэг/Шугам/Талбай)
function ActiveGeomIcon({ desc }) {
  const d = (desc || "").trim();
  if (d === "Цэг") return <GeomPointIcon sx={{ fontSize: 16, color: "#16a34a" }} />;
  if (d === "Шугам") return <GeomLineIcon sx={{ fontSize: 16, color: "#2563eb" }} />;
  if (d === "Талбай") return <GeomPolyIcon sx={{ fontSize: 16, color: "#d97706" }} />;
  return <GeomOtherIcon sx={{ fontSize: 16, color: "#0675c9" }} />;
}

function LeafItem({ leaf, group, path, color, isEnabled, toggleLeaf }) {
  return (
    <ListItemButton
      key={path}
      onClick={() => toggleLeaf(leaf, group, path, !isEnabled)}
      sx={{
        py: 0.5,
        borderRadius: 1,
        mx: 1,
        backgroundColor: isEnabled ? `${color}08` : "transparent",
        "&:hover": { backgroundColor: `${color}12` },
        borderLeft: isEnabled ? `2px solid ${color}` : "2px solid transparent",
      }}
    >
      <ListItemIcon sx={{ minWidth: 36 }}>
        <DotIcon sx={{ fontSize: 12, color: isEnabled ? color : "#ccc" }} />
      </ListItemIcon>
      <ListItemText
        primary={
          <Typography
            variant="body2"
            sx={{ fontWeight: isEnabled ? 500 : 400 }}
          >
            {leaf.name} ({leaf.count})
          </Typography>
        }
      />
      <Box sx={{ minWidth: 48, display: "flex", justifyContent: "flex-end" }}>
        <Checkbox
          edge="end"
          checked={isEnabled}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation();
            toggleLeaf(leaf, group, path, e.target.checked);
          }}
          size="small"
          sx={{ color, "&.Mui-checked": { color } }}
        />
      </Box>
    </ListItemButton>
  );
}

function GroupItem({
  group,
  originalIndex,
  expandedGroups,
  toggleGroupExpanded,
  triState,
  countEnabledLeaves,
  countLeaves,
  getGroupColor,
  toggleAllLeavesUnder,
  renderNode,
  enabledSet,
}) {
  const groupColor = getGroupColor(originalIndex);
  const isExpanded = expandedGroups.has(originalIndex);
  const groupState = triState(group.children || []);
  const groupChecked = groupState === "all";
  const groupIndeterminate = groupState === "some";
  const groupEnabled = countEnabledLeaves(group.children || [], enabledSet);

  return (
    <Box>
      <ListItemButton
        onClick={() => toggleGroupExpanded(originalIndex)}
        sx={{
          pt: 1,
          display: "flex",
          borderLeft:
            groupEnabled > 0
              ? `4px solid ${groupColor}`
              : `4px solid transparent`,
          backgroundColor: groupEnabled > 0 ? `${groupColor}08` : "transparent",
          "&:hover": {
            backgroundColor: `${groupColor}12`,
          },
        }}
      >
        <ListItemText
          sx={{
            alignItems: "center",
            display: { xs: "block", sm: "flex" },
            justifyContent: { sm: "space-between" },
          }}
          primary={
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1.25,
                minWidth: 0,
              }}
            >
              <LayersIcon sx={{ fontSize: 16, groupColor }} />
              <Typography
                variant="body2"
                fontWeight={700}
                noWrap
                title={group.name}
                sx={{ minWidth: 0 }}
              >
                {group.name}
              </Typography>
            </Box>
          }
          secondary={
            group?.count && (
              <Chip
                label={`${group.count}ш`}
                size="small"
                color="default"
                variant="outlined"
              />
            )
          }
        />

        <Checkbox
          edge="end"
          indeterminate={groupIndeterminate}
          checked={groupChecked}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation();
            toggleAllLeavesUnder(
              group.children || [],
              group,
              group.name,
              e.target.checked,
            );
          }}
          size="small"
          sx={{
            mr: 1,
            color: groupColor,
            "&.Mui-checked": { color: groupColor },
          }}
        />
      </ListItemButton>
      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <List dense sx={{ pl: 2, py: 0 }}>
          {(group.children || []).map((node, idx) =>
            renderNode(
              node,
              group,
              group.name,
              groupColor,
              1,
              `${originalIndex}-${idx}`,
            ),
          )}
        </List>
      </Collapse>
    </Box>
  );
}

const staticLayer = {
  id: "static_layer",
  name: "Идэвхигүй цэг тэмдэгт",
  url: `${
    process.env.NEXT_PUBLIC_GEOSERVER_URL
  }/point/wms?service=WMS&version=1.1.0&request=GetMap&bbox=97.5,41,120,52&layers=point:unknown&srs=EPSG:4326&width=768&height=330&format=image/png`,
  children: [
    {
      id: "inactive_gnss_114",
      type: "group",
      name: "GNSS-ИЙН СҮЛЖЭЭ",
      cql_filter: "system_id = 114",
    },
    {
      id: "inactive_gravity_116",
      type: "group",
      name: "ГРАВИМЕТРИЙН СҮЛЖЭЭ",
      cql_filter: "system_id = 116",
    },
    {
      id: "inactive_polygonometry_242",
      type: "group",
      name: "ПОЛИГОНОМЕТРИЙН СҮЛЖЭЭ",
      cql_filter: "system_id = 242",
    },
    {
      id: "inactive_triangulation_792",
      type: "group",
      name: "ТРИАНГУЛЯЦИЙН СҮЛЖЭЭ",
      cql_filter: "system_id = 792",
    },
    {
      id: "inactive_height_115",
      type: "group",
      name: "ӨНДРИЙН СҮЛЖЭЭ",
      cql_filter: "system_id = 115",
    },
  ],
};

function GeoserverDialog({
  enabledFilters = new Set(),
  onFilterChange,
  onSearchChange,
  searchValue = "",
  title = "Удирдлага",
  baseMap,
  setBaseMap,
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
  onPanelClose,
  geonameSearchTerm,
  scaleDenom,
  onRecountCql,
  // Ангиллын мөрийн 3 цэгийн цэс (Zoom/Feature table/Чанар) — map2 боловсруулна
  onNodeAction,
  // Панелийн өргөн өөрчлөгдөхөд эцэгт мэдэгдэнэ (доод хүснэгт мөрөө тааруулна)
  onWidthChange,
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
        e?.detail?.id
          ? { name: e.detail.name, desc: e.detail.desc }
          : null,
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
  const [expandedGroups, setExpandedGroups] = useState(new Set([0]));
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [tab, setTab] = useState("layers");
  const [addOpen, setAddOpen] = useState(false);

  // Зөвхөн төслийн газрын зураг (/dashboard/champaign/<id>/map) — шинэ нэр нэмэх
  const pathname = usePathname();
  const _cm = (pathname || "").match(/^\/dashboard\/champaign\/([^/]+)\/map/);
  const addProjectId = _cm ? _cm[1] : null;

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
  const [layerGroups, setLayerGroups] = useState([]);
  const [nameChecked, setNameChecked] = useState(() => new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [treeFilters, setTreeFilters] = useState(null);
  const [extraCql, setExtraCql] = useState("");
  const [printOpen, setPrintOpen] = useState(false);
  useEffect(() => {
    if (geonameSearchTerm?.term) setSearchOpen(true);
  }, [geonameSearchTerm]);
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

  const handleClearNames = useCallback(() => {
    if (onFilterChange) {
      nameChecked.forEach((id) =>
        onFilterChange(`name_${id}`, false, { id: `name_${id}` }),
      );
    }
    checkedNodesRef.current.clear();
    setNameChecked(new Set());
  }, [nameChecked, onFilterChange]);

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

  const { geoserver, geoserverLoading } = useGetGeoserver();

  useEffect(() => {
    if (geoserver) {
      setLayerGroups(geoserver);
    }
  }, [geoserver]);

  const enabledSet = useMemo(() => {
    if (enabledFilters instanceof Set)
      return new Set(Array.from(enabledFilters, (v) => String(v)));
    if (Array.isArray(enabledFilters))
      return new Set(enabledFilters.map((v) => String(v)));
    return new Set();
  }, [enabledFilters]);

  const getGroupColor = (index) => {
    const colors = [
      "#1976d2",
      "#4caf50",
      "#ff9800",
      "#2196f3",
      "#9c27b0",
      "#795548",
      "#607d8b",
    ];
    return colors[index % colors.length];
  };

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

  const countLeaves = (nodes = []) => collectLeaves(nodes).length;

  const countEnabledLeaves = useCallback(
    (nodes = [], enabledSet) =>
      collectLeaves(nodes).reduce(
        (acc, leaf) => acc + (enabledSet.has(String(leaf.id)) ? 1 : 0),
        0,
      ),
    [collectLeaves],
  );

  const triState = (nodes = []) => {
    const total = countLeaves(nodes);
    if (total === 0) return "none";
    const enabled = countEnabledLeaves(nodes, enabledSet);
    if (enabled === 0) return "none";
    if (enabled === total) return "all";
    return "some";
  };

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

  const activeFiltersCount = useMemo(() => {
    const allGroups = [...geoserver, staticLayer];
    return allGroups.reduce(
      (acc, group) =>
        acc + countEnabledLeaves(group.children || [], enabledSet),
      0,
    );
  }, [geoserver, enabledSet, countEnabledLeaves]);

  const filteredData = useMemo(() => {
    const allGroups = [...layerGroups, staticLayer];

    if (!searchValue) {
      return allGroups;
    }
    return allGroups
      .map((group) => ({
        ...group,
        children: filterNodesBySearch(group.children || [], searchValue),
      }))
      .filter((group) => (group.children?.length || 0) > 0);
  }, [layerGroups, searchValue, filterNodesBySearch]);

  const handleClick = () => setOpen((s) => !s);
  const handleClose = () => {
    setOpen(false);
    if (onPanelClose) onPanelClose();
  };
  const handleSearchChange = (e) =>
    onSearchChange && onSearchChange(e.target.value);
  const handleTabChange = (_e, value) => setTab(value);

  const toggleGroupExpanded = (groupIndex) => {
    const next = new Set(expandedGroups);
    if (next.has(groupIndex)) next.delete(groupIndex);
    else next.add(groupIndex);
    setExpandedGroups(next);
  };

  const toggleNodeExpanded = (key) => {
    const next = new Set(expandedNodes);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedNodes(next);
  };

  const resolveGroupUrl = (groupData, node) => node?.url || groupData?.url;
  const resolveLayerHint = (node) =>
    node.layer || node.layers || node.typename || node.TYPENAME;

  const toggleLeaf = (leaf, group, path, nextEnabled) => {
    if (!onFilterChange) return;
    onFilterChange(leaf.id, nextEnabled, {
      ...leaf,
      path,
      groupName: group.name,
      groupUrl: resolveGroupUrl(group, leaf),
      layer: resolveLayerHint(leaf),
      isFromStaticLayer: group.id === "static_layer",
    });
  };

  const toggleAllLeavesUnder = (nodes, group, parentPath, enable) => {
    const leaves = collectLeaves(nodes);
    leaves.forEach((leaf) => {
      const path = `${parentPath} / ${leaf.name}`;
      const isEnabled = enabledSet.has(String(leaf.id));
      if (enable && !isEnabled) toggleLeaf(leaf, group, path, true);
      if (!enable && isEnabled) toggleLeaf(leaf, group, path, false);
    });
  };

  const clearAllFilters = () => {
    const allGroups = [...geoserver, staticLayer];
    allGroups.forEach((group) =>
      toggleAllLeavesUnder(group.children || [], group, group.name, false),
    );
  };

  const enableAllFilters = () => {
    const allGroups = [...geoserver, staticLayer];
    allGroups.forEach((group) =>
      toggleAllLeavesUnder(group.children || [], group, group.name, true),
    );
  };

  const autoExpandOnceRef = useRef(false);
  useEffect(() => {
    if (geoserver.length === 0) return;
    if (autoExpandOnceRef.current) return;
    const groupsWithEnabled = new Set();
    const allGroups = [...geoserver, staticLayer];
    allGroups.forEach((group, idx) => {
      if (countEnabledLeaves(group.children || [], enabledSet) > 0)
        groupsWithEnabled.add(idx);
    });
    if (groupsWithEnabled.size > 0) {
      setExpandedGroups((prev) => {
        const next = new Set(prev);
        groupsWithEnabled.forEach((g) => next.add(g));
        return next;
      });
    }
    autoExpandOnceRef.current = true;
  }, [geoserver, enabledSet, countEnabledLeaves]);

  const renderLeaf = (leaf, group, path, color) => {
    const isEnabled = enabledSet.has(String(leaf.id));
    return (
      <LeafItem
        key={leaf.id}
        leaf={leaf}
        group={group}
        path={path}
        color={color}
        isEnabled={isEnabled}
        toggleLeaf={toggleLeaf}
      />
    );
  };

  const renderNode = (
    node,
    group,
    parentPath,
    color,
    depth,
    indexPath = "",
  ) => {
    const path = `${parentPath} / ${node.name}`;
    if (isLeaf(node)) return renderLeaf(node, group, path, color);

    const key = node?.id
      ? `id:${node.id}`
      : `${parentPath}#${indexPath || (node?.name ?? "group")}`;
    const state = triState(node.children || []);
    const checked = state === "all";
    const indeterminate = state === "some";
    const nodeOpen = expandedNodes.has(key);
    const subgroupEnabled = countEnabledLeaves(node.children || [], enabledSet);
    const totalLeaves = countLeaves(node.children || []);

    return (
      <Box key={key}>
        <ListItemButton
          onClick={() => toggleNodeExpanded(key)}
          sx={{
            py: 0.5,
            borderRadius: 1,
            mx: 1,
            borderLeft:
              subgroupEnabled > 0
                ? `2px solid ${color}`
                : "2px solid transparent",
            backgroundColor: subgroupEnabled > 0 ? `${color}08` : "transparent",
            "&:hover": { backgroundColor: `${color}12` },
          }}
        >
          <ListItemText
            sx={{
              alignItems: "center",
              display: { xs: "block", sm: "flex" },
              justifyContent: { sm: "space-between" },
            }}
            primary={
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1.25,
                  minWidth: 0,
                }}
              >
                <LayersIcon sx={{ fontSize: 16, color }} />
                <Typography
                  variant="body2"
                  fontWeight={700}
                  noWrap
                  title={node.name}
                  sx={{ minWidth: 0 }}
                >
                  {node.name}
                </Typography>
              </Box>
            }
            secondary={
              <Chip
                label={`${totalLeaves} анги`}
                size="small"
                color="success"
                variant="outlined"
              />
            }
          />

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              minWidth: 48,
              justifyContent: "flex-end",
            }}
          >
            <Checkbox
              edge="end"
              indeterminate={indeterminate}
              checked={checked}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                toggleAllLeavesUnder(
                  node.children || [],
                  group,
                  path,
                  e.target.checked,
                );
              }}
              size="small"
              sx={{ color, "&.Mui-checked": { color } }}
            />
          </Box>
        </ListItemButton>

        <Collapse in={nodeOpen} timeout="auto" unmountOnExit>
          <List dense sx={{ pl: depth + 1, py: 0 }}>
            {(node.children || []).map((child, idx) =>
              renderNode(
                child,
                group,
                path,
                color,
                depth + 1,
                `${indexPath}-${idx}`,
              ),
            )}
          </List>
        </Collapse>
      </Box>
    );
  };

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

            <IconButton size="small" onClick={handleClose} color="inherit">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box
            sx={{
              display: "flex",
              flex: 1,
              minHeight: 0,
              flexDirection: isSmall ? "column" : "row",
              height: "100%",
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                borderRight: isSmall ? "none" : "1px solid #f0f0f0",
                borderBottom: isSmall ? "1px solid #f0f0f0" : "none",
                width: isSmall ? "100%" : 56,
                bgcolor: "#fff",
                flexShrink: 0,
              }}
            >
              {/* Дээд талын tabs */}
              <Tabs
                orientation={isSmall ? "horizontal" : "vertical"}
                value={tab}
                onChange={handleTabChange}
                variant={isSmall ? "fullWidth" : "standard"}
                sx={{
                  flexGrow: 1,
                  "& .MuiTab-root": {
                    justifyContent: "center",
                    minHeight: 48,
                    margin: "0!important",
                  },
                }}
              >
                <Tab
                  value="layers"
                  id="geoserver-network"
                  icon={<LayersIcon sx={{ color: "#0675c9" }} />}
                />
                {isSmall && (
                  <Tab
                    value="basemap"
                    id="geoserver-basemap-mobile"
                    icon={<MapIcon />}
                    aria-label="basemap"
                  />
                )}
              </Tabs>

              {!isSmall && (
                <Tab
                  value="basemap"
                  id="geoserver-basemap-desktop"
                  icon={<MapIcon />}
                  onClick={(e) => handleTabChange(e, "basemap")}
                  selected={tab === "basemap"}
                  sx={{
                    justifyContent: "center",
                    minHeight: 48,
                    borderTop: "1px solid #f0f0f0",
                    bgcolor: "#fff",
                  }}
                />
              )}
            </Box>
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
              {tab === "layers" && (
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
                      sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}
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
                          size="small"
                          icon={
                            activeLayer ? (
                              <ActiveGeomIcon desc={activeLayer.desc} />
                            ) : (
                              <NoLayerIcon sx={{ fontSize: 16 }} />
                            )
                          }
                          label={activeLayer ? activeLayer.name : "Давхарга алга"}
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
                          size="small"
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
                          size="small"
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
                        size="small"
                        onClick={() =>
                          hasActive ? onStartPickPoint?.() : noActiveNotice()
                        }
                        sx={{ color: hasActive ? "#f59e0b" : "text.disabled" }}
                      >
                        <SelectFeatureIcon sx={{ fontSize: 20 }} />
                      </IconButton>
                    </Tooltip>
                    <IconButton
                      size="small"
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
                        size="small"
                        onClick={() => setSearchOpen((v) => !v)}
                        sx={{
                          color: searchOpen ? "#0675c9" : "text.secondary",
                        }}
                      >
                        <FilterIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Газар зүйн нэрийн зураг хэвлэх">
                      <IconButton
                        size="small"
                        onClick={() => setPrintOpen(true)}
                        sx={{ color: "#2e7d32" }}
                      >
                        <PrintIcon sx={{ fontSize: 20 }} />
                      </IconButton>
                    </Tooltip>
                    {addProjectId && (
                      <Tooltip title="Шинэ нэр нэмэх">
                        <IconButton
                          size="small"
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
                      />
                    ) : (
                      <NameCategoryTree
                        onToggle={handleNameToggle}
                        checkedSet={nameChecked}
                        filters={treeFilters}
                      />
                    )}
                  </Box>
                  <RasterPrintPanel
                    open={printOpen}
                    onClose={() => setPrintOpen(false)}
                  />
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
              {tab === "basemap" && (
                <Box sx={{ minHeight: 300, p: 1, overflowY: "auto" }}>
                  <Typography variant="h6">Суурь зураг сонгох</Typography>
                  <List dense>
                    {[
                      "CRV",
                      "OSM",
                      "GMS",
                      "ESRI",
                      "TOPO",
                      "M100k",
                      "M100kGeoName",
                    ].map((key) => {
                      const colorMap = {
                        CRV: "#1976d2",
                        OSM: "#4caf50",
                        GMS: "#ff9800",
                        ESRI: "#9c27b0",
                        TOPO: "#795548",
                        M100k: "#607d8b",
                        M100kGeoName: "#f44336",
                      };
                      const iconFor = (k) => {
                        if (k === "GMS" || k === "ESRI")
                          return <SatelliteIcon />;
                        if (k === "TOPO") return <TerrainIcon />;
                        if (k === "OSM") return <PublicIcon />;
                        return <MapIcon />;
                      };
                      const labelMap = {
                        CRV: "Voyager",
                        OSM: "OpenStreetMap",
                        GMS: "Google Satellite",
                        ESRI: "Esri Imagery",
                        TOPO: "Topographic",
                        M100kGeoName: "Нэрийн зураг",
                        M100k: "Байр зүй",
                      };
                      const selected = baseMap === key;
                      const color = colorMap[key] || "#607d8b";
                      return (
                        <ListItemButton
                          key={key}
                          selected={selected}
                          onClick={() => setBaseMap && setBaseMap(key)}
                          sx={{
                            borderLeft: selected
                              ? `3px solid ${color}`
                              : "3px solid transparent",
                            "&.Mui-selected": {
                              backgroundColor: `${color}12`,
                            },
                            "&:hover": { backgroundColor: `${color}08` },
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 40 }}>
                            <Avatar
                              variant="rounded"
                              sx={{
                                width: 32,
                                height: 32,
                                backgroundColor: `${color}18`,
                                color,
                              }}
                            >
                              {iconFor(key)}
                            </Avatar>
                          </ListItemIcon>
                          <ListItemText
                            primary={labelMap[key] || key}
                            secondary={key}
                          />
                        </ListItemButton>
                      );
                    })}
                  </List>
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
