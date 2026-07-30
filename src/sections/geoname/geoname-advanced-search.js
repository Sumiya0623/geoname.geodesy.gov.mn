import PropTypes from "prop-types";
import { useMemo, useState, useEffect } from "react";

import {
  Box,
  Stack,
  Button,
  Divider,
  Checkbox,
  TextField,
  Typography,
  Autocomplete,
  FormControlLabel,
} from "@mui/material";

import { useGetLegalUnits } from "src/api/legal";
import { useGetConstantsFordropdown } from "src/api/constant";

import Iconify from "src/components/iconify";

// ----------------------------------------------------------------------
// Дэлгэрэнгүй хайлт — toolbar‑ын доор нээгддэг самбар.
//   1‑р мөр: засаг захиргааны нэгж (аймаг → сум), нэрлэвэр
//   2‑р мөр: ангилал 3 түвшин (Үндсэн → Дэд → Ангилал, dependent chain)
//   3‑р мөр: хилийн цэс + үйлдэл
// «Хайх» дарж байж хэрэгжинэ, самбар нээлттэй хэвээр үлдэнэ.
// ----------------------------------------------------------------------

const EMPTY = {
  aimag: null,
  sum: null,
  nomek: "",
  t1: null,
  t2: null,
  t3: null,
  category: null,
  is_border: false,
};

export default function GeonameAdvancedSearch({ open, value, onApply }) {
  const [draft, setDraft] = useState(EMPTY);

  // Нээгдэх бүрт идэвхтэй шүүлтээс draft‑аа сэргээнэ (нээлттэй үед бичсэнийг
  // дарж бичихгүйн тулд зөвхөн open→true шилжилтэд).
  useEffect(() => {
    if (open) setDraft((p) => ({ ...EMPTY, ...p, ...value }));
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

  const handleAimag = (_e, v) =>
    setDraft((p) => ({ ...p, aimag: v, sum: null }));

  // Сонгосон хамгийн ГҮН ангилал л шүүлтэд үйлчилнэ
  const handleType = (level, v) =>
    setDraft((p) => {
      const next =
        level === 1
          ? { ...p, t1: v, t2: null, t3: null }
          : level === 2
            ? { ...p, t2: v, t3: null }
            : { ...p, t3: v };
      next.category = next.t3?.id || next.t2?.id || next.t1?.id || null;
      return next;
    });

  const handleClear = () => setDraft(EMPTY);

  const handleApply = () => onApply(draft);

  return (
    <>
      <Divider />
      <Box sx={{ p: 2.5, bgcolor: "background.neutral" }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Iconify icon="solar:filter-bold" width={18} />
          <Typography variant="subtitle2">Дэлгэрэнгүй хайлт</Typography>
        </Stack>

        <Stack spacing={2}>
          {/* 1‑р мөр — засаг захиргаа, нэрлэвэр */}
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
              onChange={handleAimag}
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
            <TextField
              label="Нэрлэвэр"
              value={draft.nomek}
              onChange={(e) => set("nomek", e.target.value)}
              placeholder="М-46-22, М-48-7-А-г гэх мэт"
              helperText="1:100000 (М-46-22), 1:25000 (М-46-22-А-г) масштаб"
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

          {/* 3‑р мөр — хилийн цэс + үйлдэл */}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
            spacing={1.5}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={!!draft.is_border}
                  onChange={(e) => set("is_border", e.target.checked)}
                />
              }
              label="Хилийн цэс"
            />

            <Stack direction="row" spacing={1.5} justifyContent="flex-end">
              <Button color="inherit" variant="outlined" onClick={handleClear}>
                Цэвэрлэх
              </Button>
              <Button
                variant="contained"
                startIcon={<Iconify icon="eva:search-fill" />}
                onClick={handleApply}
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

GeonameAdvancedSearch.propTypes = {
  open: PropTypes.bool,
  value: PropTypes.object,
  onApply: PropTypes.func,
};
