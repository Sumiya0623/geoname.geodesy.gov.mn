import PropTypes from "prop-types";
import React, { useRef, useState, useEffect, useCallback } from "react";

import {
  Box,
  Chip,
  Checkbox,
  Collapse,
  Tooltip,
  Typography,
  IconButton,
  CircularProgress,
} from "@mui/material";
import {
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  Place as PointIcon,
  Timeline as LineIcon,
  CropSquare as PolygonIcon,
  FolderOutlined as FolderIcon,
} from "@mui/icons-material";

import axiosInstance, { endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------
// Газар зүйн нэрийн ангилал (GEONAME_TYPES) — lazy задардаг мод.
// Check хийхэд тухайн ангилалд хамаарах геонэрүүдийг (CQL) газрын зурагт
// харуулна. Мөр бүрт хамаарах геонэрийн тоог хаалтанд харуулна.
// ----------------------------------------------------------------------

const GEOM = {
  Цэг: { icon: PointIcon, color: "#16a34a" },
  Шугам: { icon: LineIcon, color: "#2563eb" },
  Талбай: { icon: PolygonIcon, color: "#d97706" },
};

const LEVEL_COLOR = ["#0675c9", "#7c3aed", "#0891b2"];

function NodeIcon({ node, level }) {
  const g = GEOM[(node.desc || "").trim()];
  if (g) {
    const Ic = g.icon;
    return <Ic sx={{ fontSize: 18, color: g.color }} />;
  }
  return (
    <FolderIcon sx={{ fontSize: 18, color: LEVEL_COLOR[level] || "#64748b" }} />
  );
}
NodeIcon.propTypes = { node: PropTypes.object, level: PropTypes.number };

function TreeNode({
  node,
  level,
  total,
  checkedSet,
  onToggle,
  expandedSet,
  onExpand,
  childrenMap,
  loadingSet,
  ancestorChecked,
  hasCheckedDescendant,
}) {
  const hasChildren = (node.child_count ?? 0) > 0;
  const isOpen = expandedSet.has(node.id);
  const isLoading = loadingSet.has(node.id);
  // Эцэг сонгогдсон бол хүүхэд бүгд "сонгогдсон" мэт харагдана (cascade) —
  // гэхдээ зөвхөн эцгийн ганц request‑ээр л дуудна.
  const selfChecked = checkedSet.has(node.id);
  const checked = ancestorChecked || selfChecked;
  const indeterminate = !checked && hasCheckedDescendant(node.id);
  const kids = childrenMap[node.id] || [];

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          pl: level * 2 + 0.5,
          pr: 1,
          py: 0.25,
          borderRadius: 1,
          transition: "background .15s",
          "&:hover": { bgcolor: "#0675c90d" },
          ...(checked && { bgcolor: "#0675c914" }),
        }}
      >
        {hasChildren ? (
          <IconButton
            sx={{ p: 0.25 }}
            onClick={() => onExpand(node)}
          >
            {isLoading ? (
              <CircularProgress size={14} />
            ) : isOpen ? (
              <ExpandMoreIcon sx={{ fontSize: 18 }} />
            ) : (
              <ChevronRightIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        ) : (
          <Box sx={{ width: 26, flexShrink: 0 }} />
        )}

        <Checkbox
          checked={checked}
          indeterminate={indeterminate}
          disabled={ancestorChecked}
          onChange={(e) => onToggle(node, e.target.checked)}
          sx={{ p: 0.25 }}
        />

        <Box sx={{ display: "inline-flex", mx: 0.5 }}>
          <NodeIcon node={node} level={level} />
        </Box>

        <Typography
          variant="body2"
          sx={{
            flexGrow: 1,
            minWidth: 0,
            fontWeight: level === 0 ? 600 : 400,
            color: checked ? "#0675c9" : "text.primary",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {node.name}
        </Typography>

        <Tooltip title="Энэ ангилалд хамаарах нэрийн тоо">
          <Chip
            label={`${node.count ?? 0}`}
            sx={{
              height: 18,
              fontSize: 11,
              fontWeight: 600,
              color: node.count ? "#0675c9" : "text.disabled",
              bgcolor: node.count ? "#0675c914" : "transparent",
              border: "1px solid",
              borderColor: node.count ? "#0675c933" : "divider",
            }}
          />
        </Tooltip>
      </Box>

      {hasChildren && (
        <Collapse in={isOpen} timeout="auto" unmountOnExit>
          {kids
            .filter((c) => (c.count ?? 0) > 0)
            .map((c) => (
            <TreeNode
              key={c.id}
              node={c}
              level={level + 1}
              total={total}
              checkedSet={checkedSet}
              onToggle={onToggle}
              expandedSet={expandedSet}
              onExpand={onExpand}
              childrenMap={childrenMap}
              loadingSet={loadingSet}
              ancestorChecked={checked}
              hasCheckedDescendant={hasCheckedDescendant}
            />
          ))}
          {!isLoading && kids.length === 0 && (
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ pl: (level + 1) * 2 + 4, py: 0.5, display: "block" }}
            >
              Үндсэн ангилал алга
            </Typography>
          )}
        </Collapse>
      )}
    </>
  );
}
TreeNode.propTypes = {
  node: PropTypes.object,
  level: PropTypes.number,
  total: PropTypes.number,
  checkedSet: PropTypes.object,
  onToggle: PropTypes.func,
  expandedSet: PropTypes.object,
  onExpand: PropTypes.func,
  childrenMap: PropTypes.object,
  loadingSet: PropTypes.object,
  ancestorChecked: PropTypes.bool,
  hasCheckedDescendant: PropTypes.func,
};

