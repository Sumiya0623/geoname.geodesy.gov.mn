"use client";

import * as Yup from "yup";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LoadingButton from "@mui/lab/LoadingButton";

import { Controller } from "react-hook-form";

import { useAuthContext } from "src/auth/hooks";
import { MAIN_SYSTEM_ID } from "src/utils/main-axios";
import { createTicket, TICKET_PRIORITY } from "src/api/main-support";

import Iconify from "src/components/iconify";
import ProfileAvatar from "src/components/profile-avatar";
import { useSnackbar } from "src/components/snackbar";
import TicketEditor from "src/components/ticket-editor";
import FormProvider, {
  RHFSelect,
  RHFTextField,
} from "src/components/hook-form";

// ----------------------------------------------------------------------

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function TicketForm({ onCreated }) {
  const { user } = useAuthContext();
  const { enqueueSnackbar } = useSnackbar();
  const [files, setFiles] = useState([]);
  // Бүртгэлгүй имэйлээр илгээх үед серверээс ирэх заавар
  const [notRegistered, setNotRegistered] = useState("");

  // Систем нь энэ систем гэдэг нь тодорхой тул сонгох талбар байхгүй —
  // хүсэлт шууд тухайн системийн хариуцагч руу очно.

  const TicketSchema = Yup.object().shape({
    email: Yup.string()
      .trim()
      .email("Имэйл хаягийн хэлбэр буруу байна.")
      .required("Имэйл хаягаа оруулна уу."),
    subject: Yup.string().trim().required("Гарчиг оруулна уу."),
    priority: Yup.string().required(),
    body: Yup.string()
      .nullable()
      .test("not-empty", "Хүсэлтийн агуулгыг бичнэ үү.", (value) =>
        Boolean(
          String(value || "")
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;/g, " ")
            .trim(),
        ),
      ),
  });

  const defaultValues = useMemo(
    () => ({
      email: user?.email || "",
      system: MAIN_SYSTEM_ID,
      subject: "",
      priority: "normal",
      body: "",
    }),
    [user],
  );

  const methods = useForm({
    resolver: yupResolver(TicketSchema),
    defaultValues,
    values: defaultValues,
  });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const handleFiles = (event) => {
    const picked = Array.from(event.target.files || []);
    const tooBig = picked.filter((f) => f.size > MAX_FILE_SIZE);
    if (tooBig.length) {
      enqueueSnackbar("Файлын хэмжээ 10MB-с хэтэрсэн байна.", {
        variant: "error",
      });
    }
    setFiles((prev) => [
      ...prev,
      ...picked.filter((f) => f.size <= MAX_FILE_SIZE),
    ]);
    event.target.value = "";
  };

  const onSubmit = handleSubmit(async (data) => {
    setNotRegistered("");
    try {
      const ticket = await createTicket(data, files);
      enqueueSnackbar(
        `Хүсэлт #${ticket.number} бүртгэгдлээ. Баталгаажуулах мэдэгдлийг ${ticket.email} хаяг руу илгээлээ.`,
      );
      reset(defaultValues);
      setFiles([]);
      onCreated?.(ticket);
    } catch (error) {
      const detail = error?.response?.data;
      if (error?.response?.status === 403 && detail?.registered === false) {
        // Бүртгэлгүй имэйл — хэрэглэгчид бүртгүүлэх зааврыг харуулна
        setNotRegistered(detail.error);
        return;
      }
      enqueueSnackbar(
        detail?.error ||
          detail?.body?.[0] ||
          detail?.subject?.[0] ||
          detail?.email?.[0] ||
          "Хүсэлт илгээхэд алдаа гарлаа.",
        { variant: "error" },
      );
    }
  });

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Stack spacing={2.5}>
        {user && (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ProfileAvatar user={user} size={44} />
            <Stack spacing={0.25}>
              <Typography variant="subtitle2">{user.full_name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {user.email}
              </Typography>
            </Stack>
          </Stack>
        )}

        {notRegistered && (
          <Alert severity="warning" onClose={() => setNotRegistered("")}>
            {notRegistered}
          </Alert>
        )}

        {!user && (
          <Alert severity="info">
            Тусламжийн хүсэлт илгээхийн тулд системд бүртгэлтэй, баталгаажсан
            имэйл хаягаа оруулна уу.
          </Alert>
        )}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)",
            },
            gap: 2,
          }}
        >
          {!user?.email && (
            <RHFTextField name="email" label="Имэйл хаяг" size="small" />
          )}
          <RHFTextField name="subject" label="Гарчиг" size="small" />
          <RHFSelect name="priority" label="Хугацаа" size="small">
            {Object.entries(TICKET_PRIORITY).map(([key, item]) => (
              <MenuItem key={key} value={key}>
                {item.label}
              </MenuItem>
            ))}
          </RHFSelect>
        </Box>

        <Stack spacing={1}>
          <Typography variant="subtitle2">Хүсэлтийн дэлгэрэнгүй</Typography>
          <Controller
            name="body"
            control={methods.control}
            render={({ field, fieldState: { error } }) => (
              <TicketEditor
                id="ticket-new"
                value={field.value}
                onChange={field.onChange}
                error={!!error}
                helperText={error?.message}
                placeholder="Ямар асуудал гарсан, ямар алхмын дараа гарсныг бичнэ үү. Хүснэгт, зураг оруулж болно."
              />
            )}
          />
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <LoadingButton
            component="label"
            variant="outlined"
            size="small"
            startIcon={<Iconify icon="eva:attach-2-fill" />}
          >
            Файл хавсаргах
            <input hidden type="file" multiple onChange={handleFiles} />
          </LoadingButton>
          {files.map((file, index) => (
            <Chip
              key={`${file.name}-${index}`}
              size="small"
              label={file.name}
              onDelete={() =>
                setFiles((prev) => prev.filter((_, i) => i !== index))
              }
            />
          ))}
        </Stack>

        <Stack direction="row" justifyContent="flex-end">
          <LoadingButton
            type="submit"
            variant="contained"
            loading={isSubmitting}
            startIcon={<Iconify icon="eva:paper-plane-fill" />}
          >
            Хүсэлт илгээх
          </LoadingButton>
        </Stack>
      </Stack>
    </FormProvider>
  );
}
