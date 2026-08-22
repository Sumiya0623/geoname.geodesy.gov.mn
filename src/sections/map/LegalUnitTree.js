import PropTypes from "prop-types";
import React, { useRef, useMemo, useState, useEffect, useCallback } from "react";

import {
  Box,
  Chip,
  Stack,
  Tooltip,
  Collapse,
  TextField,
  Typography,
  IconButton,
  InputAdornment,
  CircularProgress,
} from "@mui/material";
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  PublicRounded as AimagIcon,
  AccountBalanceRounded as SumIcon,
  GavelRounded as TypeIcon,
  InboxRounded as NoUnitIcon,
  TableRowsRounded as ListIcon,
} from "@mui/icons-material";

import axiosInstance, { endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------
// Шийдвэрийн сан — БҮХ LegalOrder‑ыг модлон харуулна:
//   Нийт (ЗЗ нэгжгүй) → Төрөл
//   Аймаг/Нийслэл → Сум/Дүүрэг → Төрөл   ("Аймгийн шийдвэр" = аймагт шууд)
// Нэгж дээр дарахад тухайн нэгж рүү газрын зургийг ниснэ (onFlyTo).
// ----------------------------------------------------------------------

const LEVEL_STYLE = [
  { Icon: AimagIcon, color: "#0675c9" }, // 0 — Аймаг / Нийт
  { Icon: SumIcon, color: "#7c3aed" }, // 1 — Сум
  { Icon: TypeIcon, color: "#16a34a" }, // 2 — Төрөл
];

function LevelIcon({ level, isNone }) {
  if (isNone) return <NoUnitIcon sx={{ fontSize: 18, color: "#64748b" }} />;
  const { Icon, color } = LEVEL_STYLE[Math.min(level, 2)];
  return <Icon sx={{ fontSize: 18, color }} />;
}
LevelIcon.propTypes = { level: PropTypes.number, isNone: PropTypes.bool };

// Зангилааны id‑гээс жагсаалтын шүүлтийг гаргана
//   none / none-t<typeId>      → ЗЗ нэгжгүй
//   a<id> / a<id>-own          → аймаг (удам оруулаад)
//   s<id>                      → сум
//   ...-t<typeId>              → тухайн төрлөөр нэмж шүүнэ
export function nodeFilter(node) {
  const id = String(node.id || "");
  const t = id.match(/-t(\d+)$/);
  const u = id.match(/^[as](\d+)/);
  return {
    name: node.name,
    count: node.count || 0,
    noUnit: id.startsWith("none"),
    unitId: u ? Number(u[1]) : null,
    typeId: t ? Number(t[1]) : null,
  };
}

function TreeNode({ node, level, onPick, onOpenList }) {
  const [open, setOpen] = useState(false);
  const kids = node.children || [];
  const canExpand = kids.length > 0;
  const isNone = node.id === "none";

  return (
    <>
      <Box
        onClick={() => {
          if (canExpand) setOpen((v) => !v);
          onPick?.(node, level);
        }}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          pl: level * 2 + 0.5,
          pr: 0.75,
          py: 0.3,
          borderRadius: 1,
          cursor: "pointer",
          "&:hover": { bgcolor: "#0675c90d" },
        }}
      >
        {canExpand ? (
          <IconButton sx={{ p: 0.25 }}>
            {open ? (
              <ExpandMoreIcon sx={{ fontSize: 18 }} />
            ) : (
              <ChevronRightIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        ) : (
          <Box sx={{ width: 26, flexShrink: 0 }} />
        )}

        <Box sx={{ display: "inline-flex" }}>
          <LevelIcon level={level} isNone={isNone} />
        </Box>

        <Typography
          variant="body2"
          sx={{
            flexGrow: 1,
            minWidth: 0,
            fontWeight: level === 0 ? 600 : level === 1 ? 500 : 400,
            color: level === 2 ? "text.secondary" : "text.primary",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {node.name}
        </Typography>

        <Tooltip title="Жагсаалтыг доор харах" placement="left">
          <IconButton
            sx={{ p: 0.25, mr: 0.25 }}
            onClick={(e) => {
              e.stopPropagation();
              onOpenList?.(nodeFilter(node));
            }}
          >
            <ListIcon sx={{ fontSize: 16, color: "text.disabled" }} />
          </IconButton>
        </Tooltip>

        <Chip
          label={`${node.count ?? 0}`}
          sx={{
            height: 18,
            fontSize: 11,
            fontWeight: 600,
            color: LEVEL_STYLE[Math.min(level, 2)].color,
            bgcolor: `${LEVEL_STYLE[Math.min(level, 2)].color}14`,
          }}
        />
      </Box>

      {canExpand && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          {kids.map((c) => (
            <TreeNode
              key={c.id}
              node={c}
              level={level + 1}
              onPick={onPick}
              onOpenList={onOpenList}
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
  onPick: PropTypes.func,
  onOpenList: PropTypes.func,
};

export default function LegalUnitTree({ onFlyTo, onSelect, onOpenList }) {
  const [roots, setRoots] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState("");

  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = {};
        if (term.trim()) params.name = term.trim();
        const q = new URLSearchParams(params).toString();
        const res = await axiosInstance.get(endpoints.legal.unitTree(q));
        if (!active) return;
        setRoots(res?.data?.results || []);
        setTotal(res?.data?.total || 0);
      } catch {
        if (active) {
          setRoots([]);
          setTotal(0);
        }
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
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Аймаг/сум дээр дарахад тухайн нэгж рүү нисэх + сонголтыг дээш дамжуулах
  const onPick = useCallback((node, level) => {
    onSelectRef.current?.({ node, level });
    const id = String(node.id || "");
    const m = id.match(/^[as](\d+)/);
    if (!m) return;
    axiosInstance
      .get(endpoints.legal.unitExtent(m[1]))
      .then((res) => {
        const ext = res?.data?.extent;
        if (ext && ext.length === 4) onFlyToRef.current?.({ bbox: ext });
      })
      .catch(() => {});
  }, []);

  const shown = useMemo(
    () => roots.reduce((s, r) => s + (r.count || 0), 0),
    [roots],
  );

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      <Box sx={{ p: 1, flexShrink: 0 }}>
        <TextField
          fullWidth
          placeholder="Шийдвэрийн нэр, дугаараар хайх..."
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
              onPick={onPick}
              onOpenList={onOpenList}
            />
          ))
        ) : (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: "center", py: 4 }}
          >
            Шийдвэр олдсонгүй.
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
          {shown} / {total} шийдвэр
        </Typography>
      </Box>
    </Box>
  );
}
LegalUnitTree.propTypes = {
  onFlyTo: PropTypes.func,
  onSelect: PropTypes.func,
  onOpenList: PropTypes.func,
};
