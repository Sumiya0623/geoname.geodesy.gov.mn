import PropTypes from "prop-types";
import { useState, memo } from "react";
import dayjs from "dayjs";

import {
  Button,
  Tooltip,
  Typography,
  IconButton,
  MenuItem,
  TableCell,
  TableRow,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
} from "@mui/material";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import { useSnackbar } from "notistack";
import { useBoolean } from "src/hooks/use-boolean";
import Iconify from "src/components/iconify";
import { ConfirmDialog } from "src/components/custom-dialog";
import CustomPopover, { usePopover } from "src/components/custom-popover";
import axiosInstance from "src/utils/axios";
import SlotsDialog from "./log-slot-dialog";
import { useGetIntents } from "src/api/nl-log";

function safeStringify(val, fallback = "") {
  try {
    if (val == null) return fallback;
    if (typeof val === "string") return val;
    return JSON.stringify(val);
  } catch (e) {
    return fallback;
  }
}

function TruncateCell({ value, max = 300, monospace = false }) {
  const raw = safeStringify(value, "");
  const isTruncated = raw.length > max;
  const display = isTruncated ? raw.slice(0, max) + "…" : raw;

  return (
    <TableCell
      sx={{
        maxWidth: 0,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        fontFamily: monospace
          ? "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
          : "inherit",
      }}
    >
      <Tooltip
        title={
          isTruncated ? (
            <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {raw}
            </span>
          ) : (
            ""
          )
        }
        disableHoverListener={!isTruncated}
        placement="top"
        arrow
      >
        <Typography component="span">{display}</Typography>
      </Tooltip>
    </TableCell>
  );
}

TruncateCell.propTypes = {
  value: PropTypes.any,
  max: PropTypes.number,
  monospace: PropTypes.bool,
};

