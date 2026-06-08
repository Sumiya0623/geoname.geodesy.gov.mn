import PropTypes from "prop-types";
import { useState, useMemo, useEffect } from "react";
import { useFormContext } from "react-hook-form";

import { Box, MenuItem, TextField, Typography } from "@mui/material";

import { useGetConstantsFordropdown } from "src/api/constant";

// ----------------------------------------------------------------------
// GEONAME_TYPES‑ийг constant dropdown‑оор НЭГ удаа татаад (id, name, parent)
// мод бүтцийг client талд барина. parent=null‑аас эхэлнэ; сонгосон утганд
// child байвал дараагийн түвшин нэмж задарна. type = хамгийн гүн сонголт.
// ----------------------------------------------------------------------

export default function RequestTypeCascade({ currentName }) {
  const { setValue, watch } = useFormContext();
  const { constants } = useGetConstantsFordropdown("GEONAME_TYPES");
  const [path, setPath] = useState([]); // сонгогдсон ангиллын id‑ууд

  const childrenOf = useMemo(
    () => (parentId) =>
      constants.filter((c) => (c.parent ?? null) === (parentId ?? null)),
    [constants],
  );

  // Формын `type` (leaf id) гаднаас сетлэгдвэл path‑ийг өвөг рүү нь сэргээнэ
  const typeVal = watch("type");
  useEffect(() => {
    if (!constants.length) return;
    const leaf = typeVal ? Number(typeVal) : null;
    const curLeaf = path[path.length - 1] ?? null;
    if (leaf === curLeaf) return;
    if (!leaf) {
      setPath([]);
      return;
    }
    const byId = new Map(constants.map((c) => [c.id, c]));
    const chain = [];
    let cur = byId.get(leaf);
    let guard = 0;
    while (cur && guard < 20) {
      chain.unshift(cur.id);
      cur = cur.parent ? byId.get(cur.parent) : null;
      guard += 1;
    }
    setPath(chain);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeVal, constants]);

  const handleSelect = (level, value) => {
    const id = value ? Number(value) : null;
    const newPath = id ? [...path.slice(0, level), id] : path.slice(0, level);
    setPath(newPath);
    setValue("type", newPath[newPath.length - 1] || "", {
      shouldValidate: true,
    });
  };

  const last = path[path.length - 1] ?? null;
  const showNext = childrenOf(last).length > 0;
  const levelCount = path.length + (showNext ? 1 : 0);

  return (
    <Box sx={{ gridColumn: "1 / -1" }}>
      <Typography variant="caption" color="text.secondary">
        Дэвсгэр нэр (төрөл)
      </Typography>
      <Box
        gap={1.5}
        display="grid"
        gridTemplateColumns={{ xs: "1fr", sm: "repeat(3, 1fr)" }}
        sx={{ mt: 0.5 }}
      >
        {Array.from({ length: Math.max(levelCount, 1) }).map((_, i) => {
          const parentId = i === 0 ? null : path[i - 1];
          const options = childrenOf(parentId);
          if (options.length === 0) return null;
          return (
            // eslint-disable-next-line react/no-array-index-key
            <TextField
              key={i}
              select
              label={`Ангилал ${i + 1}`}
              value={path[i] ? String(path[i]) : ""}
              onChange={(e) => handleSelect(i, e.target.value)}
            >
              <MenuItem value="">—</MenuItem>
              {options.map((o) => (
                <MenuItem key={o.id} value={String(o.id)}>
                  {o.name}
                </MenuItem>
              ))}
            </TextField>
          );
        })}
      </Box>
      {currentName && path.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          Одоогийн төрөл: <b>{currentName}</b>
        </Typography>
      )}
    </Box>
  );
}

RequestTypeCascade.propTypes = {
  currentName: PropTypes.string,
};
