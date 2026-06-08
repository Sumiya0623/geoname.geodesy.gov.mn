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
  CircularProgress,
  Tabs,
  Tab,
  useMediaQuery,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  FilterList as FilterIcon,
  Layers as LayersIcon,
  FiberManualRecord as DotIcon,
  Close as CloseIcon,
  Satellite as SatelliteIcon,
  Map as MapIcon,
  Terrain as TerrainIcon,
  Public as PublicIcon,
  ShoppingCart as ShoppingCartIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Link as LinkIcon,
  LayersClearRounded as ClearLayersIcon,
} from "@mui/icons-material";

import { useGetGeoserver } from "src/api/map";
import OrderDialog from "src/sections/order/order-dialog";
import NameCategoryTree from "./NameCategoryTree";
import AdvancedSearch from "./AdvancedSearch";

// geoname:geoname_view (бүх геонэр) WMS суурь URL — Нэрийн ангилал филтерт
const GEONAME_VIEW_URL = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/geoname/wms?service=WMS&version=1.1.0&request=GetMap&bbox=87,41,120,52&layers=geoname:geoname_view&srs=EPSG:4326&width=768&height=330&format=image/png`;

const isLeaf = (node) => !node?.children || node.children.length === 0;

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
  orderPage,
  setOrderPage,
  orderRowsPerPage,
  setOrderRowsPerPage,
  orderData,
  ordersLoading,
  ordersCount,
  onFlyTo,
  onPanelClose,
  geonameSearchTerm,
  scaleDenom,
}) {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));
  const [open, setOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set([0]));
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [tab, setTab] = useState("layers");

  // forceOpen‑ийг бодит open төлөвтэй синк (толгойн товч toggle хийнэ)
  useEffect(() => {
    setOpen(forceOpen);
    if (forceOpen && forceTab !== null) {
      setTab(forceTab);
    }
  }, [forceOpen, forceTab]);
  const [expandedOrderRows, setExpandedOrderRows] = useState(new Set());

  // Order dialog state
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [layerGroups, setLayerGroups] = useState([]);

  // Нэрийн ангилал (GEONAME_TYPES) — идэвхжсэн ангиллын id‑ууд
  const [nameChecked, setNameChecked] = useState(() => new Set());
  // Дэлгэрэнгүй хайлтын формыг ангиллын дээр харуулах эсэх
  const [searchOpen, setSearchOpen] = useState(false);

  // Толгойн хайлтаас (илэрц 1‑с их) ирвэл дэлгэрэнгүй формыг нээнэ
  useEffect(() => {
    if (geonameSearchTerm?.term) setSearchOpen(true);
  }, [geonameSearchTerm]);

  const handleNameToggle = useCallback(
    (node, enabled) => {
      setNameChecked((prev) => {
        const next = new Set(prev);
        if (enabled) next.add(node.id);
        else next.delete(node.id);
        return next;
      });
      if (!onFilterChange) return;
      const fid = `name_${node.id}`;
      onFilterChange(fid, enabled, {
        id: fid,
        name: node.name,
        layer: "geoname:geoname_view",
        // type массив [type_l2, type_id] дотор энэ id байгааг (бүх түвшинд) шүүнэ
        cql_filter: `type_l1=${node.id} OR type_l2=${node.id} OR type_id=${node.id}`,
        groupUrl: GEONAME_VIEW_URL,
        isFromStaticLayer: false,
      });
    },
    [onFilterChange],
  );

  const handleClearNames = useCallback(() => {
    if (onFilterChange) {
      nameChecked.forEach((id) =>
        onFilterChange(`name_${id}`, false, { id: `name_${id}` }),
      );
    }
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

  const handleOrderPageChange = (event, newPage) => {
    setOrderPage(newPage);
  };

  const handleOrderRowsPerPageChange = (event) => {
    setOrderRowsPerPage(parseInt(event.target.value, 10));
    setOrderPage(0);
  };

  const toggleOrderRowExpanded = (orderId) => {
    const next = new Set(expandedOrderRows);
    if (next.has(orderId)) next.delete(orderId);
    else next.add(orderId);
    setExpandedOrderRows(next);
  };

  // Order dialog handlers
  const handleOrderDialogOpen = (order) => {
    setSelectedOrder(order);
    setOrderDialogOpen(true);
  };

  const handleOrderDialogClose = () => {
    setOrderDialogOpen(false);
    setSelectedOrder(null);
  };

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
            bottom: 0,
            zIndex: 1201,
            width: isSmall ? "100dvw" : 440,
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
                <Tab
                  value="orders"
                  id="geoserver-cart"
                  icon={<ShoppingCartIcon sx={{ color: "#4caf50" }} />}
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
                    <Typography variant="subtitle2" sx={{ color: "#0675c9" }}>
                      Газар зүйн нэрийн ангилал
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <Tooltip title="Идэвхтэй ангиллыг цэвэрлэх">
                        <span>
                          <IconButton
                            size="small"
                            onClick={handleClearNames}
                            disabled={nameChecked.size === 0}
                            sx={{ color: "#d32f2f" }}
                          >
                            <ClearLayersIcon sx={{ fontSize: 20 }} />
                          </IconButton>
                        </span>
                      </Tooltip>
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
                    </Box>
                  </Box>
                  <Collapse in={searchOpen} timeout="auto" unmountOnExit>
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
                    />
                  </Collapse>
                  <Box sx={{ flex: 1, overflowY: "auto", px: 0.5 }}>
                    <NameCategoryTree
                      onToggle={handleNameToggle}
                      checkedSet={nameChecked}
                    />
                  </Box>
                  <Divider />
                  <Box sx={{ p: 1.5, textAlign: "center", flexShrink: 0 }}>
                    <Typography variant="caption" color="text.secondary">
                      {nameChecked.size} ангилал идэвхтэй
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
                    {["CRV", "OSM", "GMS", "ESRI", "TOPO", "M100k"].map(
                      (key) => {
                        const colorMap = {
                          CRV: "#1976d2",
                          OSM: "#4caf50",
                          GMS: "#ff9800",
                          ESRI: "#9c27b0",
                          TOPO: "#795548",
                          M100k: "#607d8b",
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
                      },
                    )}
                  </List>
                </Box>
              )}
              {tab === "orders" && (
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ p: 1, fontSize: "0.9rem" }}>
                    Худалдан авалт
                  </Typography>
                  <TableContainer sx={{ maxHeight: 450 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell
                            sx={{ fontSize: "0.75rem", py: 1, width: 20 }}
                          ></TableCell>
                          <TableCell sx={{ fontSize: "0.75rem", py: 1 }}>
                            №
                          </TableCell>
                          <TableCell sx={{ fontSize: "0.75rem", py: 1 }}>
                            Тоо
                          </TableCell>
                          <TableCell sx={{ fontSize: "0.75rem", py: 1 }}>
                            Төлбөр
                          </TableCell>
                          <TableCell sx={{ fontSize: "0.75rem", py: 1 }}>
                            Төлөв
                          </TableCell>
                          <TableCell
                            sx={{ fontSize: "0.75rem", py: 1, width: 60 }}
                          >
                            Үйлдэл
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {ordersLoading ? (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              align="center"
                              sx={{ py: 2 }}
                            >
                              <CircularProgress size={20} />
                            </TableCell>
                          </TableRow>
                        ) : orderData && orderData.length > 0 ? (
                          orderData.map((order, index) => {
                            const isPaid =
                              order.status?.name &&
                              order.status?.name.toLowerCase() === "төлсөн";
                            return (
                              <React.Fragment key={order.id}>
                                <TableRow hover>
                                  <TableCell
                                    sx={{ fontSize: "0.75rem", py: 0.5, px: 1 }}
                                  >
                                    <IconButton
                                      size="small"
                                      onClick={() =>
                                        toggleOrderRowExpanded(order.id)
                                      }
                                      sx={{ p: 0.5 }}
                                    >
                                      {expandedOrderRows.has(order.id) ? (
                                        <ExpandLessIcon fontSize="small" />
                                      ) : (
                                        <ExpandMoreIcon fontSize="small" />
                                      )}
                                    </IconButton>
                                  </TableCell>
                                  <TableCell
                                    sx={{ fontSize: "0.75rem", py: 0.5 }}
                                  >
                                    {orderPage * orderRowsPerPage + index + 1}
                                  </TableCell>
                                  <TableCell
                                    sx={{ fontSize: "0.75rem", py: 0.5 }}
                                  >
                                    {order.items.length}
                                  </TableCell>
                                  <TableCell
                                    sx={{ fontSize: "0.75rem", py: 0.5 }}
                                  >
                                    {order.subtotal || "0"}₮
                                  </TableCell>
                                  <TableCell
                                    sx={{ fontSize: "0.75rem", py: 0.5 }}
                                  >
                                    <Chip
                                      label={order.status?.name || "unknown"}
                                      size="small"
                                      variant="outlined"
                                      color={order?.status?.color || "default"}
                                      sx={{
                                        fontSize: "0.65rem",
                                        height: 20,
                                        "& .MuiChip-label": { px: 1 },
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell
                                    sx={{
                                      display: "flex",
                                      fontSize: "0.75rem",
                                      py: 0.5,
                                    }}
                                  >
                                    {isPaid ? null : (
                                      <Tooltip title="Төлбөр төлөх">
                                        <IconButton
                                          size="small"
                                          onClick={() =>
                                            handleOrderDialogOpen(order)
                                          }
                                          sx={{ p: 0.5 }}
                                          color="primary"
                                        >
                                          <ShoppingCartIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                    <Tooltip title="Дэлгэрэнгүй">
                                      <IconButton
                                        size="small"
                                        sx={{ p: 0.5 }}
                                        color="primary"
                                        href={`/dashboard/order/${order.id}`}
                                        target="_blank"
                                      >
                                        <LinkIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </TableCell>
                                </TableRow>

                                <TableRow>
                                  <TableCell
                                    sx={{ py: 0, border: 0 }}
                                    colSpan={6}
                                  >
                                    <Collapse
                                      in={expandedOrderRows.has(order.id)}
                                      timeout="auto"
                                      unmountOnExit
                                    >
                                      <Box
                                        sx={{
                                          margin: 1,
                                          p: 1,
                                          bgcolor: "grey.50",
                                          borderRadius: 1,
                                        }}
                                      >
                                        {order.items &&
                                          Array.isArray(order.items) && (
                                            <>
                                              <Typography
                                                variant="body2"
                                                sx={{
                                                  fontSize: "0.65rem",
                                                  mb: 0.5,
                                                  fontWeight: "bold",
                                                }}
                                              >
                                                Цэгүүд:
                                              </Typography>
                                              {order.items
                                                .slice(0, 3)
                                                .map((item, idx) => (
                                                  <Typography
                                                    key={item.id}
                                                    variant="body2"
                                                    sx={{ mb: 0.25, pl: 1 }}
                                                  >
                                                    • {item.point.name} (
                                                    {item.point.number}) -{" "}
                                                    {parseFloat(
                                                      item.unit_price,
                                                    ).toLocaleString()}
                                                    ₮
                                                  </Typography>
                                                ))}
                                              {order.items.length > 3 && (
                                                <Typography
                                                  variant="body2"
                                                  sx={{
                                                    pl: 1,
                                                    fontStyle: "italic",
                                                  }}
                                                >
                                                  ... болон{" "}
                                                  {order.items.length - 3} цэг
                                                </Typography>
                                              )}
                                            </>
                                          )}
                                      </Box>
                                    </Collapse>
                                  </TableCell>
                                </TableRow>
                              </React.Fragment>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              align="center"
                              sx={{ py: 2, fontSize: "0.75rem" }}
                            >
                              Захиалга байхгүй
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <TablePagination
                    component="div"
                    count={ordersCount || 0}
                    page={orderPage}
                    onPageChange={handleOrderPageChange}
                    rowsPerPage={orderRowsPerPage}
                    onRowsPerPageChange={handleOrderRowsPerPageChange}
                    rowsPerPageOptions={[5, 10, 15]}
                    labelRowsPerPage="Хуудсанд:"
                    labelDisplayedRows={({ from, to, count }) =>
                      `${from}-${to} / ${count !== -1 ? count : `${to}-аас олон`}`
                    }
                    sx={{
                      "& .MuiTablePagination-toolbar": {
                        fontSize: "0.75rem",
                        minHeight: 40,
                      },
                      "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows":
                        {
                          fontSize: "0.75rem",
                        },
                    }}
                  />
                </Box>
              )}
            </Box>
          </Box>
        </Paper>
      )}

      {/* Order Dialog */}
      <OrderDialog
        open={orderDialogOpen}
        onClose={handleOrderDialogClose}
        item={selectedOrder}
      />
    </Box>
  );
}

export default GeoserverDialog;
