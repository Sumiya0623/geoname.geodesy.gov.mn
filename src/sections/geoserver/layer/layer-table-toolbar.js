import PropTypes from "prop-types";
import { useCallback } from "react";
import Stack from "@mui/material/Stack";
import {
  Collapse,
  Box,
  Button,
  IconButton,
  Badge,
} from "@mui/material";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";

import Iconify from "src/components/iconify";

import { useBoolean } from "src/hooks/use-boolean";



import LayerNewEditForm from "./layer-new-edit-form";

// ----------------------------------------------------------------------

export default function LayerTableToolbar({
  onReset,
  refetch,
  filters,
  canReset,
  onFilters,
  stId,
  menuPermissions,
}) {
  const formUnit = useBoolean();
  const form = useBoolean();

  const handleFilterField = useCallback(
    (field) => (event) => {
      onFilters(field, event.target.value);
    },
    [onFilters]
  );

  return (
    <>
      <Stack
        spacing={2}
        alignItems={{ xs: "stretch", md: "center" }}
        direction={{ xs: "column", md: "row" }}
        sx={{ px: 2.5, my: 2 }}
      >
        <TextField
          fullWidth
          placeholder="Нэрээр..."
          value={filters.point__name}
          onChange={handleFilterField("point__name")}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify
                  icon="eva:search-fill"
                  sx={{ color: "text.disabled" }}
                />
              </InputAdornment>
            ),
          }}
        />

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="flex-end"
          sx={{ flexShrink: 0 }}
        >
          <Button
            startIcon={<Iconify icon="ic:round-filter-list" />}
            onClick={formUnit.onToggle}
          >
            Шүүлт
          </Button>
          {menuPermissions?.create && (
            <IconButton onClick={form.onToggle}>
              <Badge color="error" variant="dot" invisible={!canReset}>
                <Iconify icon="ic:baseline-plus" />
              </Badge>
            </IconButton>
          )}
        </Stack>
      </Stack>
      <Stack>
        <Collapse in={form.value} timeout="auto" unmountOnExit>
          <Box sx={{ p: 1.5, mb: { xs: 3, md: 1 } }}>
            <LayerNewEditForm onCloseForm={form.onFalse} refetch={refetch} stId={stId}/>
          </Box>
        </Collapse>
      </Stack>
    </>
  );
}

LayerTableToolbar.propTypes = {
  onReset: PropTypes.func,
  canReset: PropTypes.bool,
  filters: PropTypes.object,
  onFilters: PropTypes.func,
  refetch: PropTypes.func,
  stId: PropTypes.number,
};
