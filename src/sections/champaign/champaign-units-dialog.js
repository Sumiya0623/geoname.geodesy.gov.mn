"use client";

import PropTypes from "prop-types";
import { useMemo, useState } from "react";

import {
  Box,
  Chip,
  Alert,
  Stack,
  Button,
  Dialog,
  MenuItem,
  TextField,
  Typography,
  DialogTitle,
  DialogActions,
  DialogContent,
  CircularProgress,
} from "@mui/material";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetLegalUnits } from "src/api/legal";
import { useGetChampaign } from "src/api/champaign";

import Iconify from "src/components/iconify";
import { useSnackbar } from "src/components/snackbar";
import { ConfirmDialog } from "src/components/custom-dialog";

// ----------------------------------------------------------------------
// Төслийн ХАМРАХ засаг захиргааны нэгж (Project.units M2M) — нэмэх/хасах.
// Аймаг → Сум сонгож нэмнэ; chip дээрх × дарж хасна. Хадгалалт нь бүтэн
// unit_ids жагсаалтыг PATCH хийж хийгдэнэ.
// ----------------------------------------------------------------------

export default function ChampaignUnitsDialog({
  projectId,
  projectName,
  open,
  onClose,
  canAdd = false,
  canRemove = false,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const { champaign, champaignMutation } = useGetChampaign(projectId);

  const [aimag, setAimag] = useState("");
  const [sum, setSum] = useState("");
  const [saving, setSaving] = useState(false);

  const { units: aimagOptions } = useGetLegalUnits("Аймаг/Нийслэл", null, true);
  const { units: sumOptions } = useGetLegalUnits(
    "Сум/Дүүрэг",
    aimag || null,
    !!aimag,
  );

  const units = useMemo(() => champaign?.units || [], [champaign]);
  const unitIds = useMemo(() => units.map((u) => u.id), [units]);

  // add/remove тус бүр ӨӨР эрхтэй endpoint рүү очно (unit_add / unit_remove)
  const save = async (mode, unitId, okMsg) => {
    setSaving(true);
    try {
      const url =
        mode === "add"
          ? endpoints.champaign.unitAdd(projectId)
          : endpoints.champaign.unitRemove(projectId);
      await axiosInstance.post(url, { units: [unitId] });
      champaignMutation && champaignMutation();
      enqueueSnackbar(okMsg);
    } catch (error) {
      enqueueSnackbar(
        error?.response?.data?.detail || "Хадгалахад алдаа гарлаа",
        { variant: "error" },
      );
    } finally {
      setSaving(false);
    }
  };

  // Баталгаажуулах цонх — {mode: 'add'|'remove', id, label}
  const [confirm, setConfirm] = useState(null);
  // Хасалт нь эргэлт буцалтгүй тул "confirm" гэж бичихийг шаардана
  const [confirmText, setConfirmText] = useState("");
  const CONFIRM_WORD = "confirm";
  const removeAllowed =
    confirmText.trim().toLowerCase() === CONFIRM_WORD;

  const closeConfirm = () => {
    setConfirm(null);
    setConfirmText("");
  };

  const askAdd = () => {
    setConfirmText("");
    const id = Number(sum || aimag);
    if (!id || unitIds.includes(id)) return;
    const a = aimagOptions.find((u) => String(u.id) === String(aimag));
    const sm = sumOptions.find((u) => String(u.id) === String(sum));
    setConfirm({
      mode: "add",
      id,
      label: sm ? `${a?.unit || ""}, ${sm.unit}` : `${a?.unit || ""} (бүх сум)`,
    });
  };

  const askRemove = (u) => {
    setConfirmText("");
    setConfirm({
      mode: "remove",
      id: u.id,
      label: u.parent_unit ? `${u.parent_unit}, ${u.unit}` : u.unit,
    });
  };

  const doConfirm = async () => {
    if (!confirm) return;
    if (confirm.mode === "remove" && !removeAllowed) return;
    if (confirm.mode === "add") {
      await save("add", confirm.id, "Засаг захиргаа нэмэгдлээ");
      setSum("");
    } else {
      await save("remove", confirm.id, "Засаг захиргаа хасагдлаа");
    }
    closeConfirm();
  };

  if (!projectId) return null;

  return (
    <Dialog open={!!open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>
        Төслийн хамрах засаг захиргаа
        {projectName ? (
          <Typography variant="caption" component="div" color="text.secondary">
            {projectName}
          </Typography>
        ) : null}
      </DialogTitle>
      <DialogContent dividers>
      {saving && (
        <Stack alignItems="center" sx={{ mb: 1 }}>
          <CircularProgress size={16} />
        </Stack>
      )}

      {/* Одоогийн нэгжүүд — × дарж хасна */}
      <Box sx={{ mb: 2 }}>
        {units.length ? (
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {units.map((u) => (
              <Chip
                key={u.id}
                variant="outlined"
                disabled={saving}
                onDelete={canRemove ? () => askRemove(u) : undefined}
                label={
                  u.parent_unit ? `${u.parent_unit}, ${u.unit}` : u.unit
                }
              />
            ))}
          </Stack>
        ) : (
          <Typography variant="caption" color="text.secondary">
            Хамрах засаг захиргаа сонгоогүй байна.
          </Typography>
        )}
      </Box>

      {/* Нэмэх — Аймаг → Сум (зөвхөн unit_add эрхтэй үед) */}
      {canAdd && (
      <Box
        gap={1.5}
        display="grid"
        gridTemplateColumns={{
          xs: "repeat(1, 1fr)",
          sm: "1fr 1fr auto",
        }}
        alignItems="center"
        sx={{
          width: "100%",
          "& .MuiInputBase-root": { height: 40 },
        }}
      >
        <TextField
          select
          label="Аймаг/Нийслэл"
          value={aimag}
          onChange={(e) => {
            setAimag(e.target.value);
            setSum("");
          }}
        >
          <MenuItem value="">Сонгох</MenuItem>
          {aimagOptions.map((u) => (
            <MenuItem key={u.id} value={u.id}>
              {u.unit}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Сум/Дүүрэг"
          value={sum}
          disabled={!aimag}
          onChange={(e) => setSum(e.target.value)}
        >
          <MenuItem value="">Бүх сум (аймгаар)</MenuItem>
          {sumOptions.map((u) => (
            <MenuItem key={u.id} value={u.id}>
              {u.unit}
            </MenuItem>
          ))}
        </TextField>

        <Button
          variant="outlined"
          startIcon={<Iconify icon="mingcute:add-line" />}
          disabled={!aimag || saving || unitIds.includes(Number(sum || aimag))}
          onClick={askAdd}
          sx={{ height: 40, flexShrink: 0, whiteSpace: "nowrap" }}
        >
          Нэмэх
        </Button>
      </Box>
      )}
      {!canAdd && !canRemove && (
        <Alert severity="info" variant="outlined">
          Танд засаг захиргаа нэмэх/хасах эрх байхгүй байна.
        </Alert>
      )}

      {/* Хүчтэй анхааруулга — нэмэх / хасах хоёуланд нь */}
      <ConfirmDialog
        maxWidth="sm"
        open={!!confirm}
        onClose={closeConfirm}
        title={
          confirm?.mode === "add"
            ? "Засаг захиргаа НЭМЭХ үү?"
            : "Засаг захиргаа ХАСАХ уу?"
        }
        content={
          confirm?.mode === "add" ? (
            <Stack spacing={1.5}>
              <Typography variant="body2">
                Та <b>{confirm?.label}</b>‑ыг энэ төсөлд нэмэхдээ итгэлтэй
                байна уу?
              </Typography>
              <Alert severity="warning" variant="outlined">
                Нэмснээр тухайн <b>аймаг/сумын бүртгэлтэй бүх газар зүйн нэрс
                энэ төсөлд орж ирнэ</b>. Төслийн хамрах хүрээ, тодруулалтын
                жагсаалт, ажлын зураг зэрэг нь тэр дагуу өөрчлөгдөнө.
              </Alert>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              <Typography variant="body2">
                Та <b>{confirm?.label}</b>‑ыг энэ төслөөс хасахдаа итгэлтэй
                байна уу?
              </Typography>
              <Alert severity="error" variant="outlined">
                Хасвал төслийн хүрээнд <b>өмнө нэмсэн нэрс, тодруулалтын
                ажлууд бүгд хасагдана</b>. Энэ үйлдлийг буцаах боломжгүй —
                дахин нэмсэн ч өмнөх ажлын үр дүн сэргэхгүй.
              </Alert>
              <TextField
                autoFocus
                fullWidth
                label={`Баталгаажуулахын тулд "${CONFIRM_WORD}" гэж бичнэ үү`}
                placeholder={CONFIRM_WORD}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                error={!!confirmText && !removeAllowed}
                helperText={
                  confirmText && !removeAllowed
                    ? `Яг "${CONFIRM_WORD}" гэж бичнэ`
                    : " "
                }
              />
            </Stack>
          )
        }
        action={
          <Button
            variant="contained"
            color={confirm?.mode === "add" ? "primary" : "error"}
            disabled={
              saving || (confirm?.mode === "remove" && !removeAllowed)
            }
            onClick={doConfirm}
          >
            {confirm?.mode === "add" ? "Тийм, нэмэх" : "Тийм, хасах"}
          </Button>
        }
      />
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Хаах
        </Button>
      </DialogActions>
    </Dialog>
  );
}

ChampaignUnitsDialog.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  projectName: PropTypes.string,
  open: PropTypes.bool,
  onClose: PropTypes.func,
  canAdd: PropTypes.bool,
  canRemove: PropTypes.bool,
};
