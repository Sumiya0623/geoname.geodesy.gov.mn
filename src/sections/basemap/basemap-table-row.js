import PropTypes from "prop-types";

import MenuItem from "@mui/material/MenuItem";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import IconButton from "@mui/material/IconButton";
import {
  Box,
  Chip,
  Stack,
  Switch,
  Button,
  Divider,
  Collapse,
  Typography,
} from "@mui/material";

import { useBoolean } from "src/hooks/use-boolean";

import Iconify from "src/components/iconify";
import { ConfirmDialog } from "src/components/custom-dialog";
import CustomPopover, { usePopover } from "src/components/custom-popover";

import BaseMapNewEditForm from "./basemap-new-edit-form";

// ----------------------------------------------------------------------

export default function BaseMapTableRow({
  row,
  refetch,
  onDeleteRow,
  onToggleEnabled,
  roles,
  available,
  layers,
}) {
  const {
    key,
    label,
    layer_type: layerType,
    source_type: sourceType,
    gs_layer: gsLayer,
    url,
    color,
    is_enabled: isEnabled,
    sort_order: sortOrder,
    roles: rowRoles,
  } = row;

  const form = useBoolean();
  const confirm = useBoolean();
  const popover = usePopover();

  return (
    <>
      <TableRow sx={{ "& > *": { borderBottom: "unset" } }} hover>
        {/* Нэр (дор нь түлхүүр) — нэг баганад */}
        <TableCell>
          <Stack direction="row" alignItems="center" spacing={1}>
            {color ? (
              <Box
                component="span"
                sx={{
                  width: 10,
                  height: 10,
                  flexShrink: 0,
                  borderRadius: "50%",
                  bgcolor: color,
                }}
              />
            ) : null}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {key}
              </Typography>
            </Box>
          </Stack>
        </TableCell>
        {/* Эрэмбэ — газрын зурагт давхарлах дараалал (1 нь хамгийн дээр) */}
        <TableCell>
          <Chip
            size="small"
            variant="soft"
            color={sortOrder ? "default" : "error"}
            label={sortOrder || "—"}
          />
        </TableCell>
        <TableCell>
          <Chip
            size="small"
            variant="soft"
            color={layerType === "base" ? "primary" : "info"}
            label={layerType === "base" ? "Суурь" : "Нэмэлт"}
          />
        </TableCell>
        <TableCell>{sourceType}</TableCell>
        <TableCell
          sx={{
            maxWidth: 220,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {gsLayer || url || "—"}
        </TableCell>
        <TableCell>
          {rowRoles?.length ? (
            <Stack direction="row" spacing={0.5} flexWrap="wrap">
              {rowRoles.map((r) => (
                <Chip
                  key={r.id}
                  size="small"
                  variant="outlined"
                  label={r.name}
                />
              ))}
            </Stack>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Бүгд
            </Typography>
          )}
        </TableCell>
        <TableCell align="center">
          <Switch
            size="small"
            checked={!!isEnabled}
            onChange={() => onToggleEnabled(row)}
          />
        </TableCell>
        <TableCell align="right" sx={{ px: 1 }}>
          <IconButton
            color={popover.open ? "inherit" : "default"}
            onClick={popover.onOpen}
          >
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
          <Collapse in={form.value} timeout="auto" unmountOnExit>
            <Box sx={{ py: 2 }}>
              <BaseMapNewEditForm
                currentItem={row}
                onCloseForm={form.onFalse}
                refetch={refetch}
                roles={roles}
                available={available}
                layers={layers}
              />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>

      <CustomPopover
        open={popover.open}
        onClose={popover.onClose}
        arrow="right-top"
        sx={{ width: 160 }}
      >
        <MenuItem
          onClick={() => {
            form.onToggle();
            popover.onClose();
          }}
        >
          <Iconify icon="solar:pen-bold" />
          Засах
        </MenuItem>
        <Divider sx={{ borderStyle: "dashed" }} />
        <MenuItem
          onClick={() => {
            confirm.onTrue();
            popover.onClose();
          }}
          sx={{ color: "error.main" }}
        >
          <Iconify icon="solar:trash-bin-trash-bold" />
          Устгах
        </MenuItem>
      </CustomPopover>

      <ConfirmDialog
        open={confirm.value}
        onClose={confirm.onFalse}
        title="Устгах"
        content={
          <>
            <strong>{label}</strong> давхаргыг устгах уу?
          </>
        }
        action={
          <Button variant="contained" color="error" onClick={onDeleteRow}>
            Устгах
          </Button>
        }
      />
    </>
  );
}

BaseMapTableRow.propTypes = {
  row: PropTypes.object,
  refetch: PropTypes.func,
  onDeleteRow: PropTypes.func,
  onToggleEnabled: PropTypes.func,
  roles: PropTypes.array,
  available: PropTypes.array,
  layers: PropTypes.array,
};
