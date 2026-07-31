import PropTypes from "prop-types";
import { useMemo, useState, useEffect } from "react";

import {
  Box,
  Stack,
  Button,
  Divider,
  Checkbox,
  MenuItem,
  TextField,
  Typography,
  Autocomplete,
  FormControlLabel,
} from "@mui/material";

import { useGetLegalUnits } from "src/api/legal";
import { useGetConstantsFordropdown } from "src/api/constant";

import Iconify from "src/components/iconify";

// ----------------------------------------------------------------------
// Тодруулалтын ДЭЛГЭРЭНГҮЙ ХАЙЛТ — toolbar‑ын доор нээгддэг самбар
// (/dashboard/geoname‑ийн дэлгэрэнгүй хайлттай ижил хэлбэр):
//   1‑р мөр: засаг захиргаа (аймаг → сум), үүсгэсэн хэрэглэгч
//   2‑р мөр: ангилал 3 түвшин (Үндсэн → Дэд → Ангилал)
//   3‑р мөр: геометрийн төрөл, хилийн цэс + үйлдэл
// «Хайх» дарж байж хэрэгжинэ, самбар нээлттэй хэвээр үлдэнэ.
// ----------------------------------------------------------------------

export const EMPTY_ADV = {
  aimag: null,
  sum: null,
  user: null,
  t1: null,
  t2: null,
  t3: null,
  geomType: "",
  isBorder: false,
};

const GEOM_TYPES = [
  { value: "Point", label: "Цэг" },
  { value: "LineString", label: "Шугам" },
  { value: "Polygon", label: "Талбай" },
];

