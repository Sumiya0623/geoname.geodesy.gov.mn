import { useRef, useState, useEffect } from "react";
import { useFormContext } from "react-hook-form";

import { Box, Typography, InputAdornment, CircularProgress } from "@mui/material";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useSnackbar } from "src/components/snackbar";
import { RHFTextField } from "src/components/hook-form";

// ----------------------------------------------------------------------
// Санал болгож буй нэр: Санал1 (option.name), Санал2 (option.name2),
// Эх сурвалж (option.source). Доор нь 1 холбоо барих — регистр 10 тэмдэгт
// болмогц ХУР системээс иргэний мэдээлэл татна.
// ----------------------------------------------------------------------

export default function RequestNameOption() {
  const { watch, setValue } = useFormContext();
  const { enqueueSnackbar } = useSnackbar();
  const reg = watch("contact.register");
  const [loading, setLoading] = useState(false);
  const lastReg = useRef("");

  // Регистр 10 тэмдэгт болмогц ХУР‑аас иргэний мэдээлэл татна
  useEffect(() => {
    const r = (reg || "").trim();
    if (r.length !== 10 || r === lastReg.current) return undefined;
    lastReg.current = r;
    let active = true;
    setLoading(true);
    axiosInstance
      .post(endpoints.request.checkUser, { register: r })
      .then((res) => {
        if (!active) return;
        const u = res?.data?.result || res?.data || {};
        setValue("contact.first_name", u.first_name || "");
        setValue("contact.last_name", u.last_name || "");
        setValue(
          "contact.person",
          `${u.last_name || ""} ${u.first_name || ""}`.trim() ||
            u.username ||
            "",
        );
        if (u.phone) setValue("contact.phone", u.phone);
        if (u.email) setValue("contact.email", u.email);
        if (u.address && u.address !== "-")
          setValue("contact.address", u.address);
        enqueueSnackbar("Иргэний мэдээлэл татагдлаа", { variant: "success" });
      })
      .catch(() => {
        if (!active) return;
        // Амжилтгүй → регистрийг дахин оруулах төлөвт оруулна
        lastReg.current = "";
        setValue("contact.register", "");
        enqueueSnackbar("Мэдээлэл татаж чадсангүй. Регистрээ дахин оруулна уу", {
          variant: "error",
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reg]);

  return (
    <Box
      sx={{
        p: 1.5,
        mb: 1.5,
        borderRadius: 1,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.neutral",
      }}
    >
      {/* Санал1, Санал2 + Эх сурвалж (2 мөр) */}
      <Box
        gap={1.5}
        display="grid"
        gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr" }}
        alignItems="start"
      >
        <Box display="grid" gap={1.5}>
          <RHFTextField name="option.name" label="Санал 1" size="small" />
          <RHFTextField name="option.name2" label="Санал 2" size="small" />
        </Box>
        <RHFTextField
          name="option.source"
          label="Эх сурвалж"
          multiline
          rows={2}
          placeholder="Нэрний гарал үүсэл, утга, хэл, ямар нэрнээс үүсэлтэй талаарх тэмдэглэл"
          size="small"
        />
      </Box>

      {/* Холбоо барих — 1 мөр (регистр урд) */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mt: 1.5, mb: 0.5, display: "block" }}
      >
        Холбоо барих хүн
      </Typography>
      <Box
        gap={1}
        display="grid"
        gridTemplateColumns={{ xs: "1fr", sm: "repeat(5, 1fr)" }}
      >
        <RHFTextField
          name="contact.register"
          label="Регистр"
          size="small"
          disabled={loading}
          inputProps={{ maxLength: 10 }}
          InputProps={{
            endAdornment: loading ? (
              <InputAdornment position="end">
                <CircularProgress size={16} />
              </InputAdornment>
            ) : null,
          }}
        />
        <RHFTextField name="contact.person" label="Нэр" size="small" />
        <RHFTextField name="contact.address" label="Хаяг" size="small" />
        <RHFTextField name="contact.phone" label="Утас" size="small" />
        <RHFTextField name="contact.email" label="Имэйл" size="small" />
      </Box>
    </Box>
  );
}
