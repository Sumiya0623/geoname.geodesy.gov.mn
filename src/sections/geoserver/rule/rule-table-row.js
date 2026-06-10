import TableRow from "@mui/material/TableRow";
import {
  Button,
  Divider,
  IconButton,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Chip,
} from "@mui/material";
import TableCell from "@mui/material/TableCell";
import Image from "next/image";

import { useBoolean } from "src/hooks/use-boolean";
import CustomPopover, { usePopover } from "src/components/custom-popover";
import Iconify from "src/components/iconify";
import { ConfirmDialog } from "src/components/custom-dialog";

import RuleNewEditForm from "./rule-new-edit-form";

const OP_LABELS = {
  eq: "=",
  neq: "≠",
  lt: "<",
  lte: "≤",
  gt: ">",
  gte: "≥",
  contains: "contains",
  startsWith: "startsWith",
  endsWith: "endsWith",
  between: "between",
  in: "in",
  isnull: "IS NULL",
  isnotnull: "IS NOT NULL",
};

export default function RuleTableRow({
  row,
  rowQueue,
  onDeleteRow,
  refetch,
  layerId,
}) {
  const form = useBoolean();
  const confirm = useBoolean();
  const popover = usePopover();
  const { page, rowsPerPage, index } = rowQueue;
  const { id, filters, fill_color, size, symbolizer, icon } = row;

  return (
    <>
      <TableRow>
        <TableCell>{page * rowsPerPage + index + 1}</TableCell>
        <TableCell>{id}</TableCell>
        <TableCell>
          {Array.isArray(filters) && filters.length ? (
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {filters.map((f, i) => (
                <Chip
                  key={f.id ?? i}
                  size="small"
                  label={`${f.field ?? "?"} ${OP_LABELS[f.operator] ?? f.operator} ${f.value ?? ""}`}
                  variant="outlined"
                />
              ))}
            </Stack>
          ) : (
            "—"
          )}
        </TableCell>

        <TableCell>{symbolizer || "—"}</TableCell>
        <TableCell>{fill_color || "—"}</TableCell>
        <TableCell>{size || "—"}</TableCell>

        <TableCell>
          {icon ? (
            <Image
              src={icon}
              alt={`rule-${id}`}
              width={24}
              height={24}
              onError={(e) => {
                e.currentTarget.src = "/assets/icons/empty/ic_folder_empty.svg";
                e.currentTarget.title = "icon олдсонгүй дахин upload хийнэ үү.";
                e.currentTarget.onerror = null;
              }}
            />
          ) : (
            "-"
          )}
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

      <Dialog open={form.value} onClose={form.onFalse} fullWidth maxWidth="md">
        <DialogTitle>Дүрэм засах</DialogTitle>
        <DialogContent dividers>
          <RuleNewEditForm
            currentRule={row}
            onCloseForm={form.onFalse}
            refetch={refetch}
            layerId={layerId}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={form.onFalse}>Хаах</Button>
        </DialogActions>
      </Dialog>

      <CustomPopover
        open={popover.open}
        onClose={popover.onClose}
        arrow="right-top"
        sx={{ width: 200 }}
      >
        <MenuItem
          onClick={() => {
            form.onTrue();
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
            Та <strong>{`Дүрэм #${id}`}</strong> дүрмийг устгахдаа итгэлтэй байна
            уу?
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
