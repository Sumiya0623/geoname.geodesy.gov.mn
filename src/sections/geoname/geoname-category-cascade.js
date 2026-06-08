import PropTypes from "prop-types";
import { useState, useMemo, useEffect } from "react";

import { MenuItem, TextField } from "@mui/material";

import { useGetConstantsFordropdown } from "src/api/constant";

// ----------------------------------------------------------------------
// Хайлтын ангилал — сонгосон картын (rootTypeId) child‑аас эхэлж задарна.
// Сонгосон утганд дахин child байвал ард нь нэмж dropdown гаргана.
// onChange(deepest) — хамгийн гүн сонгогдсон ангиллын id (эс бөгөөс root).
// ----------------------------------------------------------------------

export default function GeonameCategoryCascade({
  rootTypeId,
  value,
  onChange,
  grow = false,
}) {
  const { constants } = useGetConstantsFordropdown("GEONAME_TYPES");
  const [path, setPath] = useState([]);

  const childrenOf = useMemo(
    () => (parentId) =>
      constants.filter((c) => (c.parent ?? null) === (parentId ?? null)),
    [constants],
  );

  // value (одоогийн төрөл) → rootTypeId хүртэлх замыг барьж урьдчилж сонгоно.
  // value хоосон бол цэвэрлэнэ (карт солих / шүүлт цэвэрлэх).
  useEffect(() => {
    if (!constants.length) return;
    if (!value) {
      setPath([]);
      return;
    }
    const byId = new Map(constants.map((c) => [c.id, c]));
    const chain = [];
    let node = byId.get(Number(value));
    while (node && node.id !== Number(rootTypeId)) {
      chain.push(node.id);
      node = node.parent != null ? byId.get(node.parent) : null;
    }
    chain.reverse();
    setPath((prev) =>
      prev.length === chain.length && prev.every((v, i) => v === chain[i])
        ? prev
        : chain,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, constants, rootTypeId]);

  const handleSelect = (level, value) => {
    const id = value ? Number(value) : null;
    const newPath = id ? [...path.slice(0, level), id] : path.slice(0, level);
    setPath(newPath);
    onChange(newPath[newPath.length - 1] || null);
  };

  if (!rootTypeId) return null;

  const last = path[path.length - 1] ?? rootTypeId;
  const showNext = childrenOf(last).length > 0;
  const levelCount = path.length + (showNext ? 1 : 0);
  if (levelCount === 0) return null;

  return Array.from({ length: levelCount }).map((_, i) => {
    const parentId = i === 0 ? rootTypeId : path[i - 1];
    const options = childrenOf(parentId);
    if (options.length === 0) return null;
    return (
      <TextField
        // eslint-disable-next-line react/no-array-index-key
        key={i}
        select
        label={i === 0 ? "Ангилал" : `Ангилал ${i + 1}`}
        value={path[i] ? String(path[i]) : ""}
        onChange={(e) => handleSelect(i, e.target.value)}
        sx={
          grow
            ? { flexGrow: 1, flexBasis: 0, minWidth: 100 }
            : { minWidth: 180, flexShrink: 0 }
        }
      >
        <MenuItem value="">— Бүгд —</MenuItem>
        {options.map((o) => (
          <MenuItem key={o.id} value={String(o.id)}>
            {o.name}
          </MenuItem>
        ))}
      </TextField>
    );
  });
}

GeonameCategoryCascade.propTypes = {
  grow: PropTypes.bool,
  rootTypeId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onChange: PropTypes.func,
};
