import PropTypes from "prop-types";
import React, {
  useRef,
  useMemo,
  useState,
  useEffect,
  useCallback,
} from "react";

import {
  Box,
  Chip,
  Stack,
  Checkbox,
  Collapse,
  TextField,
  Typography,
  IconButton,
  InputAdornment,
  CircularProgress,
} from "@mui/material";
import {
  Search as SearchIcon,
  Place as PlaceIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Public as AimagIcon,
  AccountBalance as SumIcon,
} from "@mui/icons-material";

import axiosInstance, { endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------
// Тодруулалтын сан — БҮХ recount‑ыг Засаг захиргааны нэгжээр (Аймаг → Сум →
// recount нэр) модлон харуулна. Навч (recount) сонгоход газрын зурагт
// тодруулах CQL (id IN ...)‑г onCql‑ээр буцаана. Батлагдсан нэрсийн map‑ийн
// 2‑р таб (project‑гүй, бүх recount).
// ----------------------------------------------------------------------

// node + удмын бүх id (cascade check)
function collectIds(node, acc) {
  acc.push(node.id);
  (node.children || []).forEach((c) => collectIds(c, acc));
  return acc;
}
// зөвхөн навчийн recount_id‑ууд
function collectRecountIds(node, acc) {
  if (node.recount_id != null) acc.push(node.recount_id);
  (node.children || []).forEach((c) => collectRecountIds(c, acc));
  return acc;
}

function LevelIcon({ level }) {
  if (level === 0) return <AimagIcon sx={{ fontSize: 18, color: "#0675c9" }} />;
  if (level === 1) return <SumIcon sx={{ fontSize: 17, color: "#7c3aed" }} />;
  return <PlaceIcon sx={{ fontSize: 16, color: "#16a34a" }} />;
}
LevelIcon.propTypes = { level: PropTypes.number };

function TreeNode({ node, level, stopLevel, checkedSet, onToggle }) {
  const [open, setOpen] = useState(level === 0);
  const hasKids = (node.children || []).length > 0;
  // stopLevel хүртэл л задарна (ж: 1 → Аймаг→Сум, сумаас доош нэрсээр задрахгүй)
  const canExpand = hasKids && level < stopLevel;
  const checked = checkedSet.has(node.id);
  const leafIds = collectIds(node, []).filter((id) => id !== node.id);
  const someChecked = leafIds.some((id) => checkedSet.has(id));
  const indeterminate = !checked && someChecked;

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          pl: level * 1.75 + 0.5,
          py: 0.15,
          borderRadius: 1,
          "&:hover": { bgcolor: "#0675c90d" },
        }}
      >
        {canExpand ? (
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
          <LevelIcon level={level} />
        </Box>
        <Typography
          variant="body2"
          onClick={() => canExpand && setOpen((v) => !v)}
          sx={{
            flexGrow: 1,
            minWidth: 0,
            cursor: canExpand ? "pointer" : "default",
            fontWeight: level === 0 ? 600 : 400,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {node.name}
        </Typography>
        {/* Аймаг БОЛОН сум хоёуланд нь тодруулалтын тоог харуулна */}
        <Chip
          size="small"
          label={`${node.count ?? 0}`}
          sx={{
            height: 18,
            fontSize: 11,
            fontWeight: 600,
            color: level === 0 ? "#0675c9" : "#7c3aed",
            bgcolor: level === 0 ? "#0675c914" : "#7c3aed14",
          }}
        />
      </Box>

      {canExpand && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          {node.children.map((c) => (
            <TreeNode
              key={c.id}
              node={c}
              level={level + 1}
              stopLevel={stopLevel}
              checkedSet={checkedSet}
              onToggle={onToggle}
            />
          ))}
        </Collapse>
      )}
    </>
  );
}
TreeNode.propTypes = {
  node: PropTypes.object,
  level: PropTypes.number,
  stopLevel: PropTypes.number,
  checkedSet: PropTypes.object,
  onToggle: PropTypes.func,
};

export default function RecountUnitTree({ onCql, onFlyTo }) {
  const [roots, setRoots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState("");
  const [checkedSet, setCheckedSet] = useState(() => new Set());

  // Мод ачаална — нэрээр (debounce) шүүнэ
  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = {};
        if (term.trim()) params.name = term.trim();
        const q = new URLSearchParams(params).toString();
        const res = await axiosInstance.get(endpoints.recount.unitTree(q));
        if (!active) return;
        setRoots(res?.data?.results || []);
      } catch {
        if (active) setRoots([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [term]);

  const onFlyToRef = useRef(onFlyTo);
  onFlyToRef.current = onFlyTo;

  // node + удам бүхэлдээ check/uncheck (cascade)
  const onToggle = useCallback((node, on) => {
    const ids = collectIds(node, []);
    setCheckedSet((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
    // Аймаг (a<id>) эсвэл сум (s<id>) чагтлахад тухайн нэгж рүү нисэх.
    // Өмнө нь ЗӨВХӨН сум дээр ниснэ гэсэн нөхцөлтэй байсан тул аймгийн
    // чагтыг дарахад (сумууд нь cascade‑аар сонгогдоно) газрын зураг хөдөлдөггүй
    // байсан — иймд тодруулалт зурагдсан ч харагдахгүй байв.
    const m = typeof node.id === "string" ? node.id.match(/^[as](\d+)$/) : null;
    if (on && m) {
      const unitId = m[1];
      axiosInstance
        .get(endpoints.legal.unitExtent(unitId))
        .then((res) => {
          const ext = res?.data?.extent;
          if (ext && ext.length === 4) onFlyToRef.current?.({ bbox: ext });
        })
        .catch(() => {});
    }
  }, []);

  // Сонгосон СУМ‑ын нэгж id‑ээр шүүнэ. (170 recount id‑тэй `id IN (...)` нь WMS
  // GET URL‑ийг хэт уртасгаж хүсэлт бүтэлгүйтдэг → хоосон зураг. recount_view.unit_ids
  // дотор тухайн сумын adminunit_id багтдаг тул `unit_ids LIKE '% id %'` богино бас зөв.)
  const selectedSums = useMemo(
    () =>
      [...checkedSet].filter(
        (id) => typeof id === "string" && id.startsWith("s"),
      ),
    [checkedSet],
  );
  const cql = selectedSums.length
    ? selectedSums.map((s) => `unit_ids LIKE '% ${s.slice(1)} %'`).join(" OR ")
    : null;

  // Сонгосон тодруулалтын тоо (сонгосон сумуудын count нийлбэр)
  const selectedCount = useMemo(() => {
    let c = 0;
    roots.forEach((a) =>
      (a.children || []).forEach((s) => {
        if (checkedSet.has(s.id)) c += s.count || 0;
      }),
    );
    return c;
  }, [roots, checkedSet]);

  // onCql‑ийг ref‑ээр авна (parent функцийн identity өөрчлөгдвөл давталт үүсэхээс
  // сэргийлж), ЗӨВХӨН CQL мөр өөрчлөгдөх үед л дуудна — infinite loop болохгүй.
  const onCqlRef = useRef(onCql);
  onCqlRef.current = onCql;
  const prevCqlRef = useRef(undefined);
  useEffect(() => {
    if (prevCqlRef.current === cql) return;
    prevCqlRef.current = cql;
    onCqlRef.current?.(cql);
  }, [cql]);

  const totalRecounts = useMemo(
    () => roots.reduce((s, a) => s + (a.count || 0), 0),
    [roots],
  );

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}
    >
      <Box sx={{ p: 1, flexShrink: 0 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Recount нэрээр хайх..."
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18 }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", px: 0.5, minHeight: 0 }}>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 4 }}>
            <CircularProgress size={22} />
          </Stack>
        ) : roots.length ? (
          roots.map((n) => (
            <TreeNode
              key={n.id}
              node={n}
              level={0}
              stopLevel={1}
              checkedSet={checkedSet}
              onToggle={onToggle}
            />
          ))
        ) : (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: "center", py: 4 }}
          >
            Тодруулалт олдсонгүй.
          </Typography>
        )}
      </Box>

      <Box
        sx={{
          p: 1.25,
          textAlign: "center",
          flexShrink: 0,
          borderTop: "1px solid #f0f0f0",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {selectedCount} / {totalRecounts} тодруулалт сонгосон
        </Typography>
      </Box>
    </Box>
  );
}
RecountUnitTree.propTypes = {
  onCql: PropTypes.func,
  onFlyTo: PropTypes.func,
};
