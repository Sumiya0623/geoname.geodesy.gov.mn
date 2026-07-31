import PropTypes from "prop-types";

import {
  Box,
  Menu,
  Stack,
  Button,
  Divider,
  Tooltip,
  Checkbox,
  MenuItem,
  TextField,
  Typography,
  IconButton,
  Autocomplete,
  InputAdornment,
  FormControlLabel,
} from "@mui/material";

import Iconify from "src/components/iconify";
import { statusColor } from "src/components/map/recountStatus";

// ----------------------------------------------------------------------
// Суурин судалгаа — хүснэгтийн toolbar: нэрээр хайх, ангиллын 3 түвшин,
// төлөв (олон сонголт), байршилгүй шүүлт, сангаас импортлох.
// ----------------------------------------------------------------------

export default function RecountTableToolbar({
  // хайлт
  search,
  onSearch,
  // ангилал (cascade)
  t1,
  t2,
  t3,
  ty1,
  ty2,
  ty3,
  onType,
  // төлөв
  statuses,
  selectedStatuses,
  onStatuses,
  stMenu,
  onStMenu,
  // байршилгүй
  noGeom,
  onNoGeom,
  // сангаас импортлох
  importing,
  canImport,
  onImport,
}) {
  return (
    <Stack
      spacing={2}
      alignItems={{ xs: "stretch", md: "center" }}
      direction={{ xs: "column", md: "row" }}
      sx={{ p: 2.5, pr: { xs: 2.5, md: 1 } }}
    >
      <TextField
        fullWidth
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Нэрээр..."
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Iconify icon="eva:search-fill" sx={{ color: "text.disabled" }} />
            </InputAdornment>
          ),
          endAdornment: search ? (
            <IconButton onClick={() => onSearch("")}>
              <Iconify icon="eva:close-fill" />
            </IconButton>
          ) : null,
        }}
      />

      {/* Ангилал — Үндсэн → Дэд → Ангилал (сонгосон хамгийн гүн нь үйлчилнэ).
          «Ангилалгүй» сонголт нь төрөл огт тодорхойлоогүй мөрсийг шүүнэ. */}
      <Autocomplete
        value={t1}
        onChange={(_e, v) => onType(1, v)}
        options={[{ id: "none", name: "Ангилалгүй" }, ...ty1]}
        getOptionLabel={(o) => o?.name || ""}
        isOptionEqualToValue={(o, v) => o?.id === v?.id}
        sx={{ width: { xs: 1, md: 190 }, flexShrink: 0 }}
        renderInput={(params) => <TextField {...params} label="Үндсэн" />}
      />
      <Autocomplete
        value={t2}
        disabled={!t1?.id || t1.id === "none"}
        onChange={(_e, v) => onType(2, v)}
        options={ty2}
        getOptionLabel={(o) => o?.name || ""}
        isOptionEqualToValue={(o, v) => o?.id === v?.id}
        sx={{ width: { xs: 1, md: 190 }, flexShrink: 0 }}
        renderInput={(params) => <TextField {...params} label="Дэд" />}
      />
      <Autocomplete
        value={t3}
        disabled={!t2?.id || t1?.id === "none"}
        onChange={(_e, v) => onType(3, v)}
        options={ty3}
        getOptionLabel={(o) => o?.name || ""}
        isOptionEqualToValue={(o, v) => o?.id === v?.id}
        sx={{ width: { xs: 1, md: 190 }, flexShrink: 0 }}
        renderInput={(params) => <TextField {...params} label="Ангилал" />}
      />

      {/* Төлөв, шүүлт, импорт — мөрийн БАРУУН талд */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="flex-end"
        sx={{ flexShrink: 0, ml: { md: "auto" } }}
      >
        <Button
          variant="outlined"
          color={selectedStatuses.length ? "primary" : "inherit"}
          onClick={(e) => onStMenu(e.currentTarget)}
          endIcon={<Iconify icon="eva:chevron-down-fill" />}
          sx={{
            flexShrink: 0,
            whiteSpace: "nowrap",
            // хайлт/сонголтын талбартай ижил өндөр (MUI medium input = 56px)
            height: 56,
            px: 2,
          }}
        >
          Төлөв
          {selectedStatuses.length ? ` (${selectedStatuses.length})` : ""}
        </Button>
        <Menu
          open={!!stMenu}
          anchorEl={stMenu}
          onClose={() => onStMenu(null)}
          slotProps={{ paper: { sx: { width: 240 } } }}
        >
          {[...statuses, { id: "none", name: "Тодорхойгүй" }].map((st) => {
            const col = st.id === "none" ? "#94a3b8" : statusColor(st);
            const on = selectedStatuses.includes(st.id);
            return (
              <MenuItem key={st.id} onClick={() => onStatuses(st.id)}>
                <Checkbox checked={on} sx={{ p: 0.5, mr: 1 }} />
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: col,
                    mr: 1,
                    flexShrink: 0,
                  }}
                />
                {st.name}
              </MenuItem>
            );
          })}
          {!!selectedStatuses.length && (
            <>
              <Divider />
              <MenuItem
                onClick={() => {
                  onStatuses(null);
                  onStMenu(null);
                }}
                sx={{ color: "text.secondary" }}
              >
                <Iconify icon="solar:restart-bold" sx={{ mr: 1 }} />
                Цэвэрлэх
              </MenuItem>
            </>
          )}
        </Menu>

        <FormControlLabel
          sx={{ ml: 0, flexShrink: 0, whiteSpace: "nowrap" }}
          control={
            <Checkbox
              checked={noGeom}
              onChange={(e) => onNoGeom(e.target.checked)}
            />
          }
          label={<Typography variant="body2">Байршилгүй</Typography>}
        />

        <Tooltip title="Сангаас импортлох — төслийн хамрах засаг захиргаанд (аймаг сонгосон бол доод шатны сум, баг хүртэл) багтах бүх батлагдсан нэрийг дахин тооллого руу нэг дор нэмнэ">
          <span>
            <IconButton
              color="primary"
              disabled={importing || !canImport}
              onClick={onImport}
            >
              <Iconify
                icon="solar:refresh-circle-bold"
                sx={
                  importing
                    ? {
                        animation: "spin 1s linear infinite",
                        "@keyframes spin": {
                          from: { transform: "rotate(0deg)" },
                          to: { transform: "rotate(360deg)" },
                        },
                      }
                    : undefined
                }
              />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Stack>
  );
}

RecountTableToolbar.propTypes = {
  search: PropTypes.string,
  onSearch: PropTypes.func,
  t1: PropTypes.object,
  t2: PropTypes.object,
  t3: PropTypes.object,
  ty1: PropTypes.array,
  ty2: PropTypes.array,
  ty3: PropTypes.array,
  onType: PropTypes.func,
  statuses: PropTypes.array,
  selectedStatuses: PropTypes.array,
  onStatuses: PropTypes.func,
  stMenu: PropTypes.any,
  onStMenu: PropTypes.func,
  noGeom: PropTypes.bool,
  onNoGeom: PropTypes.func,
  importing: PropTypes.bool,
  canImport: PropTypes.bool,
  onImport: PropTypes.func,
};
