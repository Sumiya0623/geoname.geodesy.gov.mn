import PropTypes from "prop-types";
import { useState } from "react";

import {
  Menu,
  Stack,
  Badge,
  Divider,
  Tooltip,
  MenuItem,
  Checkbox,
  TextField,
  IconButton,
  InputAdornment,
  FormControlLabel,
} from "@mui/material";

import Iconify from "src/components/iconify";
import {
  SelectAllIcon,
  DeselectAllIcon,
  InvertSelectionIcon,
} from "src/utils/qgis-icons";

// ----------------------------------------------------------------------
// Доод attribute хүснэгтийн ТООЛБАР (map.geodesy‑ийн feature toolbar‑ын
// geoname хувилбар). Багана сонгож хайх, сонголтын үйлдлүүд, багана
// нуух/харуулах, шүүлт цэвэрлэх, таб хаах.
// ----------------------------------------------------------------------

export default function FeatureTableToolbar({
  cols = [],
  // Хайлтад санал болгох багана — зөвхөн ХАРАГДАЖ буй нь (нуусныг оруулахгүй)
  searchCols = null,
  searchCol,
  onSearchCol,
  searchText = "",
  onSearchText,
  hiddenCols,
  onToggleCol,
  selectedCount = 0,
  filteringSelected = false,
  onSelectAll,
  onInvertSelection,
  onDeselectAll,
  onFilterSelected,
  canReset = false,
  onReset,
  onClose,
  onFieldCalc,
}) {
  const [colMenu, setColMenu] = useState(null);

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{
        p: 1.25,
        pl: 2,
        flexWrap: "wrap",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <TextField
        size="small"
        value={searchText}
        placeholder={searchCol || "Хайх"}
        onChange={(e) => onSearchText?.(e.target.value)}
        sx={{ minWidth: 180, maxWidth: 240 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Iconify icon="eva:search-fill" sx={{ color: "text.disabled" }} />
            </InputAdornment>
          ),
        }}
      />

      <TextField
        select
        size="small"
        value={searchCol || ""}
        onChange={(e) => onSearchCol?.(e.target.value)}
        sx={{ minWidth: 150 }}
      >
        <MenuItem value="">
          <em>Бүх багана</em>
        </MenuItem>
        {(searchCols || cols).map((c) => (
          <MenuItem key={c} value={c}>
            {c}
          </MenuItem>
        ))}
      </TextField>

      {onFieldCalc && (
        <Tooltip title="Field Calculator — талбарыг бөөнөөр шинэчлэх">
          <IconButton size="small" onClick={onFieldCalc}>
            <Iconify icon="tabler:math-function" />
          </IconButton>
        </Tooltip>
      )}

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <Tooltip title="Бүгдийг сонгох">
        <IconButton size="small" onClick={onSelectAll}>
          <SelectAllIcon size={20} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Сонголт эргүүлэх">
        <IconButton size="small" onClick={onInvertSelection}>
          <InvertSelectionIcon size={20} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Сонголт цуцлах">
        <span>
          <IconButton
            size="small"
            onClick={onDeselectAll}
            disabled={selectedCount === 0}
            sx={{ opacity: selectedCount > 0 ? 1 : 0.4 }}
          >
            <DeselectAllIcon size={20} />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip
        title={
          filteringSelected
            ? "Бүх мөрийг харуулах"
            : "Зөвхөн сонгосныг харуулах"
        }
      >
        <span>
          <IconButton
            size="small"
            onClick={onFilterSelected}
            color={filteringSelected ? "primary" : "default"}
            disabled={selectedCount === 0 && !filteringSelected}
          >
            <Iconify icon="mdi:filter" />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Багана харуулах/нуух">
        <IconButton size="small" onClick={(e) => setColMenu(e.currentTarget)}>
          <Iconify icon="mdi:table-column" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={colMenu}
        open={!!colMenu}
        onClose={() => setColMenu(null)}
        slotProps={{ paper: { sx: { maxHeight: 320, minWidth: 200 } } }}
      >
        {cols.map((c) => (
          <MenuItem key={c} dense onClick={() => onToggleCol?.(c)}>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={!hiddenCols?.has(c)}
                  sx={{ p: 0.5, mr: 1 }}
                />
              }
              label={c}
              sx={{ m: 0, width: "100%" }}
            />
          </MenuItem>
        ))}
      </Menu>

      <Tooltip title="Шүүлт цэвэрлэх">
        <IconButton size="small" onClick={onReset}>
          <Badge color="error" variant="dot" invisible={!canReset}>
            <Iconify icon="solar:restart-bold" />
          </Badge>
        </IconButton>
      </Tooltip>

      {onClose && (
        <Tooltip title="Хаах">
          <IconButton size="small" onClick={onClose}>
            <Iconify icon="eva:close-fill" />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
}

FeatureTableToolbar.propTypes = {
  cols: PropTypes.array,
  searchCols: PropTypes.array,
  searchCol: PropTypes.string,
  onSearchCol: PropTypes.func,
  searchText: PropTypes.string,
  onSearchText: PropTypes.func,
  hiddenCols: PropTypes.instanceOf(Set),
  onToggleCol: PropTypes.func,
  selectedCount: PropTypes.number,
  filteringSelected: PropTypes.bool,
  onSelectAll: PropTypes.func,
  onInvertSelection: PropTypes.func,
  onDeselectAll: PropTypes.func,
  onFilterSelected: PropTypes.func,
  canReset: PropTypes.bool,
  onReset: PropTypes.func,
  onClose: PropTypes.func,
  onFieldCalc: PropTypes.func,
};
