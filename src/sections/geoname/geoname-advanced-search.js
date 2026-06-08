import PropTypes from "prop-types";
import { useState, useEffect } from "react";

import {
  Box,
  Stack,
  Drawer,
  Button,
  Divider,
  TextField,
  Typography,
  IconButton,
  InputAdornment,
  Autocomplete,
} from "@mui/material";

import { useGetLegalUnits } from "src/api/legal";
import Iconify from "src/components/iconify";
import Scrollbar from "src/components/scrollbar";

// ----------------------------------------------------------------------
// Дэлгэрэнгүй хайлт — баруунаас нээгддэг drawer.
// Нэр, дугаар, засаг захиргааны нэгж (аймаг/сум), солбицол, нэрлэврээр
// нэгтгэн хайна. "Хайх" дарахад л шүүлт хэрэгжинэ (draft → onApply).
// ----------------------------------------------------------------------

const EMPTY = {
  name: "",
  number: "",
  aimag: null,
  sum: null,
  lat: "",
  lon: "",
  nomek: "",
};

export default function GeonameAdvancedSearch({
  open,
  onClose,
  value,
  onApply,
}) {
  const [draft, setDraft] = useState(EMPTY);

  // Drawer нээгдэх бүрт идэвхтэй шүүлтээс draft‑аа сэргээнэ
  useEffect(() => {
    if (open) setDraft({ ...EMPTY, ...value });
  }, [open, value]);

  const { units: aimagOptions } = useGetLegalUnits("Аймаг/Нийслэл", null, open);
  const { units: sumOptions } = useGetLegalUnits(
    "Сум/Дүүрэг",
    draft.aimag?.id,
    open && !!draft.aimag?.id,
  );

  const set = (name, val) => setDraft((p) => ({ ...p, [name]: val }));

  const handleAimag = (_e, v) =>
    setDraft((p) => ({ ...p, aimag: v, sum: null }));

  const handleNum = (name) => (e) =>
    set(name, e.target.value.replace(/[^0-9.-]/g, ""));

  const handleClear = () => setDraft(EMPTY);

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ backdrop: { invisible: true } }}
      PaperProps={{ sx: { width: { xs: 1, sm: 380 } } }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ py: 2, pl: 2.5, pr: 1.5 }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Iconify icon="solar:filter-bold" width={22} />
          <Typography variant="h6">Дэлгэрэнгүй хайлт</Typography>
        </Stack>
        <IconButton onClick={onClose}>
          <Iconify icon="mingcute:close-line" />
        </IconButton>
      </Stack>

      <Divider />

      <Scrollbar sx={{ flexGrow: 1 }}>
        <Stack spacing={2.5} sx={{ p: 2.5 }}>
          <TextField
            label="Нэр"
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
          />

          <TextField
            label="Дугаар"
            value={draft.number}
            onChange={(e) => set("number", e.target.value)}
          />

          <Box>
            <Typography variant="overline" color="text.secondary">
              Засаг захиргааны нэгж
            </Typography>
            <Stack spacing={2} sx={{ mt: 1 }}>
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
            </Stack>
          </Box>

          <Box>
            <Typography variant="overline" color="text.secondary">
              Солбицол
            </Typography>
            <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Өргөрөг (lat)"
                value={draft.lat}
                onChange={handleNum("lat")}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Iconify
                        icon="solar:map-point-bold"
                        sx={{ color: "text.disabled" }}
                      />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Уртраг (lon)"
                value={draft.lon}
                onChange={handleNum("lon")}
              />
            </Stack>
          </Box>

          <TextField
            label="Нэрлэвэр"
            value={draft.nomek}
            onChange={(e) => set("nomek", e.target.value)}
            placeholder="М-46-22, М-48-7-А-г гэх мэт"
            helperText="Зөвхөн 1:100000 (М-46-22), 1:25000 (М-46-22-А-г) масштаб"
          />
        </Stack>
      </Scrollbar>

      <Divider />

      <Stack direction="row" spacing={1.5} sx={{ p: 2.5 }}>
        <Button
          fullWidth
          size="large"
          color="inherit"
          variant="outlined"
          onClick={handleClear}
        >
          Цэвэрлэх
        </Button>
        <Button
          fullWidth
          size="large"
          variant="contained"
          startIcon={<Iconify icon="eva:search-fill" />}
          onClick={handleApply}
        >
          Хайх
        </Button>
      </Stack>
    </Drawer>
  );
}

GeonameAdvancedSearch.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  value: PropTypes.object,
  onApply: PropTypes.func,
};
