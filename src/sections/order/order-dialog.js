import React, { useState, useCallback, useEffect } from "react";
import PropTypes from "prop-types";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Avatar,
  Stack,
  Divider,
  Stepper,
  Step,
  StepLabel,
  useTheme,
  useMediaQuery,
  LinearProgress,
} from "@mui/material";

import { formatMNT } from "src/utils/format-number";
import Iconify from "src/components/iconify";
import axiosInstance, { endpoints } from "src/utils/axios";
import { enqueueSnackbar } from "notistack";
import { resolveImage } from "src/utils/resolve-image";
import Image from "next/image";

const steps = ["Захиалгын мэдээлэл", "QPAY", "Амжилттай"];
const TIMEOUT_MAX = 180;

function OrderDialog({ open, onClose, item, refetch }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [activeStep, setActiveStep] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMEOUT_MAX);
  const [timerActive, setTimerActive] = useState(false);

  const [paymentData, setPaymentData] = useState();
  const [catalogy, setCatalogy] = useState(item?.catalogy || undefined);

  const getCatalogy = useCallback(async () => {
    if (!item?.id) {
      return;
    }

    try {
      const response = await axiosInstance.get(endpoints.order.edit(item.id));
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
  }, [item?.id]);

  const paymentSuccess = useCallback(() => {
    setTimerActive(false);
    setTimeLeft(TIMEOUT_MAX);
    setActiveStep(2);
    setPaymentData((prev) => (prev ? { ...prev, is_paid: true } : prev));
    enqueueSnackbar("Төлбөр амжилттай!", { variant: "success" });
    getCatalogy();
    if(refetch) refetch();
  }, [refetch, getCatalogy]);

  const checkPaymentSilently = useCallback(async () => {
    if (!paymentData?.id) {
      return false;
    }
    
    try {
      const response = await axiosInstance.get(endpoints.order.check(paymentData.id));
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
    // if (!paymentData?.call_back) {
    //   enqueueSnackbar("Төлбөр шалгахад алдаа гарлаа.", {
    //     variant: "warning",
    //   });
    //   return;
    // }

    try {
      const response = await axiosInstance.get(endpoints.order.check(paymentData?.id));
      if (response?.data?.status === "success") {
        paymentSuccess();
      } else {
        enqueueSnackbar("Төлбөр төлөгдөөгүй байна. Та дахин оролдоно уу.", {
          variant: "warning",
        });
      }
    } catch (error) {
      enqueueSnackbar("Төлбөр шалгахад алдаа гарлаа. Та дахин оролдоно уу.", {
        variant: "error",
      });
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
            setTimerActive(false);
            onClose();
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else if (timeLeft === 0) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft, onClose]);

  useEffect(() => {
    if (!open) {
      setActiveStep(0);
      setTimeLeft(TIMEOUT_MAX);
      setTimerActive(false);
      setPaymentData(undefined);
      setCatalogy(undefined);
    }
  }, [open]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleBack = useCallback(() => {
    setTimerActive(false);
    setTimeLeft(TIMEOUT_MAX);
    setPaymentData(undefined);
    setCatalogy(undefined);
    setActiveStep((prevStep) => Math.max(prevStep - 1, 0));
  }, []);

  const handleClose = useCallback(() => {
    if (activeStep === 1) {
      return;
    }
    setActiveStep(0);
    setTimeLeft(TIMEOUT_MAX);
    setTimerActive(false);
    setPaymentData(undefined);
    setCatalogy(undefined);
    if(refetch) refetch();
    onClose();
  }, [onClose, activeStep, refetch]);

  const pay = useCallback(async () => {
    if (!item?.id) {
      enqueueSnackbar("Төлбөрийн мэдээлэл буруу байна. Та дахин оролдоно уу.", {
        variant: "error",
      });
      return false;
    }

    const URL = endpoints.order.pay;
    const requestBody = { order_id: item.id };

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
  }, [item?.id]);

  const handlePay = useCallback(async () => {
    if (!item?.id) {
      enqueueSnackbar("Захиалгын мэдээлэл олдсонгүй.", { variant: "warning" });
      return;
    }

    setPaymentData(undefined);
    setCatalogy(undefined);
    setTimerActive(false);
    setTimeLeft(TIMEOUT_MAX);
    setActiveStep(1);

    const success = await pay();
    if (!success) {
      setActiveStep(0);
    }
  }, [item?.id, pay]);

  if (!item) return null;

  const total = item?.items?.reduce(
    (sum, val) => sum + Number(val?.unit_price || 0),
    0
  );

  const renderStepContent = () => {
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
            <Box sx={{ overflow: "auto" }}>
              {item &&
                item?.items?.map((val, i) => {
                  const { point, unit_price } = val;
                  return (
                    <Stack key={i} spacing={3}>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar
                          src={
                            point?.thumb?.startsWith("http")
                              ? point.thumb
                              : `${process.env.NEXT_PUBLIC_HOST_API}${point?.thumb || ""}`
                          }
                          variant="rounded"
                          sx={{ width: 80, height: 80 }}
                        />
                        <Stack spacing={1} flex={1}>
                          <Typography variant="h6">{point?.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Дугаар: {point?.number}
                          </Typography>
                        </Stack>
                        {formatMNT(unit_price)}
                      </Box>

                      <Divider />
                    </Stack>
                  );
                })}
            </Box>
            <Stack spacing={2}>
              <Box display="flex" justifyContent="end">
                <Typography variant="h6" sx={{ px: 1 }}>
                  Нийт үнэ:
                </Typography>
                <Typography variant="h6" color="primary.main">
                  {formatMNT(total)}
                </Typography>
              </Box>
            </Stack>
          </Box>
        );

      case 1:
        return (
          <Stack spacing={1} alignItems="center" sx={{ py: 0 }}>
            <Typography variant="h6" textAlign="center">
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
                width: 200,
                height: 200,
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
                  variant="h6"
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
            {isMobile && (
              <>
                <Stack
                  direction="row"
                  spacing={2}
                  justifyContent="center"
                  flexWrap={"wrap"}
                  sx={{ mt: 2 }}
                >
                  {paymentData?.banks?.map((item, index) => {
                    const img = resolveImage(item?.logo);
                    return(
                      <a
                        key={item?.id || index}
                        href={item?.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-block' }}
                      >
                        <Image
                          src={img}
                          width={32}
                          height={32}
                          alt={item?.name || "Bank logo"}
                          style={{ cursor: 'pointer', borderRadius: 8 }}
                        />
                      </a>
                    )}
                  )}
                </Stack>
              </>
            )}
          </Stack>
        );

      case 2:
        return (
          <Stack spacing={3} alignItems="center" sx={{ py: 4 }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                backgroundColor: "success.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Iconify
                icon="solar:check-circle-bold"
                width={48}
                height={48}
                sx={{ color: "white" }}
              />
            </Box>

            <Typography variant="h5" textAlign="center" color="success.main">
              Амжилттай!
            </Typography>

            <Typography
              variant="body1"
              textAlign="center"
              color="text.secondary"
              width={isMobile ? "100%" : "60%"}
            >
              Таны төлбөр амжилттай төлөгдлөө. Бүртгэлтэй хаяг руу төлбөрийн баримтыг, цэг тэмдэгтийн мэдээллийн хамт илгээсэн.
            </Typography>
            {catalogy && (
              <>
                <Box sx={{ m: 2 }}>
                  <Button
                    href={catalogy}
                    target="_blank"
                    rel="noopener"
                    variant="contained"
                    color="primary"
                    startIcon={<Iconify icon="mdi:download" />}
                    sx={{ px: 3, borderRadius: 2 }}
                  >
                    Татах
                  </Button>
                </Box>
                <Box
                  sx={{
                    p: 2,
                    backgroundColor: "background.neutral",
                    borderRadius: 2,
                    // width: "100%",
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Дээрхи холбоос дээр дарж мэдээллээ авна уу.
                  </Typography>
                </Box>
              </>
            )}
          </Stack>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={activeStep === 1 ? undefined : handleClose}
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
        {renderStepContent()}
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        {activeStep === 0 && (
          <>
            <Button onClick={handleClose} variant="outlined">
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
          <Button onClick={handleClose} variant="contained" fullWidth>
            Дуусгах
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

OrderDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  item: PropTypes.object,
};

export default OrderDialog;
