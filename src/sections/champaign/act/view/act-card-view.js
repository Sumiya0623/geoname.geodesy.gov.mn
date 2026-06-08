"use client";
import PropTypes from "prop-types";
import { useMemo, useCallback, useState } from "react";
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  Box,
  Button,
  Stack,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import Iconify from "src/components/iconify";
import Label from "src/components/label";
import ProfileAvatar from "src/components/profile-avatar";
import { fDate } from "src/utils/format-time";

import { enqueueSnackbar } from "notistack";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetActs } from "src/api/champaign";
import { useAuthContext } from "src/auth/hooks";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";
import { LoadingButton } from "@mui/lab";
import { useBoolean } from "src/hooks/use-boolean";
import CustomPopover, { usePopover } from "src/components/custom-popover";

function ActCard({ act, onStatusUpdate, user, menuPermissions }) {
  const [loading, setLoading] = useState({ accept: false, decline: false });
  const declineDialog = useBoolean();
  const [desc, setDesc] = useState("");
  const statusPopover = usePopover();

  const {
    id,
    officer,
    engineer,
    act: actFile,
    measurement,
    is_accepted,
    accepted_date,
    created_date,
    desc: description,
  } = act;

  const decide = async (ok) => {
    setLoading((s) => ({ ...s, [ok ? "accept" : "decline"]: true }));
    const URL = ok ? endpoints.act.accept(id) : endpoints.act.decline(id);

    try {
      await axiosInstance.post(URL, !ok && { desc: desc });
      enqueueSnackbar(`${measurement?.point?.number} дугаартай цэгийн актыг ${ok ? "зөвшөөрлөө" : "татгалзлаа"}`);
      onStatusUpdate && onStatusUpdate();
      setDesc("");
      declineDialog.onFalse();
    } catch (error) {
      enqueueSnackbar(error?.message || "Алдаа гарлаа", {
        variant: "error",
      });
    } finally {
      setLoading((s) => ({ ...s, [ok ? "accept" : "decline"]: false }));
    }
  };

  const getStatusColor = () => {
    if (!is_accepted && !accepted_date) return "warning";
    if (is_accepted === true) return "success";
    if (is_accepted === false) return "error";
    return "info";
  };

  const getStatusLabel = () => {
    if (!is_accepted && !accepted_date) return "Хүлээгдэж буй";
    if (is_accepted === true) return "Баталгаажсан";
    if (is_accepted === false) return "Татгалзсан";
    return "Хүлээгдэж буй";
  };

  return (
    <Card
      sx={{
        width: 320,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        border: (theme) => `1px solid ${alpha(theme.palette.grey[500], 0.12)}`,
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, ${
            !is_accepted && !accepted_date
              ? "#F59E0B"
              : is_accepted === true
                ? "#10B981"
                : is_accepted === false
                  ? "#EF4444"
                  : "#3B82F6"
          }, ${
            !is_accepted && !accepted_date
              ? "#D97706"
              : is_accepted === true
                ? "#059669"
                : is_accepted === false
                  ? "#DC2626"
                  : "#2563EB"
          })`,
          borderRadius: "8px 8px 0 0",
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1, pt: 3 }}>
        <Box sx={{ mb: 2 }}>
          <Stack
            direction="row"
            alignItems="flex-start"
            justifyContent="space-between"
            sx={{ mb: 1 }}
          >
            {actFile && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<Iconify icon="solar:download-bold" />}
                onClick={() => window.open(actFile, "_blank")}
              >
                Татаж авах
              </Button>
            )}
            <Label
              color={getStatusColor()}
              variant="filled"
              sx={{
                minWidth: "auto",
                ml: 1,
                fontWeight: 600,
                fontSize: "0.75rem",
              }}
            >
              {getStatusLabel()}
            </Label>
          </Stack>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <Iconify icon="solar:user-bold" sx={{ mr: 1 }} />
              Илгээсэн ИТА
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <ProfileAvatar user={engineer} size="small" />
              <Typography variant="body2">{engineer?.full_name}</Typography>
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <Iconify icon="solar:settings-bold" sx={{ mr: 1 }} />
              Мэргэжилтэн
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <ProfileAvatar user={officer} size="small" />
              <Typography variant="body2">{officer?.full_name}</Typography>
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <Iconify icon="solar:calendar-bold" sx={{ mr: 1 }} />
              Огноо
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Үүсгэсэн: {fDate(created_date)}
            </Typography>
            {accepted_date && (
              <Typography variant="body2" color="text.secondary">
                Баталгаажсан: {fDate(accepted_date)}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>

      <CardActions sx={{ p: 2, pt: 0, mt: "auto" }}>
        <Stack direction="row" spacing={1} width="100%">
          {!is_accepted && !accepted_date ? (
            user?.id === officer?.id ? (
              <>
                <LoadingButton
                  variant="contained"
                  color="success"
                  size="small"
                  loading={loading.accept}
                  onClick={() => decide(true)}
                  startIcon={<Iconify icon="solar:check-circle-bold" />}
                >
                  Зөвшөөрөх
                </LoadingButton>

                <LoadingButton
                  variant="outlined"
                  color="error"
                  size="small"
                  loading={loading.decline}
                  onClick={() => declineDialog.onTrue()}
                  startIcon={<Iconify icon="solar:close-circle-bold" />}
                >
                  Татгалзах
                </LoadingButton>
              </>
            ) : (
              <Chip
                label="Хүлээгдэж байна"
                icon={<Iconify icon="material-symbols:schedule" />}
                variant="outlined"
                color="default"
                sx={{
                  borderRadius: 9999,
                  width: "100%",
                  justifyContent: "center",
                }}
              />
            )
          ) : (
            <Chip
              label={is_accepted ? "Зөвшөөрсөн" : "Татгалзсан"}
              icon={
                <Iconify
                  icon={
                    is_accepted
                      ? "material-symbols:done"
                      : "material-symbols:close"
                  }
                />
              }
              variant="outlined"
              color={is_accepted ? "success" : "error"}
              onClick={statusPopover.onOpen}
              sx={{
                cursor: "pointer",
                borderRadius: 9999,
                width: "100%",
                justifyContent: "center",
              }}
            />
          )}
        </Stack>
      </CardActions>

      <Dialog
        open={declineDialog.value}
        onClose={declineDialog.onFalse}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Татгалзах шалтгаан</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder="Татгалзах шалтгаан оруулна уу"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={declineDialog.onFalse}>Буцах</Button>
          <LoadingButton
            variant="contained"
            color="error"
            loading={loading.decline}
            onClick={() => decide(false)}
          >
            Татгалзах
          </LoadingButton>
        </DialogActions>
      </Dialog>

      <CustomPopover
        open={statusPopover.open}
        onClose={statusPopover.onClose}
        arrow="top-center"
        sx={{ width: 300, p: 2 }}
      >
        <Box>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Мэдээлэл
          </Typography>
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              <strong>Огноо:</strong>{" "}
              {accepted_date
                ? accepted_date.split("T")[0]
                : created_date?.split("T")[0]}
            </Typography>
            {description && (
              <Typography variant="body2" color="text.secondary">
                <strong>Тайлбар:</strong> {description}
              </Typography>
            )}
          </Stack>
        </Box>
      </CustomPopover>
    </Card>
  );
}

export default function ActCardView({
  pointId = null,
  projectId = null,
  maxDisplay = 6,
}) {
  const menuPermissions = useMenuPermissions({ content: "act" });
  const { user } = useAuthContext();

  const requestBody = useMemo(
    () => ({
      page: 1,
      page_size: maxDisplay,
      ordering: "-created_date",
      ...(projectId && { measurement__projectId: projectId }),
      ...(pointId && { measurement__point: pointId }),
    }),
    [projectId, pointId, maxDisplay]
  );

  const { acts, actsEmpty, actsMutation, actsLoading } =
    useGetActs(requestBody);

  const handleStatusUpdate = useCallback(() => {
    actsMutation();
  }, [actsMutation]);

  if (actsLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          gap: 2,
          overflowX: "auto",
          pb: 1,
        }}
      >
        {Array.from({ length: 3 }).map((_, index) => (
          <Box key={index} sx={{ flexShrink: 0 }}>
            <Card
              sx={{
                width: 320,
                height: 380,
                position: "relative",
                overflow: "hidden",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  left: "-100%",
                  width: "100%",
                  height: "100%",
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                  animation: "shimmer 1.5s infinite",
                },
                "@keyframes shimmer": {
                  "0%": { left: "-100%" },
                  "100%": { left: "100%" },
                },
              }}
            >
              <CardContent sx={{ pt: 3 }}>
                <Box sx={{ mb: 2 }}>
                  <Box
                    sx={{
                      width: "60%",
                      height: 24,
                      bgcolor: "grey.200",
                      borderRadius: 1,
                      mb: 1,
                    }}
                  />
                  <Box
                    sx={{
                      width: "40%",
                      height: 16,
                      bgcolor: "grey.100",
                      borderRadius: 1,
                    }}
                  />
                </Box>

                <Box sx={{ mt: 3 }}>
                  <Box
                    sx={{
                      width: "80%",
                      height: 16,
                      bgcolor: "grey.200",
                      borderRadius: 1,
                      mb: 1,
                    }}
                  />
                  <Box
                    sx={{
                      width: "70%",
                      height: 16,
                      bgcolor: "grey.100",
                      borderRadius: 1,
                      mb: 2,
                    }}
                  />
                  <Box
                    sx={{
                      width: "90%",
                      height: 16,
                      bgcolor: "grey.200",
                      borderRadius: 1,
                      mb: 1,
                    }}
                  />
                  <Box
                    sx={{
                      width: "60%",
                      height: 16,
                      bgcolor: "grey.100",
                      borderRadius: 1,
                    }}
                  />
                </Box>
              </CardContent>

              <CardActions sx={{ p: 2, mt: "auto" }}>
                <Box
                  sx={{
                    width: "100%",
                    height: 36,
                    bgcolor: "grey.200",
                    borderRadius: 1,
                  }}
                />
              </CardActions>
            </Card>
          </Box>
        ))}
      </Box>
    );
  }

  if (actsEmpty) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          py: 4,
          textAlign: "center",
        }}
      >
        <Iconify
          icon="solar:document-bold-duotone"
          sx={{ width: 64, height: 64, mb: 2, color: "text.disabled" }}
        />
        <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
          Акт байхгүй байна
        </Typography>
        <Typography variant="body2" color="text.disabled">
          Энэ цэгт акт бүртгэгдээгүй байна
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          gap: 2,
          overflowX: "auto",
          overflowY: "visible",
          pb: 1,
          "&::-webkit-scrollbar": {
            height: 8,
          },
          "&::-webkit-scrollbar-track": {
            backgroundColor: (theme) => alpha(theme.palette.grey[500], 0.12),
            borderRadius: 4,
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: (theme) => alpha(theme.palette.grey[600], 0.48),
            borderRadius: 4,
            "&:hover": {
              backgroundColor: (theme) => alpha(theme.palette.grey[600], 0.72),
            },
          },
          scrollbarWidth: "thin",
          scrollbarColor: (theme) =>
            `${alpha(theme.palette.grey[600], 0.48)} ${alpha(theme.palette.grey[500], 0.12)}`,
        }}
      >
        {acts.map((act) => (
          <Box key={act.id} sx={{ flexShrink: 0 }}>
            <ActCard
              act={act}
              onStatusUpdate={handleStatusUpdate}
              user={user}
              menuPermissions={menuPermissions}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

ActCardView.propTypes = {
  pointId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  maxDisplay: PropTypes.number,
};
