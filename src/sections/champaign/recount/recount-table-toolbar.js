import PropTypes from "prop-types";

import {
  Box,
  Menu,
  Stack,
  Button,
  Divider,
  Checkbox,
  MenuItem,
  TextField,
  Typography,
  IconButton,
  InputAdornment,
  FormControlLabel,
  Tooltip,
  Badge,
} from "@mui/material";

import Iconify from "src/components/iconify";
import { statusColor } from "src/sections/map/recountStatus";

// ----------------------------------------------------------------------
// Суурин судалгаа — хүснэгтийн toolbar: нэрээр хайх, ангиллын 3 түвшин,
// төлөв (олон сонголт), байршилгүй шүүлт, сангаас импортлох.
// ----------------------------------------------------------------------

export default function RecountTableToolbar({
  // хайлт
  search,
  onSearch,
  // дэлгэрэнгүй хайлт
  onAdvanced,
  advancedActive,
  canReset,
  onReset,
  // төлөв
  statuses,
  selectedStatuses,
  onStatuses,
  stMenu,
  onStMenu,
  // байршилгүй
  noGeom,
  onNoGeom,
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
            // хайлт/сонголтын талбартай ижил өндөр (MUI small input = 40px)
            height: 40,
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
        <Tooltip title="Дэлгэрэнгүй хайлт">
          <IconButton color="inherit" onClick={onAdvanced}>
            <Badge color="error" variant="dot" invisible={!advancedActive}>
              <Iconify icon="solar:filter-bold" />
            </Badge>
          </IconButton>
        </Tooltip>

        <Tooltip title="Шүүлт цэвэрлэх">
          <IconButton onClick={onReset}>
            <Badge color="error" variant="dot" invisible={!canReset}>
              <Iconify icon="solar:restart-bold" />
            </Badge>
          </IconButton>
        </Tooltip>
      </Stack>
    </Stack>
  );
}

RecountTableToolbar.propTypes = {
  search: PropTypes.string,
  onSearch: PropTypes.func,
  onAdvanced: PropTypes.func,
  advancedActive: PropTypes.bool,
  canReset: PropTypes.bool,
  onReset: PropTypes.func,
  statuses: PropTypes.array,
  selectedStatuses: PropTypes.array,
  onStatuses: PropTypes.func,
  stMenu: PropTypes.any,
  onStMenu: PropTypes.func,
  noGeom: PropTypes.bool,
  onNoGeom: PropTypes.func,
};
