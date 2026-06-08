"use client";

import React, { useState, useCallback, useEffect } from "react";

import Container from "@mui/material/Container";
import {
  Box,
  Avatar,
  Stack,
  Divider,
  Typography,
  Button,
  Card,
  CardContent,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  LinearProgress,
  Tooltip,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";

import { formatMNT } from "src/utils/format-number";
import Iconify from "src/components/iconify";
import axiosInstance, { endpoints } from "src/utils/axios";
import { enqueueSnackbar } from "notistack";
import { resolveImage } from "src/utils/resolve-image";

import { useSettingsContext } from "src/components/settings";
import { useGetOrder } from "src/api/order";
import Image from "next/image";

const steps = ["Захиалгын мэдээлэл", "QPAY", "Амжилттай"];
const TIMEOUT_MAX = 180;

// ----------------------------------------------------------------------

export default function OrderDetailsView({ id }) {
  const settings = useSettingsContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const {
    order: currentOrder,
    orderEmpty,
    orderMutation,
    orderLoading,
    orderCount,
  } = useGetOrder(id);

  const [catalogy, setCatalogy] = useState(currentOrder?.catalogy ?? null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMEOUT_MAX);
  const [timerActive, setTimerActive] = useState(false);
  const [paymentData, setPaymentData] = useState();
  const [deletingId, setDeletingId] = useState(null);

  const handleDeleteRow = useCallback(
    async (itemId) => {
      try {
        setDeletingId(itemId);
        const res = await axiosInstance.post(endpoints.order.remove, {
          item_id: itemId,
        });
        if (res?.status === 200) {
          orderMutation?.();
          enqueueSnackbar("Цэгийн захиалга амжилттай устгагдлаа");
        }
      } catch (e) {
        enqueueSnackbar(
          e?.message || "Цэгийн захиалга устгах үед алдаа гарлаа",
          {
            variant: e?.message ? "warning" : "error",
          }
        );
      } finally {
        setDeletingId(null);
      }
    },
    [orderMutation]
  );

  const getCatalogy = useCallback(async () => {
    if (!currentOrder?.id) {
      return;
    }

    try {
      const response = await axiosInstance.get(
        endpoints.order.edit(currentOrder.id)
      );
      if (response?.status === 200) {
        const file = response?.data?.catalogy;
        if (file) {
          setCatalogy(file);
        } else {
          setCatalogy(undefined);
        }
      }
    } catch (error) {
      console.error("Failed to load catalogy", error);
      setCatalogy(undefined);
    }
  }, [currentOrder?.id]);

  const paymentSuccess = useCallback(() => {
    setTimerActive(false);
    setTimeLeft(TIMEOUT_MAX);
    setActiveStep(2);
    setPaymentData((prev) => (prev ? { ...prev, is_paid: true } : prev));
    enqueueSnackbar("Төлбөр амжилттай!", { variant: "success" });
    getCatalogy();
    orderMutation.mutate();
  }, [getCatalogy, orderMutation]);

  const checkPaymentSilently = useCallback(async () => {
    try {
      const response = await axiosInstance.get(
        endpoints.order.check(paymentData?.id)
      );
      if (response?.data?.status === "success") {
        paymentSuccess();
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }, [paymentSuccess, paymentData]);

  useEffect(() => {
    let pollInterval = null;
    if (activeStep === 1 && timerActive) {
      pollInterval = setInterval(async () => {
        await checkPaymentSilently();
      }, 2500);
    }
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [activeStep, timerActive, checkPaymentSilently]);

  const checkPayment = useCallback(async () => {
    try {
      const response = await axiosInstance.get(
        endpoints.order.check(paymentData?.id)
      );
      if (response?.data?.status === "success") {
        paymentSuccess();
      } else {
        enqueueSnackbar("Төлбөр төлөгдөөгүй байна. Та дахин оролдоно уу.", {
          variant: "warning",
        });
      }
    } catch (error) {
      enqueueSnackbar(
        "Төлбөр шалгахад алдаа гарлаа. Та дахин оролдоно уу.",
        {
          variant: "error",
        }
      );
    }
  }, [paymentSuccess, paymentData]);

  useEffect(() => {
    let interval = null;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            setTimerActive(false);
            enqueueSnackbar(
              "Төлбөрийн хугацаа дууслаа. Та дахин оролдоно уу.",
              { variant: "error" }
            );
            setActiveStep(0);
            setTimeLeft(TIMEOUT_MAX);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else if (timeLeft === 0) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const handleDownloadCatalogy = useCallback(async () => {
    if (!catalogy) {
      enqueueSnackbar("Каталог олдсонгүй", { variant: "error" });
      return;
    }

    try {
      const response = await axiosInstance.get(catalogy, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "catalog.pdf");
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
      enqueueSnackbar("Файл татахад алдаа гарлаа", { variant: "error" });
    }
  }, [catalogy]);

  const handlePaymentDialogClose = useCallback(() => {
    if (activeStep === 1) {
      return;
    }
    setPaymentDialogOpen(false);
    setActiveStep(0);
    setTimeLeft(TIMEOUT_MAX);
    setTimerActive(false);
    setPaymentData(undefined);
  }, [activeStep]);

  const handleBack = useCallback(() => {
    setTimerActive(false);
    setTimeLeft(TIMEOUT_MAX);
    setPaymentData(undefined);
    setActiveStep((prevStep) => Math.max(prevStep - 1, 0));
  }, []);

  const pay = useCallback(async () => {
    if (!currentOrder?.id) {
      enqueueSnackbar(
        "Төлбөрийн мэдээлэл буруу байна. Та дахин оролдоно уу.",
        {
          variant: "error",
        }
      );
      return false;
    }

    const URL = endpoints.order.pay;
    const requestBody = { order_id: currentOrder.id };

    try {
      const response = await axiosInstance.post(URL, requestBody);
      if (response?.status === 200 || response?.status === 201) {
        setPaymentData(response?.data?.result);
        setTimerActive(true);
        setTimeLeft(TIMEOUT_MAX);
        return true;
      }

      throw new Error("Төлбөр үүсгэхэд алдаа гарлаа.");
    } catch (error) {
      const message =
        error?.response?.data?.detail ||
        error?.message ||
        "Алдаа гарлаа. Та дахин оролдоно уу.";
      enqueueSnackbar(message, { variant: "error" });
      setTimerActive(false);
      setTimeLeft(TIMEOUT_MAX);
      setPaymentData(undefined);
      return false;
    }
  }, [currentOrder?.id]);

  const handlePay = useCallback(async () => {
    if (!currentOrder?.id) {
      enqueueSnackbar("Захиалгын мэдээлэл олдсонгүй.", {
        variant: "warning",
      });
      return;
    }

    setPaymentData(undefined);
    setTimerActive(false);
    setTimeLeft(TIMEOUT_MAX);
    setActiveStep(1);

    const success = await pay();
    if (!success) {
      setActiveStep(0);
    }
  }, [currentOrder?.id, pay]);

  useEffect(() => {
    if (currentOrder) {
      getCatalogy();
    }
  }, [currentOrder, getCatalogy]);

  if (orderLoading) {
    return (
      <Container maxWidth={settings.themeStretch ? false : "xxl"}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: 400,
          }}
        >
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (orderEmpty || !currentOrder) {
    return (
      <Container maxWidth={settings.themeStretch ? false : "xxl"}>
        <Box sx={{ py: 6, textAlign: "center" }}>
          <Typography variant="h5" color="text.secondary">
            Захиалга олдсонгүй
          </Typography>
        </Box>
      </Container>
    );
  }

  const total = currentOrder?.items?.reduce(
    (sum, val) => sum + Number(val?.unit_price || 0),
    0
  );

  const isPaid =
    currentOrder?.status?.name &&
    currentOrder?.status?.name.toLowerCase() === "төлсөн";

  const renderPaymentStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box
            sx={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ overflow: "auto", mb: 2 }}>
              {currentOrder &&
                currentOrder?.items?.map((val, i) => {
                  const { point, unit_price, id: itemId } = val;
                  const isDeleting = deletingId === itemId;
                  return (
                    <Stack key={i} spacing={2}>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar
                          src={
                            point?.thumb?.startsWith("http")
                              ? point.thumb
                              : `${process.env.NEXT_PUBLIC_HOST_API}${
                                  point?.thumb || ""
                                }`
                          }
                          variant="rounded"
                          sx={{ width: 60, height: 60 }}
                        />
                        <Stack spacing={0.5} flex={1}>
                          <Typography
                            variant="subtitle2"
                            component="a"
                            href={`/dashboard/ready/${point?.id}`}
                            target="_blank"
                            rel="noopener"
                            sx={{
                              cursor: "pointer",
                              color: "primary.main",
                              textDecoration: "none",
                              "&:hover": {
                                textDecoration: "underline",
                              },
                            }}
                          >
                            {point?.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Дугаар: {point?.number}
                          </Typography>
                        </Stack>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography variant="subtitle2" color="primary.main">
                            {formatMNT(unit_price)}
                          </Typography>
                          {itemId && (
                            <Tooltip title="Захиалгаас хасах">
                              <span>
                                <LoadingButton
                                  loading={isDeleting}
                                  onClick={() => handleDeleteRow(itemId)}
                                  size="small"
                                  color="error"
                                  disabled={isDeleting || deletingId !== null}
                                  sx={{ minWidth: 32, width: 32, height: 32 }}
                                >
                                  <Iconify icon="solar:trash-bin-trash-bold" width={16} />
                                </LoadingButton>
                              </span>
                            </Tooltip>
                          )}
                        </Box>
                      </Box>
                      <Divider />
                    </Stack>
                  );
                })}
            </Box>
            <Stack spacing={1}>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="subtitle2">Нийт үнэ:</Typography>
                <Typography variant="subtitle2" color="primary.main">
                  {formatMNT(total)}
                </Typography>
              </Box>
            </Stack>
          </Box>
        );

      case 1:
        return (
          <Stack spacing={2} alignItems="center" sx={{ py: 2 }}>
            <Typography variant="subtitle1" textAlign="center">
              {isMobile
                ? "QR кодыг уншуулан эсвэл доорхи банкны аппуудаар төлбөрөө төлнө үү."
                : "QR кодыг уншуулан төлбөр төлнө үү"}
            </Typography>
            <Box
              component="img"
              src={
                paymentData?.qp_qrcode
                  ? `${process.env.NEXT_PUBLIC_HOST_API}${paymentData?.qp_qrcode}`
                  : ""
              }
              alt="QPAY QR code"
              sx={{
                width: 180,
                height: 180,
              }}
            />
            <Box sx={{ width: "100%", maxWidth: 300, mt: 2 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 1,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Төлбөр төлөх хугацаа
                </Typography>
                <Typography
                  variant="subtitle2"
                  color={timeLeft < 60 ? "error.main" : "text.primary"}
                >
                  {formatTime(timeLeft)}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(timeLeft / TIMEOUT_MAX) * 100}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "grey.200",
                  "& .MuiLinearProgress-bar": {
                    backgroundColor:
                      timeLeft < 60 ? "error.main" : "primary.main",
                    borderRadius: 4,
                  },
                }}
              />
            </Box>
            {isMobile && paymentData?.banks && (
              <>
                <Stack
                  direction="row"
                  spacing={1}
                  justifyContent="center"
                  flexWrap="wrap"
                  sx={{ mt: 2 }}
                >
                  {paymentData?.banks?.map((item, index) => {
                    const img = resolveImage(item?.logo);
                    return(
                    <Image
                      key={item?.id || index}
                      src={img}
                      width={32}
                      height={32}
                      alt={item?.name || "Bank logo"}
                    />
                  )})}
                </Stack>
              </>
            )}
          </Stack>
        );

      case 2:
        return (
          <Stack spacing={3} alignItems="center" sx={{ py: 3 }}>
            <Box
              sx={{
                width: 70,
                height: 70,
                borderRadius: "50%",
                backgroundColor: "success.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Iconify
                icon="solar:check-circle-bold"
                width={40}
                height={40}
                sx={{ color: "white" }}
              />
            </Box>

            <Typography variant="h6" textAlign="center" color="success.main">
              Амжилттай!
            </Typography>

            <Typography
              variant="body2"
              textAlign="center"
              color="text.secondary"
            >
              Таны төлбөр амжилттай төлөгдлөө. Бүртгэлтэй хаяг руу
              төлбөрийн баримтыг, цэг тэмдэгтийн мэдээллийн хамт илгээсэн.
            </Typography>
            {catalogy && (
              <Box>
                <Button
                  onClick={handleDownloadCatalogy}
                  variant="contained"
                  color="primary"
                  startIcon={<Iconify icon="mdi:download" />}
                  sx={{ px: 3, borderRadius: 1 }}
                >
                  Татах
                </Button>
              </Box>
            )}
          </Stack>
        );

      default:
        return null;
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : "xxl"}>
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Iconify icon="mdi-light:cart" width={32} height={32} />
              <Typography variant="h4">Захиалгын дэлгэрэнгүй</Typography>
            </Box>
          </Box>
        </Box>

        <Grid container spacing={3}>
          {/* Order Items */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Захиалгын цэгүүд ({currentOrder?.items?.length || 0})
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Stack spacing={2}>
                  {currentOrder?.items?.map((item, index) => {
                    const { point, unit_price, id: itemId } = item;
                    const isDeleting = deletingId === itemId;
                    return (
                      <Box key={index}>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Avatar
                            src={
                              point?.thumb?.startsWith("http")
                                ? point.thumb
                                : `${process.env.NEXT_PUBLIC_HOST_API}${
                                    point?.thumb || ""
                                  }`
                            }
                            variant="rounded"
                            sx={{ width: 80, height: 80, flexShrink: 0 }}
                          />
                          <Stack spacing={1} flex={1}>
                            <Typography
                              variant="h6"
                              component="a"
                              href={`/dashboard/ready/${point?.id}`}
                              target="_blank"
                              rel="noopener"
                              sx={{
                                cursor: "pointer",
                                // color: "primary.main",
                                textDecoration: "none",
                                "&:hover": {
                                  textDecoration: "underline",
                                },
                              }}
                            >
                              {point?.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Дугаар: {point?.number}
                            </Typography>
                            {point?.description && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {point?.description}
                              </Typography>
                            )}
                          </Stack>
                          <Box sx={{ textAlign: "right", flexShrink: 0, display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="h6" color="primary.main">
                              {formatMNT(unit_price)}
                            </Typography>
                            {!isPaid && itemId && (
                              <Tooltip title="Захиалгаас хасах">
                                <span>
                                  <LoadingButton
                                    loading={isDeleting}
                                    onClick={() => handleDeleteRow(itemId)}
                                    size="small"
                                    color="error"
                                    disabled={isDeleting || deletingId !== null}
                                    sx={{ minWidth: 36, width: 36, height: 36 }}
                                  >
                                    <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                                  </LoadingButton>
                                </span>
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                        {index < (currentOrder?.items?.length || 0) - 1 && (
                          <Divider sx={{ mt: 2 }} />
                        )}
                      </Box>
                    );
                  })}
                </Stack>

                {/* Total */}
                <Divider sx={{ my: 3 }} />
                <Box
                  display="flex"
                  justifyContent="flex-end"
                  gap={2}
                  sx={{
                    p: 2,
                    backgroundColor: "background.neutral",
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="h6">Нийт үнэ:</Typography>
                  <Typography variant="h6" color="primary.main">
                    {formatMNT(total)}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Order Summary */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Захиалгын төлөв
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Stack spacing={2}>
                  {/* Payment Status */}
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Төлөв
                    </Typography>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mt: 0.5,
                      }}
                    >
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          backgroundColor: isPaid ? "success.main" : "warning.main",
                        }}
                      />
                      <Typography variant="body2">
                        {isPaid ? "Төлөгдсөн" : "Төлөгдөөгүй"}
                      </Typography>
                    </Box>
                  </Box>

                  <Divider />

                  {/* Item Count */}
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Цэгийн тоо
                    </Typography>
                    <Typography variant="h6" sx={{ mt: 0.5 }}>
                      {currentOrder?.items?.length || 0}
                    </Typography>
                  </Box>

                  <Divider />

                  {/* Total Amount */}
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Нийт дүн
                    </Typography>
                    <Typography
                      variant="h6"
                      color="primary.main"
                      sx={{ mt: 0.5 }}
                    >
                      {formatMNT(total)}
                    </Typography>
                  </Box>

                  <Divider />

                  {/* Created Date */}
                  {currentOrder?.created_at && (
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Үүсгэгдсэн өдөр
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {new Date(currentOrder.created_at).toLocaleDateString(
                          "mn-MN",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </Typography>
                    </Box>
                  )}
                  {catalogy && (
                    <>
                      <Button
                        onClick={handleDownloadCatalogy}
                        variant="contained"
                        color="info"
                        fullWidth
                        startIcon={<Iconify icon="mdi:download" />}
                        sx={{ py: 1.5, borderRadius: 1 }}
                      >
                        PDF татах
                      </Button>
                    </>
                  )}

                  {/* Payment Button */}
                  {!isPaid && (
                    <>
                      <Divider />
                      <Button
                        onClick={() => setPaymentDialogOpen(true)}
                        variant="contained"
                        color="primary"
                        fullWidth
                        startIcon={<Iconify icon="mdi:credit-card" />}
                        sx={{ py: 1.5, borderRadius: 1 }}
                      >
                        Төлбөр төлөх
                      </Button>
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Payment Dialog */}
      <Dialog
        open={paymentDialogOpen}
        onClose={activeStep === 1 ? undefined : handlePaymentDialogClose}
        maxWidth="md"
        fullWidth
        disableEscapeKeyDown={activeStep === 1}
        PaperProps={{
          sx: {
            height: 700,
            maxHeight: "90vh",
          },
        }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Iconify icon="mdi-light:cart" width={24} height={24} />
            {steps[activeStep]}
          </Box>
        </DialogTitle>

        <Box sx={{ px: 3, py: 1 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.slice(0, activeStep === 2 ? 3 : 2).map((label, index) => (
              <Step key={label} completed={index < activeStep}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        <DialogContent
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: activeStep === 1 ? "flex-start" : "center",
            overflow: "auto",
            minHeight: 300,
          }}
        >
          {renderPaymentStepContent()}
        </DialogContent>

        <DialogActions sx={{ p: 3 }}>
          {activeStep === 0 && (
            <>
              <Button onClick={handlePaymentDialogClose} variant="outlined">
                Хаах
              </Button>
              <Button onClick={handlePay} variant="contained">
                Төлбөр төлөх
              </Button>
            </>
          )}

          {activeStep === 1 && (
            <>
              <Button onClick={handleBack} variant="outlined">
                Буцах
              </Button>
              {timeLeft !== 0 && (
                <Button
                  onClick={checkPayment}
                  variant="contained"
                  color="success"
                >
                  Төлбөр шалгах
                </Button>
              )}
            </>
          )}

          {activeStep === 2 && (
            <Button
              onClick={handlePaymentDialogClose}
              variant="contained"
              fullWidth
            >
              Дуусгах
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
}
