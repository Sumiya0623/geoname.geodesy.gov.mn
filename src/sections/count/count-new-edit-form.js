"use client";
import * as Yup from "yup";
import { useMemo, useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import Stack from "@mui/material/Stack";
import LoadingButton from "@mui/lab/LoadingButton";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useSnackbar } from "src/components/snackbar";
import FormProvider from "src/components/hook-form";
import { useGetRelatedUsers } from "src/api/user";
import { useGetConstantsFordropdown } from "src/api/constant";
import { useAuthContext } from "src/auth/hooks";

import MeasurementFindPoint from "../measurement/measurement-find-point";
import Iconify from "src/components/iconify";
import { PhotoCamera } from "@mui/icons-material";
import DeleteIcon from "@mui/icons-material/Delete";

export default function CountNewEditForm({
  currentCount,
  onCloseForm,
  refetch,
  projectId,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const { users } = useGetRelatedUsers({ pagination: false });
  const { user: currentUser } = useAuthContext();
  const allUsers = useMemo(() => {
    if (!currentUser) return users || [];
    if ((users || []).some((u) => u.id === currentUser.id)) return users || [];
    return [
      { id: currentUser.id, full_name: currentUser.full_name },
      ...(users || []),
    ];
  }, [users, currentUser]);

  const [selectedPoint, setSelectedPoint] = useState(null);
  const [open, setOpen] = useState(false);

  const NewConstantSchema = Yup.object().shape({
    point: Yup.mixed().required("Цэг сонгоно уу."),
    status: Yup.mixed().required("Төлөв сонгоно уу."),
    counted_date: Yup.date().required("Огноо оруулна уу."),
    counted_by: Yup.mixed().required("Тооллого хийсэн инженерийг сонгоно уу."),
    description_flags: Yup.array().of(Yup.string()).nullable(),
    description_extra: Yup.string().nullable(),
    photos: Yup.array().of(
      Yup.object().shape({
        type_id: Yup.string().required("Зургийн төрөл сонгоно уу"),
      })
    ),
  });

  const defaultValues = useMemo(
    () => ({
      point: currentCount?.point?.id || null,
      status: currentCount?.status?.id || null,
      counted_date: currentCount?.counted_date
        ? new Date(currentCount.counted_date)
        : null,
      counted_by: currentCount?.counted_by?.id || currentUser?.id || "",
      description_flags: [],
      description_extra: "",
      photos: currentCount?.photos || [],
    }),
    [currentCount, currentUser]
  );

  const methods = useForm({
    resolver: yupResolver(NewConstantSchema),
    defaultValues,
  });

  const {
    reset,
    handleSubmit,
    setValue,
    control,
    formState: { isSubmitting, errors },
  } = methods;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "photos",
  });

  const { constants: photoTypes } = useGetConstantsFordropdown("PHOTO_TYPES");
  const { constants: pointStatus } = useGetConstantsFordropdown("POINTSTATUS");

  useEffect(() => {
    if (currentCount) reset(defaultValues);
  }, [currentCount, defaultValues, reset]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      const fd = new FormData();
      if (data.point) {
        fd.append("point_id", data.point);
      }

      if (data.status) {
        fd.append("status_id", data.status);
      }

      const flagOptions = [
        "Сэргээх боломжгүй",
        "Устгасан этгээд тодорхой",
        "Бүтээн байгуулалтын улмаас устсан",
        "Дахин сэргээх шаардлагагүй",
      ];
      const flags = (data.description_flags || []).filter((v) =>
        flagOptions.includes(v)
      );
      const extra = data.description_extra?.trim();
      const parts = [...flags];
      if (extra) parts.push(`Нэмэлт: ${extra}`);

      fd.append("description", parts.join(", "));
      fd.append("counted_by", data.counted_by);

      if (data.counted_date instanceof Date) {
        fd.append("counted_date", data.counted_date.toISOString());
      }

      if (projectId) {
        fd.append("project", projectId);
      }

      data.photos.forEach((p) => {
        fd.append("photos", p.file);
        fd.append("type_ids", p.type_id);
      });

      const isEdit = Boolean(currentCount?.id);
      const URL = isEdit
        ? endpoints.point.count.edit(currentCount.id)
        : endpoints.point.count.create;

      await axiosInstance[isEdit ? "patch" : "post"](URL, fd);

      enqueueSnackbar(
        isEdit ? "Амжилттай шинэчлэлээ." : "Амжилттай илгээлээ.",
        {
          variant: "success",
        }
      );

      reset();
      onCloseForm?.();
      refetch?.();
    } catch (err) {
      enqueueSnackbar(err.message || "Алдаа гарлаа", { variant: "warning" });
    }
  });

  const selectPoint = (pt) => {
    setSelectedPoint(pt);
    setValue("point", pt?.id || "");
    setOpen(false);
  };

  const handleFileChange = (ev) => {
    const files = [...(ev.target.files || [])];
    if (files.length === 0) return;

    append(
      files.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        type_id: "",
      }))
    );

    ev.target.value = null;
  };

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Stack spacing={2.5}>
        {/* STATUS */}
        <Controller
          name="status"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <FormControl fullWidth size="small" error={!!error}>
              <InputLabel>Цэгийн төлөв</InputLabel>
              <Select {...field} label="Цэгийн төлөв">
                <MenuItem value="">
                  <em>Сонгох…</em>
                </MenuItem>
                {pointStatus?.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
              {error && (
                <Typography variant="caption" color="error">
                  {error.message}
                </Typography>
              )}
            </FormControl>
          )}
        />

        {/* POINT SELECT */}
        <Controller
          name="point"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <Box>
              <Button
                fullWidth
                variant="contained"
                size="small"
                onClick={() => setOpen(true)}
                sx={{ py: 1 }}
              >
                <Iconify
                  icon="game-icons:convergence-target"
                  width={14}
                  style={{ marginRight: 6 }}
                />
                Цэг олох
              </Button>

              {error && (
                <Typography variant="caption" color="error">
                  {error.message}
                </Typography>
              )}
            </Box>
          )}
        />

        {/* SELECTED POINT CARD */}
        {selectedPoint && (
          <Card sx={{ p: 1.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Сонгогдсон цэг
            </Typography>

            <Box
              sx={{
                display: "grid",
                gap: 1.2,
                gridTemplateColumns: "1fr 1fr",
              }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Нэр
                </Typography>
                <Typography variant="body2">{selectedPoint.name}</Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Дугаар
                </Typography>
                <Typography variant="body2">{selectedPoint.number}</Typography>
              </Box>
            </Box>
          </Card>
        )}

        <MeasurementFindPoint
          open={open}
          onClose={() => setOpen(false)}
          onSelectPoint={selectPoint}
        />

        {/* DATE / ENGINEER */}
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          }}
        >
          <Box>
            <Controller
              name="counted_date"
              control={control}
              render={({ field, fieldState: { error } }) => (
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    {...field}
                    label="Огноо"
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        size: "small",
                        error: !!error,
                      },
                    }}
                  />
                </LocalizationProvider>
              )}
            />
            {errors?.counted_date && (
              <Typography
                variant="caption"
                color="error"
                sx={{ display: "block", mt: 0.5 }}
              >
                {errors.counted_date.message}
              </Typography>
            )}
          </Box>

          <Controller
            name="counted_by"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <FormControl fullWidth size="small" error={!!error}>
                <InputLabel>Тооллого хийсэн инженер</InputLabel>
                <Select {...field} label="Тооллого хийсэн инженер">
                  <MenuItem value="">
                    <em>Сонгох…</em>
                  </MenuItem>
                  {allUsers?.map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.full_name}
                    </MenuItem>
                  ))}
                </Select>
                {error && (
                  <Typography variant="caption" color="error">
                    {error.message}
                  </Typography>
                )}
              </FormControl>
            )}
          />
        </Box>

        {/* DESCRIPTION CHECKBOXES */}
        <Controller
          name="description_flags"
          control={control}
          render={({ field }) => {
            const options = [
              "Сэргээх боломжгүй",
              "Устгасан этгээд тодорхой",
              "Бүтээн байгуулалтын улмаас устсан",
              "Дахин сэргээх шаардлагагүй",
            ];

            const current = Array.isArray(field.value) ? field.value : [];

            const handleToggle = (label) => (event) => {
              const checked = event.target.checked;
              let next = current;
              if (checked && !next.includes(label)) {
                next = [...next, label];
              } else if (!checked) {
                next = next.filter((v) => v !== label);
              }
              field.onChange(next);
            };

            const isChecked = (label) => current.includes(label);

            return (
              <FormControl component="fieldset" variant="standard">
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  Тайлбар
                </Typography>
                <FormGroup>
                  {options.map((label) => (
                    <FormControlLabel
                      key={label}
                      control={
                        <Checkbox
                          size="small"
                          checked={isChecked(label)}
                          onChange={handleToggle(label)}
                        />
                      }
                      label={label}
                    />
                  ))}
                </FormGroup>
              </FormControl>
            );
          }}
        />

        {/* DESCRIPTION FREE TEXT */}
        <Controller
          name="description_extra"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              rows={2}
              multiline
              fullWidth
              size="small"
              label="Нэмэлт тайлбар"
              placeholder="Нэмэлт тайлбараа энд бичнэ үү..."
            />
          )}
        />

        {/* PHOTO INPUT */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Зураг нэмэх
          </Typography>

          <input
            id="upload-photo"
            hidden
            multiple
            type="file"
            accept="image/*"
            onChange={handleFileChange}
          />

          <label htmlFor="upload-photo">
            <Button
              fullWidth
              variant="outlined"
              component="span"
              size="small"
              sx={{
                py: 1,
                borderStyle: "dashed",
              }}
            >
              <PhotoCamera sx={{ mr: 1 }} />
              Зураг сонгох
            </Button>
          </label>
        </Box>

        {/* PHOTO LIST */}
        {fields.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              Нэмэгдсэн зургууд ({fields.length})
            </Typography>

            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, 1fr)",
                  md: "repeat(3, 1fr)",
                },
              }}
            >
              {fields.map((item, idx) => (
                <Card key={item.id} sx={{ p: 1.3 }}>
                  <Box sx={{ mb: 1, position: "relative" }}>
                    <Box
                      component="img"
                      src={item.preview}
                      alt="preview"
                      sx={{
                        width: "100%",
                        height: 110,
                        objectFit: "cover",
                        borderRadius: 1,
                        display: "block",
                      }}
                    />

                    <IconButton
                      size="small"
                      onClick={() => remove(idx)}
                      sx={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        bgcolor: "error.main",
                        color: "#fff",
                        "&:hover": { bgcolor: "error.dark" },
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  <FormControl
                    size="small"
                    fullWidth
                    error={!!errors.photos?.[idx]?.type_id}
                  >
                    <InputLabel>Зургийн төрөл</InputLabel>
                    <Controller
                      name={`photos.${idx}.type_id`}
                      control={control}
                      render={({ field }) => (
                        <Select {...field} label="Зургийн төрөл">
                          {photoTypes?.map((t) => (
                            <MenuItem key={t.id} value={t.id}>
                              {t.name}
                            </MenuItem>
                          ))}
                        </Select>
                      )}
                    />

                    {errors.photos?.[idx]?.type_id && (
                      <Typography variant="caption" color="error">
                        {errors.photos[idx].type_id.message}
                      </Typography>
                    )}
                  </FormControl>
                </Card>
              ))}
            </Box>
          </Box>
        )}
      </Stack>

      {/* FOOTER BUTTONS */}
      <Stack
        direction="row"
        justifyContent="flex-end"
        spacing={1.5}
        sx={{
          mt: 2,
          pt: 2,
          borderTop: "1px solid",
          borderColor: "divider",
        }}
      >
        <Button size="small" variant="outlined" onClick={onCloseForm}>
          Хаах
        </Button>

        <LoadingButton
          type="submit"
          size="small"
          variant="contained"
          loading={isSubmitting}
        >
          Илгээх
        </LoadingButton>
      </Stack>
    </FormProvider>
  );
}
