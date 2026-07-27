"use client";

import PropTypes from "prop-types";
import { useState, useEffect, useCallback } from "react";

import {
  Box,
  Card,
  Chip,
  Stack,
  Table,
  Button,
  Select,
  Tooltip,
  MenuItem,
  TableRow,
  TableBody,
  TableCell,
  TextField,
  TableHead,
  IconButton,
  Typography,
  InputLabel,
  FormControl,
} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";

import axiosInstance, { endpoints } from "src/utils/axios";
import {
  useGetWorkspaceLayers,
  useGetWorkspaceLayergroup,
  useGetWorkspaceLayergroups,
} from "src/api/workspace";

import Iconify from "src/components/iconify";
import { useSnackbar } from "src/components/snackbar";
import { ConfirmDialog } from "src/components/custom-dialog";
import { useBoolean } from "src/hooks/use-boolean";

// ----------------------------------------------------------------------
// GeoServer layer group (workspace‑scoped) удирдлага. Group доторх layer‑ийн
// эрэмбийг дээш/доош товчоор өөрчилж хадгална — эрэмбэ = зурах дараалал.
// ----------------------------------------------------------------------

const NEW = "__new__";

export default function WorkspaceLayerGroups({ workspaceId, workspaceName }) {
  const { enqueueSnackbar } = useSnackbar();
  const confirm = useBoolean();

  const { groups, groupsMutation } = useGetWorkspaceLayergroups(workspaceId);
  const { layers } = useGetWorkspaceLayers(workspaceId);

  const [selected, setSelected] = useState(""); // одоо засаж буй group нэр эсвэл NEW
  const { group, groupMutation } = useGetWorkspaceLayergroup(
    workspaceId,
    selected && selected !== NEW ? selected : null
  );

  const [name, setName] = useState("");
  const [rows, setRows] = useState([]); // [{ name: "ws:layer" }]
  const [addPick, setAddPick] = useState("");
  const [saving, setSaving] = useState(false);

  // Group сонгоход эсвэл дэлгэрэнгүй ирэхэд засварын төлвийг ачаална
  useEffect(() => {
    if (selected === NEW) {
      setName("");
      setRows([]);
    } else if (group && group.name === selected) {
      setName(group.name || "");
      setRows((group.layers || []).map((l) => ({ name: l.name })));
    }
  }, [selected, group]);

  const move = useCallback((idx, dir) => {
    setRows((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }, []);

  const removeRow = useCallback((idx) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const addRow = useCallback(() => {
    if (!addPick) return;
    setRows((prev) =>
      prev.some((r) => r.name === addPick) ? prev : [...prev, { name: addPick }]
    );
    setAddPick("");
  }, [addPick]);

  const handleSave = useCallback(async () => {
    if (!name.trim() || !rows.length) {
      enqueueSnackbar("Group нэр ба дор хаяж нэг layer шаардлагатай", {
        variant: "warning",
      });
      return;
    }
    setSaving(true);
    try {
      await axiosInstance.post(
        endpoints.workspace.gsSaveLayergroup(workspaceId),
        { name: name.trim(), mode: "SINGLE", layers: rows }
      );
      enqueueSnackbar("Layer group хадгалагдлаа", { variant: "success" });
      await groupsMutation();
      if (selected !== NEW) await groupMutation();
      setSelected(name.trim());
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.detail || e.message, {
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }, [
    name,
    rows,
    workspaceId,
    selected,
    groupsMutation,
    groupMutation,
    enqueueSnackbar,
  ]);

  const handleDelete = useCallback(async () => {
    try {
      await axiosInstance.post(
        endpoints.workspace.gsDeleteLayergroup(workspaceId),
        { name: selected }
      );
      enqueueSnackbar("Layer group устлаа", { variant: "success" });
      confirm.onFalse();
      setSelected("");
      setRows([]);
      setName("");
      await groupsMutation();
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.detail || e.message, {
        variant: "error",
      });
    }
  }, [workspaceId, selected, confirm, groupsMutation, enqueueSnackbar]);

  // Нэмэх сонголтод group‑д ороогүй layer‑ууд (ws:layer хэлбэрээр)
  const available = layers
    .map((l) => `${workspaceName}:${l.name}`)
    .filter((full) => !rows.some((r) => r.name === full));

  return (
    <Card sx={{ mt: 3, p: 2.5 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={1}
        sx={{ mb: 2 }}
      >
        <Typography variant="subtitle1">
          <Iconify
            icon="solar:layers-bold-duotone"
            sx={{ mr: 1, verticalAlign: "middle" }}
          />
          Layer group (давхаргын дараалал)
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Iconify icon="mingcute:add-line" />}
          onClick={() => setSelected(NEW)}
        >
          Шинэ group
        </Button>
      </Stack>

      {/* Байгаа group‑уудыг сонгох */}
      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
        {groups.map((g) => (
          <Chip
            key={g.name}
            label={g.name}
            color={selected === g.name ? "primary" : "default"}
            variant={selected === g.name ? "filled" : "soft"}
            onClick={() => setSelected(g.name)}
          />
        ))}
        {!groups.length && (
          <Typography variant="body2" color="text.secondary">
            Layer group алга — “Шинэ group”‑оор үүсгэнэ.
          </Typography>
        )}
      </Stack>

      {(selected === NEW || selected) && (
        <Box>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ mb: 2 }}
          >
            <TextField
              size="small"
              label="Group нэр"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={selected !== NEW}
              sx={{ minWidth: 220 }}
              helperText={
                selected !== NEW ? "Байгаа group‑ийн нэр өөрчлөгдөхгүй" : " "
              }
            />
            <FormControl size="small" sx={{ minWidth: 260 }}>
              <InputLabel>Layer нэмэх</InputLabel>
              <Select
                label="Layer нэмэх"
                value={addPick}
                onChange={(e) => setAddPick(e.target.value)}
              >
                {available.map((full) => (
                  <MenuItem key={full} value={full}>
                    {full}
                  </MenuItem>
                ))}
                {!available.length && (
                  <MenuItem disabled value="">
                    Бүх layer орсон
                  </MenuItem>
                )}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              onClick={addRow}
              disabled={!addPick}
              startIcon={<Iconify icon="mingcute:add-line" />}
            >
              Нэмэх
            </Button>
          </Stack>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 1 }}
          >
            Дээд мөр (№1) = газрын зураг дээр хамгийн дээр (foreground) харагдана.
            Жишээ: нуурыг элснээс дээр байлгахын тулд нуурыг элсний мөрөөс дээр
            зөөнө.
          </Typography>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={64}>Эрэмбэ</TableCell>{/* 1 = хамгийн дээр (foreground) */}
                <TableCell>Layer</TableCell>
                <TableCell align="right" width={140}>
                  Зөөх / устгах
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.name} hover>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Дээш">
                      <span>
                        <IconButton
                          size="small"
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        >
                          <Iconify icon="solar:alt-arrow-up-bold" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Доош">
                      <span>
                        <IconButton
                          size="small"
                          disabled={i === rows.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <Iconify icon="solar:alt-arrow-down-bold" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Хасах">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeRow(i)}
                      >
                        <Iconify icon="solar:trash-bin-trash-bold" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ color: "text.secondary" }}>
                    Layer нэмнэ үү.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <LoadingButton
              variant="contained"
              loading={saving}
              onClick={handleSave}
            >
              Хадгалах
            </LoadingButton>
            {selected !== NEW && selected && (
              <Button color="error" variant="outlined" onClick={confirm.onTrue}>
                Group устгах
              </Button>
            )}
          </Stack>
        </Box>
      )}

      <ConfirmDialog
        open={confirm.value}
        onClose={confirm.onFalse}
        title="Layer group устгах"
        content={`"${selected}" group‑ийг устгах уу?`}
        action={
          <Button variant="contained" color="error" onClick={handleDelete}>
            Устгах
          </Button>
        }
      />
    </Card>
  );
}

WorkspaceLayerGroups.propTypes = {
  workspaceId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  workspaceName: PropTypes.string,
};