function LogTableRow({
  row,
  rowQueue,
  onDeleteRow,
  onRowPatched, // эцэг компонент руу локал өөрчлөлт дамжуулах (thumb шинэчилэхэд)
  menuPermissions,
  refetch,
}) {
  const { page, rowsPerPage, index } = rowQueue || {};
  const { enqueueSnackbar } = useSnackbar();
  const { intents } = useGetIntents();
  const confirm = useBoolean();
  const popover = usePopover();
  const [loading, setLoading] = useState(false);

  const {
    id,
    conversation_id,
    user_query_raw,
    predicted_intent,
    predicted_slots,
    bot_response_text,
    ts,
    thumb,
    gold_intent,
    gold_slots,
  } = row || {};

  // зөв endpoint: POST /api/chatlog/:id/set-thumb/  body: { thumb: -1|0|1 }
  const sendFeedback = async (newThumb) => {
    if (!id || loading) return;
    setLoading(true);
    try {
      const { data, status } = await axiosInstance.patch(
        `/api/point/chatlog/${id}/`,
        { thumb: Number(newThumb) },
      );
      if (status === 200 && (data?.ok || typeof data?.thumb !== "undefined")) {
        enqueueSnackbar("Үнэлгээ бүртгэгдлээ", { variant: "success" });
        refetch();
        if (typeof onRowPatched === "function")
          onRowPatched({ thumb: newThumb });
      } else {
        enqueueSnackbar("Үнэлгээг илгээх үед алдаа гарлаа", {
          variant: "warning",
        });
      }
    } catch (e) {
      enqueueSnackbar("Үнэлгээ өөрчлөх үед алдаа гарлаа", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const [labelOpen, setLabelOpen] = useState(false);
  const [labelIntent, setLabelIntent] = useState(null);
  const [slotsOpen, setSlotsOpen] = useState(false);

  const labelRow = async (gold_intent, gold_slots = {}) => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, status } = await axiosInstance.post(
        `/api/point/chatlog/${id}/label/`,
        { gold_intent, gold_slots },
      );
      if (status === 200 && (data?.ok || true)) {
        enqueueSnackbar("Gold хадгаллаа", { variant: "success" });
        // хүсвэл thumbs-ийг автоматаар 👍 болгоно
        if (typeof onRowPatched === "function") {
          onRowPatched({ gold_intent, gold_slots, thumb: 1 });
        }
      } else {
        enqueueSnackbar("Gold хадгалах үед алдаа", { variant: "warning" });
      }
    } catch (e) {
      enqueueSnackbar("Gold хадгалах үед алдаа", { variant: "error" });
    } finally {
      setLoading(false);
      setLabelOpen(false);
      setSlotsOpen(false);
    }
  };

  const tsString = ts ? dayjs(ts).format("YYYY-MM-DD HH:mm") : "";

  const shortUUID =
    typeof conversation_id === "string" && conversation_id.length > 12
      ? conversation_id.slice(0, 8) + "…" + conversation_id.slice(-4)
      : conversation_id || "-";

  return (
    <>
      <TableRow
        sx={{
          backgroundColor:
            thumb === 1
              ? "success.lighter"
              : thumb === -1
                ? "error.lighter"
                : "inherit",
          "&:hover": {
            backgroundColor:
              thumb === 1
                ? "success.light"
                : thumb === -1
                  ? "error.light"
                  : "action.hover",
          },
          transition: "background-color .15s ease",
        }}
      >
        <TableCell>{page * rowsPerPage + index + 1}</TableCell>

        <TableCell
          sx={{
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          }}
        >
          <Tooltip title={String(conversation_id || "")} placement="top" arrow>
            <span>{shortUUID}</span>
          </Tooltip>
        </TableCell>

        <TableCell>{user_query_raw}</TableCell>

        <TableCell>
          <Tooltip title={predicted_intent || ""} arrow>
            <Typography fontWeight={600}>{predicted_intent || "-"}</Typography>
          </Tooltip>
        </TableCell>

        <TruncateCell value={predicted_slots} max={160} monospace />

        <TableCell sx={{ whiteSpace: "nowrap" }}>{tsString}</TableCell>

        <TableCell sx={{ px: 1 }}>
          <Box sx={{ display: "flex", gap: 0.5 }} id={`nl-rate-${index}`}>
            <Tooltip title="Зөв" arrow>
              <IconButton
                size="small"
                disabled={loading}
                onClick={() => sendFeedback(1)}
              >
                <ThumbUpIcon
                  fontSize="small"
                  color={thumb === 1 ? "success" : "inherit"}
                />
              </IconButton>
            </Tooltip>

            <Tooltip title="Буруу" arrow>
              <IconButton
                size="small"
                disabled={loading}
                onClick={() => sendFeedback(-1)}
              >
                <ThumbDownIcon
                  fontSize="small"
                  color={thumb === -1 ? "error" : "inherit"}
                />
              </IconButton>
            </Tooltip>
          </Box>
        </TableCell>

        <TruncateCell value={bot_response_text} max={300} />
        <TruncateCell value={gold_intent} max={160} monospace />
        <TruncateCell value={gold_slots} max={160} monospace />

        <TableCell align="right" sx={{ px: 1 }}>
          <IconButton
            color={popover.open ? "inherit" : "default"}
            onClick={popover.onOpen}
            id={`nl-gold-${index}`}
          >
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </TableCell>
      </TableRow>

      <CustomPopover
        open={popover.open}
        onClose={popover.onClose}
        arrow="right-top"
        sx={{ width: 180 }}
      >
        {/* TODO: YMAR ERH UGUH WE */}
        {/* {menuPermissions?.delete && (
      )} */}
        <MenuItem
          onClick={() => {
            setLabelOpen(true);
            popover.onClose();
          }}
        >
          <Iconify icon="mdi:label" />
          Label (gold)
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        {menuPermissions?.delete && (
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
        )}
      </CustomPopover>

      {menuPermissions?.delete && (
        <ConfirmDialog
          open={confirm.value}
          onClose={confirm.onFalse}
          title="Устгах"
          content={
            <>
              Та <strong>{id}</strong> дугаартай log устгахдаа итгэлтэй байна
              уу?
            </>
          }
          action={
            <Button variant="contained" color="error" onClick={onDeleteRow}>
              Устгах
            </Button>
          }
        />
      )}

      <Dialog
        open={labelOpen}
        onClose={() => setLabelOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Gold intent сонгох</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Асуулт: <b>{user_query_raw}</b>
          </Typography>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {intents.map((it) => (
              <Button
                key={it.code}
                size="small"
                variant={it.code === labelIntent ? "contained" : "outlined"}
                onClick={() => setLabelIntent(it.code)}
              >
                {it.label}
              </Button>
            ))}
          </div>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: "block" }}
          >
            Сонгосны дараа шууд хадгалах эсвэл slots-оо засах боломжтой.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLabelOpen(false)}>Буцах</Button>
          <Button
            onClick={() => {
              if (!labelIntent)
                return enqueueSnackbar("Intent сонгоно уу", {
                  variant: "info",
                });
              // Шууд хадгалах (slots хоосон)
              labelRow(labelIntent, {});
            }}
          >
            Зөвхөн intent хадгал
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!labelIntent)
                return enqueueSnackbar("Intent сонгоно уу", {
                  variant: "info",
                });
              setSlotsOpen(true); // дараагийн Dialog нээнэ
            }}
          >
            Intent + slots засах
          </Button>
        </DialogActions>
      </Dialog>

      <SlotsDialog
        open={slotsOpen}
        onClose={() => setSlotsOpen(false)}
        initial={row?.gold_slots || row?.predicted_slots || {}}
        onSave={(json) => labelRow(labelIntent, json)}
      />
    </>
  );
}

export default memo(LogTableRow);

LogTableRow.propTypes = {
  row: PropTypes.object.isRequired,
  rowQueue: PropTypes.shape({
    page: PropTypes.number.isRequired,
    rowsPerPage: PropTypes.number.isRequired,
    index: PropTypes.number.isRequired,
  }).isRequired,
  onDeleteRow: PropTypes.func.isRequired,
  onRowPatched: PropTypes.func,
  menuPermissions: PropTypes.object,
  refetch: PropTypes.func,
};