export default function RecountAdvancedSearch({ open, value, users, onApply }) {
  const [draft, setDraft] = useState(EMPTY_ADV);

  // Нээгдэх бүрт идэвхтэй шүүлтээс draft‑аа сэргээнэ
  useEffect(() => {
    if (open) setDraft((p) => ({ ...EMPTY_ADV, ...p, ...value }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { units: aimagOptions } = useGetLegalUnits("Аймаг/Нийслэл", null, open);
  const { units: sumOptions } = useGetLegalUnits(
    "Сум/Дүүрэг",
    draft.aimag?.id,
    open && !!draft.aimag?.id,
  );

  // Ангилал (GEONAME_TYPES) — 3 түвшний хамааралт сонголт
  const { constants: types } = useGetConstantsFordropdown("GEONAME_TYPES");
  const childrenOf = useMemo(
    () => (parentId) =>
      types.filter((c) => (c.parent ?? null) === (parentId ?? null)),
    [types],
  );
  const ty1 = useMemo(() => childrenOf(null), [childrenOf]);
  const ty2 = useMemo(
    () => (draft.t1?.id ? childrenOf(draft.t1.id) : []),
    [childrenOf, draft.t1],
  );
  const ty3 = useMemo(
    () => (draft.t2?.id ? childrenOf(draft.t2.id) : []),
    [childrenOf, draft.t2],
  );

  const set = (name, val) => setDraft((p) => ({ ...p, [name]: val }));

  const handleType = (level, v) =>
    setDraft((p) =>
      level === 1
        ? { ...p, t1: v, t2: null, t3: null }
        : level === 2
          ? { ...p, t2: v, t3: null }
          : { ...p, t3: v },
    );

  return (
    <>
      <Divider />
      <Box sx={{ p: 2.5, bgcolor: "background.neutral" }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Iconify icon="solar:filter-bold" width={18} />
          <Typography variant="subtitle2">Дэлгэрэнгүй хайлт</Typography>
        </Stack>

        <Stack spacing={2}>
          {/* 1‑р мөр — засаг захиргаа, хэрэглэгч */}
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
              },
            }}
          >
            <Autocomplete
              value={draft.aimag}
              onChange={(_e, v) =>
                setDraft((p) => ({ ...p, aimag: v, sum: null }))
              }
              options={aimagOptions}
              getOptionLabel={(o) => o?.unit || ""}
              isOptionEqualToValue={(o, v) => o?.id === v?.id}
              renderInput={(params) => (
                <TextField {...params} label="Аймаг / Нийслэл" />
              )}
            />
            <Autocomplete
              value={draft.sum}
              onChange={(_e, v) => set("sum", v)}
              disabled={!draft.aimag?.id}
              options={sumOptions}
              getOptionLabel={(o) => o?.unit || ""}
              isOptionEqualToValue={(o, v) => o?.id === v?.id}
              renderInput={(params) => (
                <TextField {...params} label="Сум / Дүүрэг" />
              )}
            />
            <Autocomplete
              value={draft.user}
              onChange={(_e, v) => set("user", v)}
              options={users || []}
              getOptionLabel={(o) => o?.full_name || ""}
              isOptionEqualToValue={(o, v) => o?.id === v?.id}
              renderInput={(params) => (
                <TextField {...params} label="Үүсгэсэн хэрэглэгч" />
              )}
            />
          </Box>

          {/* 2‑р мөр — ангилал 3 түвшин */}
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
              },
            }}
          >
            <Autocomplete
              value={draft.t1}
              onChange={(_e, v) => handleType(1, v)}
              options={ty1}
              getOptionLabel={(o) => o?.name || ""}
              isOptionEqualToValue={(o, v) => o?.id === v?.id}
              renderInput={(params) => (
                <TextField {...params} label="Үндсэн ангилал" />
              )}
            />
            <Autocomplete
              value={draft.t2}
              disabled={!draft.t1?.id || !ty2.length}
              onChange={(_e, v) => handleType(2, v)}
              options={ty2}
              getOptionLabel={(o) => o?.name || ""}
              isOptionEqualToValue={(o, v) => o?.id === v?.id}
              renderInput={(params) => (
                <TextField {...params} label="Дэд ангилал" />
              )}
            />
            <Autocomplete
              value={draft.t3}
              disabled={!draft.t2?.id || !ty3.length}
              onChange={(_e, v) => handleType(3, v)}
              options={ty3}
              getOptionLabel={(o) => o?.name || ""}
              isOptionEqualToValue={(o, v) => o?.id === v?.id}
              renderInput={(params) => (
                <TextField {...params} label="Ангилал" />
              )}
            />
          </Box>

          {/* 3‑р мөр — геометрийн төрөл, хилийн цэс + үйлдэл */}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "stretch", sm: "center" }}
            spacing={2}
          >
            <TextField
              select
              label="Геометрийн төрөл"
              value={draft.geomType}
              onChange={(e) => set("geomType", e.target.value)}
              sx={{ width: { xs: 1, sm: 220 } }}
            >
              <MenuItem value="">— Бүгд —</MenuItem>
              {GEOM_TYPES.map((g) => (
                <MenuItem key={g.value} value={g.value}>
                  {g.label}
                </MenuItem>
              ))}
            </TextField>

            <FormControlLabel
              control={
                <Checkbox
                  checked={!!draft.isBorder}
                  onChange={(e) => set("isBorder", e.target.checked)}
                />
              }
              label="Хилийн цэс"
            />

            <Stack
              direction="row"
              spacing={1.5}
              justifyContent="flex-end"
              sx={{ ml: { sm: "auto" } }}
            >
              <Button
                color="inherit"
                variant="outlined"
                onClick={() => setDraft(EMPTY_ADV)}
              >
                Цэвэрлэх
              </Button>
              <Button
                variant="contained"
                startIcon={<Iconify icon="eva:search-fill" />}
                onClick={() => onApply(draft)}
              >
                Хайх
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Box>
      <Divider />
    </>
  );
}

RecountAdvancedSearch.propTypes = {
  open: PropTypes.bool,
  value: PropTypes.object,
  users: PropTypes.array,
  onApply: PropTypes.func,
};
