import PropTypes from "prop-types";
import React, { useMemo, useState, useEffect, useCallback } from "react";

import {
  Box,
  Chip,
  Stack,
  Button,
  Switch,
  Checkbox,
  Collapse,
  Divider,
  TextField,
  Typography,
  IconButton,
  Autocomplete,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  FormControlLabel,
  CircularProgress,
} from "@mui/material";
import {
  Place as PointIcon,
  Timeline as LineIcon,
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  CropSquare as PolygonIcon,
  FolderOutlined as FolderIcon,
  MoreVert as MoreVertIcon,
  CenterFocusStrong as ZoomExtentIcon,
  TableChart as FeaturesIcon,
  Assessment as QualityIcon,
} from "@mui/icons-material";

import { useGetLegalUnits } from "src/api/legal";
import { useGetConstantsFordropdown } from "src/api/constant";
import axiosInstance, { endpoints } from "src/utils/axios";

const esc = (s) => String(s).replace(/'/g, "''");

// ----------------------------------------------------------------------
// Төслийн газрын зураг (champaign/<id>/map) — тухайн төслийн ReCount‑уудыг
// харуулах панел. ДЭЭД: GeoName‑тэй recount‑уудыг ангиллын (type) модоор
// бүлэглэж checkbox‑оор шүүнэ. ДООД: зөвхөн өөрийн geom‑той (draft) шинэ
// нэрсийн WMS‑ийг асаах/унтраах. Сонголтоос CQL бүрдүүлж onCql‑ээр буцаана.
// ----------------------------------------------------------------------

const GEOM = {
  Цэг: { icon: PointIcon, color: "#16a34a" },
  Шугам: { icon: LineIcon, color: "#2563eb" },
  Талбай: { icon: PolygonIcon, color: "#d97706" },
};

function NodeIcon({ desc }) {
  const g = GEOM[(desc || "").trim()];
  if (g) {
    const Ic = g.icon;
    return <Ic sx={{ fontSize: 18, color: g.color }} />;
  }
  return <FolderIcon sx={{ fontSize: 18, color: "#0675c9" }} />;
}
NodeIcon.propTypes = { desc: PropTypes.string };

// нэг node + түүний удмын бүх id‑г цуглуулна (cascade check)
function collectIds(node, acc) {
  acc.push(node.id);
  (node.children || []).forEach((c) => collectIds(c, acc));
  return acc;
}
// зөвхөн навч (child_count 0) id‑уудыг цуглуулна
function collectLeafIds(node, acc) {
  if (!node.children || node.children.length === 0) acc.push(node.id);
  else node.children.forEach((c) => collectLeafIds(c, acc));
  return acc;
}

function TreeNode({
  node,
  level,
  checkedSet,
  onToggle,
  onNodeMenu,
  expandSignal,
  activeId,
  onActivate,
}) {
  const [open, setOpen] = useState(level === 0);
  // Тоолбарын "бүгдийг задлах/хураах" дохио
  useEffect(() => {
    if (!expandSignal?.n) return;
    setOpen(expandSignal.mode === "expand");
  }, [expandSignal]);
  const hasKids = (node.children || []).length > 0;
  const checked = checkedSet.has(node.id);
  const descLeaves = collectLeafIds(node, []);
  const someChecked = descLeaves.some((id) => checkedSet.has(id));
  const indeterminate = !checked && someChecked;

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          pl: level * 2 + 0.5,
          py: 0.15,
          borderRadius: 1,
          cursor: "pointer",
          bgcolor: activeId === node.id ? "#0675c91f" : "transparent",
          "&:hover": { bgcolor: "#0675c90d" },
        }}
        onClick={() => onActivate?.(node)}
      >
        {hasKids ? (
          <IconButton
            size="small"
            sx={{ p: 0.25 }}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <ExpandMoreIcon sx={{ fontSize: 18 }} />
            ) : (
              <ChevronRightIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        ) : (
          <Box sx={{ width: 26, flexShrink: 0 }} />
        )}

        <Checkbox
          size="small"
          checked={checked}
          indeterminate={indeterminate}
          onChange={(e) => onToggle(node, e.target.checked)}
          sx={{ p: 0.25 }}
        />
        <Box sx={{ display: "inline-flex", mx: 0.5 }}>
          <NodeIcon desc={node.desc} />
        </Box>
        <Typography
          variant="body2"
          sx={{
            flexGrow: 1,
            minWidth: 0,
            fontWeight: level === 0 ? 600 : 400,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {node.name}
        </Typography>
        <Chip
          size="small"
          label={`${node.count ?? 0}`}
          sx={{
            height: 18,
            fontSize: 11,
            fontWeight: 600,
            color: "#0675c9",
            bgcolor: "#0675c914",
          }}
        />
        {/* Мөрийн 3 цэгийн цэс — Zoom / Feature table / Чанарын шалгалт */}
        {onNodeMenu && (
          <IconButton
            size="small"
            sx={{ p: 0.25, ml: 0.25 }}
            onClick={(e) => onNodeMenu(e.currentTarget, node)}
          >
            <MoreVertIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
      </Box>

      {hasKids && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          {node.children.map((c) => (
            <TreeNode
              key={c.id}
              node={c}
              level={level + 1}
              checkedSet={checkedSet}
              onToggle={onToggle}
              onNodeMenu={onNodeMenu}
              expandSignal={expandSignal}
              activeId={activeId}
              onActivate={onActivate}
            />
          ))}
        </Collapse>
      )}
    </>
  );
}
TreeNode.propTypes = {
  onNodeMenu: PropTypes.func,
  expandSignal: PropTypes.object,
  activeId: PropTypes.number,
  onActivate: PropTypes.func,
  node: PropTypes.object,
  level: PropTypes.number,
  checkedSet: PropTypes.object,
  onToggle: PropTypes.func,
};

const EMPTY_SEARCH = {
  name: "",
  number: "",
  aimag: null,
  sum: null,
  bag: null,
  nomek: "",
  border: false,
};

export default function RecountPanel({
  projectId,
  onCql,
  searchOpen,
  // Ангиллын мөрийн 3 цэгийн цэсийн үйлдэл: (node, action) —
  // action: "zoom" | "features" | "quality"
  onNodeAction,
}) {
  // Мөрийн цэсний anchor + сонгосон ангилал
  const [nodeMenu, setNodeMenu] = useState(null);
  const openNodeMenu = useCallback((anchor, node) => {
    setNodeMenu({ anchor, node });
  }, []);
  const runNodeAction = (action) => {
    const node = nodeMenu?.node;
    setNodeMenu(null);
    if (node && onNodeAction) onNodeAction(node, action);
  };
  const [roots, setRoots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false); // мод НЭГ УДАА ачаалагдсан эсэх
  const [checkedSet, setCheckedSet] = useState(() => new Set());
  const [reloadNonce, setReloadNonce] = useState(0); // recount хадгалсны дараа refetch

  // recount хадгалах/устгах бүрд type‑модыг дахин татна (шинэ type орж ирнэ)
  useEffect(() => {
    const h = () => setReloadNonce((n) => n + 1);
    window.addEventListener("recount:changed", h);
    return () => window.removeEventListener("recount:changed", h);
  }, []);

  // Хайлтын талбарууд (тооллогод зориулсан — recount_view‑ийн баганаар CQL)
  const [sf, setSf] = useState(EMPTY_SEARCH);
  const [statusChecked, setStatusChecked] = useState(() => new Set());
  const { constants: statuses } = useGetConstantsFordropdown("RECOUNT_STATUS");
  const { units: aimagOptions } = useGetLegalUnits("Аймаг", null, true);
  const { units: sumOptions } = useGetLegalUnits(
    "Сум",
    sf.aimag?.id,
    !!sf.aimag?.id,
  );
  const { units: bagOptions } = useGetLegalUnits(
    "Баг",
    sf.sum?.id,
    !!sf.sum?.id,
  );

  // type‑tree ачаална — хайлтын филтэр өөрчлөгдөх бүрд (debounce) дахин татаж,
  // модны тоог шүүлттэй уялдуулна.
  useEffect(() => {
    if (!projectId) return undefined;
    let active = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = { project: projectId };
        if (sf.name.trim()) params.name = sf.name.trim();
        if (sf.number.trim()) params.number = sf.number.trim();
        const unitId = sf.bag?.id || sf.sum?.id || sf.aimag?.id;
        if (unitId) params.unit = unitId;
        if (sf.nomek.trim()) params.nomek = sf.nomek.trim();
        if (sf.border) params.border = "1";
        if (statusChecked.size) params.status = [...statusChecked].join(",");
        const q = new URLSearchParams(params).toString();
        const res = await axiosInstance.get(endpoints.recount.typeTree(q));
        if (!active) return;
        const data = res?.data || {};
        setRoots(data.results || []);
        setLoaded(true);
        // шүүлтэд тохирсон БҮХ зангилаа сонгогдоно (мод + газрын зураг уялдана)
        const all = new Set();
        (data.results || []).forEach((n) =>
          collectIds(n, []).forEach((id) => all.add(id)),
        );
        setCheckedSet(all);
      } finally {
        if (active) setLoading(false);
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [projectId, sf, statusChecked, statuses, reloadNonce]);

  // сонгосон навчийн type_id‑ууд
  const leafIds = useMemo(() => {
    const ids = [];
    roots.forEach((n) =>
      collectLeafIds(n, []).forEach((id) => {
        if (checkedSet.has(id)) ids.push(id);
      }),
    );
    return ids;
  }, [roots, checkedSet]);

  // Ангилал(type)/draft + хайлтын талбаруудаас нэгдсэн CQL бүрдүүлж дамжуулна
  useEffect(() => {
    // Мод НЭГ Ч УДАА ачаалагдаагүй бол шүүлтгүй (эхэнд бүх recount). Ачаалагдсаны
    // дараа мод ХООСОН ч (ж: зөвхөн "шинэ" draft) шүүлтийг хэвийн бүрдүүлнэ.
    if (!loaded) {
      onCql?.(null);
      return;
    }
    // Мод дээр ангилал байгаа ч НЭГ Ч сонгоогүй бол юу ч харуулахгүй
    const hasAnyLeaf = roots.some((n) => collectLeafIds(n, []).length > 0);
    if (hasAnyLeaf && leafIds.length === 0) {
      onCql?.("1=0");
      return;
    }
    const typeOr = [];
    if (leafIds.length) typeOr.push(`type_id IN (${leafIds.join(",")})`);
    // Draft‑ууд (type_id IS NULL) нь ангилалгүй тул үргэлж type‑д тэнцэнэ —
    // тэдгээрийг Төлөв (status "шинэ"/"батлагдаагүй") шүүлт удирдана.
    typeOr.push("type_id IS NULL");
    const conds = [`(${typeOr.join(" OR ")})`];
    if (sf.name.trim()) conds.push(`name ILIKE '%${esc(sf.name.trim())}%'`);
    if (sf.number.trim())
      conds.push(`number ILIKE '%${esc(sf.number.trim())}%'`);
    const unitId = sf.bag?.id || sf.sum?.id || sf.aimag?.id;
    if (unitId) conds.push(`unit_ids LIKE '% ${unitId} %'`);
    if (sf.nomek.trim())
      conds.push(`nomek_codes ILIKE '%${esc(sf.nomek.trim())}%'`);
    if (sf.border) conds.push("is_border = true");
    if (statusChecked.size) {
      // Олон-төлөв: status_ids (' 1220 1221 ')‑д аль нэг нь байвал тохирно
      const parts = [...statusChecked].map(
        (id) => `status_ids LIKE '% ${id} %'`,
      );
      conds.push(`(${parts.join(" OR ")})`);
    }
    onCql?.(conds.join(" AND "));
  }, [loaded, roots, leafIds, sf, statusChecked, statuses, onCql]);

  const toggleStatus = (id, on) => {
    setStatusChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearSearch = () => {
    setSf(EMPTY_SEARCH);
    setStatusChecked(new Set());
  };

  // Тоолбарын үйлдлүүд (Удирдлага панелийн дээд мөр) — event‑ээр ирнэ
  const [expandSignal, setExpandSignal] = useState({ n: 0, mode: "expand" });
  // ЗӨВХӨН 3‑р түвшний (навч) ангиллыг ДАВХАРГА гэж үзнэ.
  // 1/2‑р түвшин нь бүлэг (layer group) тул идэвхтэй давхарга болохгүй.
  const [activeNode, setActiveNode] = useState(null);
  const activeId = activeNode?.id || null;
  const activeIsLayer = !!activeNode && !(activeNode.children || []).length;
  // Идэвхтэй ангиллыг тоолбарт мэдэгдэнэ (товчнуудыг идэвхжүүлэх/унтраах)
  useEffect(() => {
    // Идэвхтэй ДАВХАРГА = навч (level3) + ХАРАГДАЖ буй (checked)
    window.dispatchEvent(
      new CustomEvent("recount:active", {
        detail: {
          id: activeIsLayer && checkedSet.has(activeId) ? activeId : null,
          name:
            activeIsLayer && checkedSet.has(activeId) ? activeNode.name : null,
          desc:
            activeIsLayer && checkedSet.has(activeId) ? activeNode.desc : null,
          isGroup: !!activeNode && !activeIsLayer,
          checkedCount: checkedSet.size,
        },
      }),
    );
  }, [activeId, activeIsLayer, activeNode, checkedSet]);

  // Модны дараалал = газрын зураг дээрх ЗУРАГДАХ дараалал. Жагсаалтын ДООД
  // талынх нь дээр зурагдана (сүүлд зурагдана) — map2 руу event‑ээр дамжуулна.
  const emitOrder = useCallback((tree) => {
    const order = [];
    const walk = (nodes) =>
      (nodes || []).forEach((n) => {
        order.push(n.id);
        walk(n.children);
      });
    walk(tree);
    window.dispatchEvent(
      new CustomEvent("recount:order", { detail: { order } }),
    );
  }, []);

  // Идэвхтэй зангилааг ах/дүү нарынх нь дунд дээш/доош зөөнө
  const moveActive = useCallback(
    (dir) => {
      if (!activeId) return;
      setRoots((prev) => {
        const clone = JSON.parse(JSON.stringify(prev));
        const move = (list) => {
          const i = list.findIndex((n) => n.id === activeId);
          if (i >= 0) {
            const j = i + dir;
            if (j < 0 || j >= list.length) return true;
            const [it] = list.splice(i, 1);
            list.splice(j, 0, it);
            return true;
          }
          return list.some((n) => n.children && move(n.children));
        };
        move(clone);
        emitOrder(clone);
        return clone;
      });
    },
    [activeId, emitOrder],
  );

  useEffect(() => {
    const showAll = () => {
      const all = new Set();
      roots.forEach((n) => collectIds(n, []).forEach((id) => all.add(id)));
      setCheckedSet(all);
    };
    const hideAll = () => setCheckedSet(new Set());
    const up = () => moveActive(-1);
    const down = () => moveActive(1);
    window.addEventListener("recount:showAll", showAll);
    window.addEventListener("recount:hideAll", hideAll);
    window.addEventListener("recount:moveUp", up);
    window.addEventListener("recount:moveDown", down);
    return () => {
      window.removeEventListener("recount:showAll", showAll);
      window.removeEventListener("recount:hideAll", hideAll);
      window.removeEventListener("recount:moveUp", up);
      window.removeEventListener("recount:moveDown", down);
    };
  }, [roots, moveActive]);

  const handleToggle = useCallback((node, checked) => {
    setCheckedSet((prev) => {
      const next = new Set(prev);
      const ids = collectIds(node, []);
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  }, []);

  const unitAc = (label, value, options, disabled, onPick) => (
    <Autocomplete
      size="small"
      fullWidth
      value={value}
      options={options || []}
      disabled={disabled}
      onChange={(_e, v) => onPick(v)}
      getOptionLabel={(o) => o?.unit || o?.name || ""}
      isOptionEqualToValue={(o, v) => o?.id === v?.id}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );

  return (
    <Box sx={{ py: 0.5 }}>
      {/* Тооллогын хайлт — филтер icon (searchOpen)‑оор нээгдэнэ */}
      <Collapse in={!!searchOpen} timeout="auto" unmountOnExit>
        <Stack spacing={1} sx={{ px: 1, pb: 1.5 }}>
          <Typography variant="overline" color="text.secondary">
            Төлөв
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            <FormControlLabel
              sx={{ mr: 1 }}
              control={
                <Checkbox
                  size="small"
                  checked={statusChecked.size === 0}
                  onChange={(e) => {
                    if (e.target.checked) setStatusChecked(new Set());
                  }}
                />
              }
              label={
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Бүгд
                </Typography>
              }
            />
            {(statuses || []).map((s) => (
              <FormControlLabel
                key={s.id}
                sx={{ mr: 1 }}
                control={
                  <Checkbox
                    size="small"
                    checked={statusChecked.has(s.id)}
                    onChange={(e) => toggleStatus(s.id, e.target.checked)}
                  />
                }
                label={<Typography variant="body2">{s.name}</Typography>}
              />
            ))}
          </Box>
          <TextField
            size="small"
            label="Нэр"
            value={sf.name}
            onChange={(e) => setSf((p) => ({ ...p, name: e.target.value }))}
          />
          <TextField
            size="small"
            label="Дугаар"
            value={sf.number}
            onChange={(e) => setSf((p) => ({ ...p, number: e.target.value }))}
          />
          <Typography variant="overline" color="text.secondary">
            Засаг захиргааны нэгж
          </Typography>
          {unitAc("Аймаг / Нийслэл", sf.aimag, aimagOptions, false, (v) =>
            setSf((p) => ({ ...p, aimag: v, sum: null, bag: null })),
          )}
          {unitAc("Сум / Дүүрэг", sf.sum, sumOptions, !sf.aimag?.id, (v) =>
            setSf((p) => ({ ...p, sum: v, bag: null })),
          )}
          {unitAc("Баг / Хороо", sf.bag, bagOptions, !sf.sum?.id, (v) =>
            setSf((p) => ({ ...p, bag: v })),
          )}
          <TextField
            size="small"
            label="Нэрлэвэр"
            value={sf.nomek}
            onChange={(e) => setSf((p) => ({ ...p, nomek: e.target.value }))}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={sf.border}
                onChange={(e) =>
                  setSf((p) => ({ ...p, border: e.target.checked }))
                }
              />
            }
            label={<Typography variant="body2">Хилийн цэс</Typography>}
          />

          <Button size="small" variant="outlined" onClick={clearSearch}>
            Цэвэрлэх
          </Button>
        </Stack>
        <Divider />
      </Collapse>

      <Box sx={{ px: 0.5 }}>
        {loading ? (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <CircularProgress size={22} />
          </Box>
        ) : roots.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            GeoName‑тэй тодруулалт алга.
          </Typography>
        ) : (
          roots.map((n) => (
            <TreeNode
              key={n.id}
              node={n}
              level={0}
              checkedSet={checkedSet}
              onToggle={handleToggle}
              onNodeMenu={onNodeAction ? openNodeMenu : null}
              expandSignal={expandSignal}
              activeId={activeId}
              onActivate={setActiveNode}
            />
          ))
        )}
      </Box>

      {/* Ангиллын мөрийн цэс — Zoom / Attribute (таб) / Чанарын шалгалт */}
      <Menu
        anchorEl={nodeMenu?.anchor}
        open={Boolean(nodeMenu)}
        onClose={() => setNodeMenu(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { minWidth: 210 } } }}
      >
        <MenuItem onClick={() => runNodeAction("zoom")}>
          <ListItemIcon>
            <ZoomExtentIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText>Zoom to Layer</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => runNodeAction("features")}>
          <ListItemIcon>
            <FeaturesIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText>Attribute хүснэгт</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => runNodeAction("quality")}>
          <ListItemIcon>
            <QualityIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText>Чанарын шалгалт</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}

RecountPanel.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onCql: PropTypes.func,
  searchOpen: PropTypes.bool,
  onNodeAction: PropTypes.func,
};
