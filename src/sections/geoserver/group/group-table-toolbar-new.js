import PropTypes from "prop-types";
import { useCallback } from "react";
import Stack from "@mui/material/Stack";
import {
  Button,
  IconButton,
  Collapse,
  Box,
} from "@mui/material";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";

import Iconify from "src/components/iconify";
import { useBoolean } from "src/hooks/use-boolean";
import GroupNewEditForm from "./group-new-edit-form";

// ----------------------------------------------------------------------

export default function GroupTableToolbar({
  onReset,
  refetch,
  filters,
  canReset,
  onFilters,
}) {
  const form = useBoolean();

  const handleFilterName = useCallback(
    (event) => {
      onFilters("name", event.target.value);
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
          placeholder="Групын нэрээр хайх..."
          value={filters.name}
          onChange={handleFilterName}
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
          {canReset && (
            <IconButton onClick={onReset}>
              <Iconify icon="solar:restart-bold" />
            </IconButton>
          )}

          <Button
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={form.onTrue}
          >
            Шинэ групп
          </Button>
        </Stack>
      </Stack>

      <Collapse in={form.value} timeout="auto" unmountOnExit>
        <Box sx={{ px: 2.5, pb: 2 }}>
          <GroupNewEditForm
            onCloseForm={form.onFalse}
            refetch={refetch}
          />
        </Box>
      </Collapse>
    </>
  );
}

GroupTableToolbar.propTypes = {
  onReset: PropTypes.func,
  refetch: PropTypes.func,
  filters: PropTypes.object,
  canReset: PropTypes.bool,
  onFilters: PropTypes.func,
};
