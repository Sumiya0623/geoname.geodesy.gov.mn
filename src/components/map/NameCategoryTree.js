import PropTypes from "prop-types";
import React, { useState, useEffect, useCallback } from "react";

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
}) {
  const hasChildren = (node.child_count ?? 0) > 0;
  const isOpen = expandedSet.has(node.id);
  const isLoading = loadingSet.has(node.id);
  const checked = checkedSet.has(node.id);
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
            size="small"
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
          size="small"
          checked={checked}
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
            size="small"
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
};

export default function NameCategoryTree({ onToggle, checkedSet }) {
  const [roots, setRoots] = useState([]);
  const [total, setTotal] = useState(0);
  const [rootLoading, setRootLoading] = useState(true);
  const [childrenMap, setChildrenMap] = useState({});
  const [expandedSet, setExpandedSet] = useState(() => new Set());
  const [loadingSet, setLoadingSet] = useState(() => new Set());

  const fetchNodes = useCallback(async (parent) => {
    const q = parent ? new URLSearchParams({ parent }).toString() : "";
    const res = await axiosInstance.get(endpoints.nameCategory.list(q));
    return res?.data || { results: [], total: 0 };
  }, []);

  useEffect(() => {
    let active = true;
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
          onToggle={onToggle}
          expandedSet={expandedSet}
          onExpand={handleExpand}
          childrenMap={childrenMap}
          loadingSet={loadingSet}
        />
      ))}
    </Box>
  );
}

NameCategoryTree.propTypes = {
  onToggle: PropTypes.func,
  checkedSet: PropTypes.object,
};