export default function NameCategoryTree({
  onToggle,
  checkedSet,
  filters,
  autoCheck,
}) {
  const [roots, setRoots] = useState([]);
  const [total, setTotal] = useState(0);
  const [rootLoading, setRootLoading] = useState(true);
  const [childrenMap, setChildrenMap] = useState({});
  const [expandedSet, setExpandedSet] = useState(() => new Set());
  const [loadingSet, setLoadingSet] = useState(() => new Set());

  // Хайлтын шүүлтүүрийг тоолол дуудлагад дамжуулна (тоо хэмжээ хайлттай уялдана)
  const fetchNodes = useCallback(
    async (parent) => {
      const qp = { ...(filters || {}) };
      if (parent) qp.parent = parent;
      const q = new URLSearchParams(qp).toString();
      const res = await axiosInstance.get(endpoints.nameCategory.list(q));
      return res?.data || { results: [], total: 0 };
    },
    [filters],
  );

  // Root‑ийг ачаална. filters өөрчлөгдөх бүрд дахин татаж, задарсан
  // дэд ангиллуудыг цэвэрлэнэ (шинэ тоо хэмжээгээр дахин задартал).
  useEffect(() => {
    let active = true;
    setRootLoading(true);
    setChildrenMap({});
    setExpandedSet(new Set());
    (async () => {
      try {
        const data = await fetchNodes(null);
        if (active) {
          setRoots(data.results || []);
          setTotal(data.total || 0);
        }
      } finally {
        if (active) setRootLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchNodes]);

  // Нүүр хуудаснаас ЗЗ нэгжтэй ирэхэд (autoCheck) үндсэн ангиллуудыг
  // АВТОМАТААР асаана — газрын зураг хоосон биш, нэрс нь шууд харагдана.
  const autoRef = useRef(null);
  useEffect(() => {
    if (!autoCheck || rootLoading || !roots.length) return;
    if (autoRef.current === autoCheck) return;
    autoRef.current = autoCheck;
    roots.forEach((r) => {
      if ((r.count ?? 0) > 0 && !checkedSet?.has(r.id)) onToggle?.(r, true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCheck, rootLoading, roots]);

  // childrenMap‑аас тухайн нодын ачаалагдсан бүх удам (node) цуглуулна
  const collectDescNodes = useCallback(
    (nodeId) => {
      const acc = [];
      const walk = (id) => {
        (childrenMap[id] || []).forEach((c) => {
          acc.push(c);
          walk(c.id);
        });
      };
      walk(nodeId);
      return acc;
    },
    [childrenMap],
  );

  const hasCheckedDescendant = useCallback(
    (nodeId) => collectDescNodes(nodeId).some((n) => checkedSet.has(n.id)),
    [collectDescNodes, checkedSet],
  );

  // Нод сонгоход: түүний доор сонгогдсон байсан удмын request‑үүдийг устгаад
  // (давхар дуудлагаас сэргийлж) тухайн нодыг ганц request‑ээр дуудна.
  const handleNodeToggle = useCallback(
    (node, checked) => {
      if (checked) {
        collectDescNodes(node.id).forEach((d) => {
          if (checkedSet.has(d.id)) onToggle(d, false);
        });
      }
      onToggle(node, checked);
    },
    [collectDescNodes, checkedSet, onToggle],
  );

  const handleExpand = useCallback(
    async (node) => {
      setExpandedSet((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
      if (childrenMap[node.id]) return; // аль хэдийн ачаалсан
      setLoadingSet((prev) => new Set(prev).add(node.id));
      try {
        const data = await fetchNodes(node.id);
        setChildrenMap((prev) => ({ ...prev, [node.id]: data.results || [] }));
      } finally {
        setLoadingSet((prev) => {
          const next = new Set(prev);
          next.delete(node.id);
          return next;
        });
      }
    },
    [childrenMap, fetchNodes],
  );

  if (rootLoading) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <CircularProgress size={22} />
      </Box>
    );
  }

  if (roots.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          Ангилал олдсонгүй
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 0.5 }}>
      {roots
        .filter((node) => (node.count ?? 0) > 0)
        .map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          level={0}
          total={total}
          checkedSet={checkedSet}
          onToggle={handleNodeToggle}
          expandedSet={expandedSet}
          onExpand={handleExpand}
          childrenMap={childrenMap}
          loadingSet={loadingSet}
          ancestorChecked={false}
          hasCheckedDescendant={hasCheckedDescendant}
        />
      ))}
    </Box>
  );
}

NameCategoryTree.propTypes = {
  autoCheck: PropTypes.any,
  onToggle: PropTypes.func,
  checkedSet: PropTypes.object,
  filters: PropTypes.object,
};
