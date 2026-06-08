"use client";
import React, { useEffect, useMemo } from "react";
import {
  Box,
  TextField,
  Button,
  Stack,
  IconButton,
  Card,
  MenuItem,
  Divider,
  Select,
  FormControl,
  InputLabel,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import PhotoCamera from "@mui/icons-material/PhotoCamera";
import DeleteIcon from "@mui/icons-material/Delete";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useSnackbar } from "notistack";
import { useGetPoint } from "src/api/point";
import { useGetRelatedUsers } from "src/api/user";
import FormProvider from "src/components/hook-form";
import { useFieldArray, useForm, Controller } from "react-hook-form";
import * as Yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { useGetConstantsFordropdown } from "src/api/constant";
import { useAuthContext } from "src/auth/hooks";

function NewCount({
  pointId,
  onSuccess = null,
  defaultToDestroyed = false,
  hideStatusField = false,
  hideEngineerField = false,
  autoSetToday = false,
}) {
  const { point } = useGetPoint(pointId);
  const { user } = useAuthContext();

  const Schema = useMemo(
    () =>
      Yup.object().shape({
        description: Yup.string().nullable(),
        status_id: hideStatusField
          ? Yup.string().nullable()
          : Yup.string().required("Төлөв сонгоно уу"),
        counted_date: Yup.date()
          .nullable()
          .typeError("Огноог оруулна уу.")
          .required("Огноог оруулна уу."),
        counted_by: hideEngineerField
          ? Yup.string().nullable()
          : Yup.string().required("Тооллого хийсэн инженерийг сонгоно уу."),
        description_flags: Yup.array().of(Yup.string()).nullable(),
        description_extra: Yup.string().nullable(),
        photos: Yup.array().of(
          Yup.object().shape({
            type_id: Yup.string().required("Зургийн төрөл сонгоно уу"),
          }),
        ),
      }),
    [hideStatusField, hideEngineerField],
  );

  const { constants: photoTypes } = useGetConstantsFordropdown("PHOTO_TYPES");
  const { constants: pointStatus } = useGetConstantsFordropdown("POINTSTATUS");
  const { users } = useGetRelatedUsers();

  const { enqueueSnackbar } = useSnackbar();

  const flagOptions = [
    "Сэргээх боломжгүй",
    "Устгасан этгээд тодорхой",
    "Бүтээн байгуулалтын улмаас устсан",
    "Дахин сэргээх шаардлагагүй",
  ];

  const defaultValues = useMemo(
    () => ({
      description: "",
      status_id: "",
      counted_date: autoSetToday ? new Date() : null,
      counted_by: hideEngineerField && user ? user.id.toString() : "",
      description_flags: [],
      description_extra: "",
      photos: [],
    }),
    [autoSetToday, hideEngineerField, user],
  );

  const methods = useForm({
    resolver: yupResolver(Schema),
    defaultValues,
  });

  const {
    reset,
    handleSubmit,
    setValue,
    control,
    formState: { isSubmitting, errors },
  } = methods;

  console.log(errors, "errors");
  const { fields, append, remove } = useFieldArray({
    control,
    name: "photos",
  });

  useEffect(() => {
    if (point && pointStatus) {
      if (defaultToDestroyed) {
        const destroyedStatus = pointStatus.find((status) => {
          if (!status.name) return false;
          const name = status.name.toLowerCase();
          return (
            name.includes("устсан") ||
            name.includes("устгасан") ||
            name === "устсан"
          );
        });
        setValue("status_id", destroyedStatus?.id || point.status?.id || "");
      } else {
        const normalStatus = pointStatus.find((status) => {
          if (!status.name) return false;
          const name = status.name.toLowerCase();
          return name.includes("хэвийн") || name === "хэвийн";
        });
        setValue("status_id", normalStatus?.id || point.status?.id || "");
      }
    }

    if (hideEngineerField && user) {
      setValue("counted_by", user.id.toString());
    }

    if (autoSetToday) {
      setValue("counted_date", new Date());
    }
  }, [
    point,
    pointStatus,
    setValue,
    defaultToDestroyed,
    hideEngineerField,
    user,
    autoSetToday,
  ]);

  const handleFileChange = (ev) => {
    const files = Array.from(ev.target.files || []);
    if (files.length === 0) return;

    const newPhotos = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      type_id: "",
    }));

    append(newPhotos);
    ev.target.value = null;
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      const fd = new FormData();
      fd.append("point_id", pointId);
      fd.append("status_id", data.status_id);

      // Устсан мэдэгдэл үед л checkbox‑ийн утгуудыг ашиглана,
      // хэвийн үед тайлбар талбарт юу ч бичихгүй (хүсвэл extra‑г дангаар нь ашиглаж болно).
      let descriptionText = "";
      if (defaultToDestroyed) {
        const extra = data.description_extra?.trim();
        const parts = [...flagOptions];
        if (extra) parts.push(extra);
        descriptionText = parts.length > 0 ? parts.join(", ") : "";
      }
      fd.append("description", descriptionText);
      fd.append(
        "counted_by",
        data.counted_by ||
          (hideEngineerField && user ? user.id.toString() : ""),
      );

      if (
        data.counted_date instanceof Date &&
        !Number.isNaN(data.counted_date.getTime())
      ) {
        fd.append("counted_date", data.counted_date.toISOString());
      } else {
        fd.append("counted_date", "");
      }

      data.photos.forEach((photo) => {
        fd.append("photos", photo.file);
        fd.append("type_ids", photo.type_id);
      });

      const URL = endpoints.point.count.create;
      await axiosInstance.post(URL, fd);

      enqueueSnackbar("Амжилттай илгээлээ.", { variant: "success" });
      if (onSuccess) {
        onSuccess();
      }
      reset();
    } catch (err) {
      console.error(err);
      // Backend‑ээс ReCount create дээрх давхардлын алдаа:
      // { detail: "Энэ цэгт ийм төлөвтэй мэдэгдэл аль хэдийн илгээгдсэн байна.", recount_id: ... }
      const apiDetail = err?.response?.data?.detail;
      const message = apiDetail || err?.message || "Алдаа гарлаа";
      enqueueSnackbar(message, { variant: "warning" });
    }
  });

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Stack spacing={1}>
        {!hideStatusField && (
          <Controller
            name="status_id"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <FormControl fullWidth error={!!error}>
                <InputLabel shrink>Цэгийн төлөв</InputLabel>
                <Select {...field} label="Цэгийн төлөв" displayEmpty>
                  <MenuItem value="">
                    <em>Сонгох...</em>
                  </MenuItem>
                  <Divider sx={{ borderStyle: "dashed" }} />
                  {pointStatus?.map((status) => (
                    <MenuItem key={status.id} value={status.id}>
                      {status.name}
                    </MenuItem>
                  ))}
                </Select>
                {error ? (
                  <Typography
                    variant="caption"
                    color="error"
                    sx={{ mt: 0.5, display: "block" }}
                  >
                    {error.message}
                  </Typography>
                ) : (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 0.5, display: "block" }}
                  >
                    Цэгийн одоогийн төлвийг сонгоно уу
                  </Typography>
                )}
              </FormControl>
            )}
          />
        )}

        {point && (
          <Card sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              Цэгийн мэдээлэл
            </Typography>
            <Box
              gap={2}
              display="grid"
              gridTemplateColumns={{
                xs: "repeat(1, 1fr)",
                sm: "repeat(3, 1fr)",
              }}
            >
              <Box>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", fontWeight: 600 }}
                >
                  Нэр
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {point?.name || "-"}
                </Typography>
              </Box>
              <Box>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", fontWeight: 600 }}
                >
                  Дугаар
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {point?.number || "-"}
                </Typography>
              </Box>
            </Box>
          </Card>
        )}

        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "repeat(1, 1fr)",
              sm: hideEngineerField
                ? "repeat(1, 1fr)"
                : "repeat(2, minmax(0, 1fr))",
            },
          }}
        >
          <Controller
            name="counted_date"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Огноо"
                  value={field.value}
                  onChange={(newValue) => {
                    field.onChange(newValue);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      fullWidth
                      error={!!error}
                      helperText={error ? error.message : params.helperText}
                    />
                  )}
                />
              </LocalizationProvider>
            )}
          />

          {!hideEngineerField && (
            <Controller
              name="counted_by"
              control={control}
              render={({ field, fieldState: { error } }) => (
                <FormControl fullWidth error={!!error}>
                  <InputLabel shrink>Тооллого хийсэн инженер</InputLabel>
                  <Select
                    {...field}
                    label="Тооллого хийсэн инженер"
                    displayEmpty
                  >
                    <MenuItem value="">
                      <em>Сонгох...</em>
                    </MenuItem>
                    <Divider sx={{ borderStyle: "dashed" }} />
                    {users?.map((user) => (
                      <MenuItem key={user.id} value={user.id}>
                        {user.full_name}
                      </MenuItem>
                    ))}
                  </Select>
                  {error ? (
                    <Typography
                      variant="caption"
                      color="error"
                      sx={{ mt: 0.5, display: "block" }}
                    >
                      {error.message}
                    </Typography>
                  ) : (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 0.5, display: "block" }}
                    >
                      Тооллого хийсэн инженерийг сонгоно уу
                    </Typography>
                  )}
                </FormControl>
              )}
            />
          )}
        </Box>
        {defaultToDestroyed && (
          <>
            <Controller
              name="description_flags"
              control={control}
              render={({ field }) => {
                const options = flagOptions;

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
          </>
        )}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Зураг нэмэх
          </Typography>
          <input
            accept="image/*"
            style={{ display: "none" }}
            id="new-count-upload"
            multiple
            type="file"
            onChange={handleFileChange}
          />
          <label htmlFor="new-count-upload">
            <Button
              variant="outlined"
              component="span"
              size="small"
              sx={{
                width: "100%",
                py: 1,
                borderStyle: "dashed",
                borderColor: "primary.main",
              }}
            >
              <PhotoCamera sx={{ mr: 1 }} />
              Зураг сонгох
            </Button>
          </label>
        </Box>

        {fields.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Нэмэгдсэн зургууд ({fields.length})
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "repeat(1, 1fr)",
                  sm: "repeat(2, 1fr)",
                  md: "repeat(3, 1fr)",
                },
                gap: 2,
              }}
            >
              {fields.map((item, index) => {
                const imageSrc = item.preview || item.url || "";
                return (
                  <Card key={item.id} sx={{ p: 1.5, position: "relative" }}>
                    <Box sx={{ position: "relative", mb: 2 }}>
                      {imageSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imageSrc}
                          alt={`preview ${index}`}
                          style={{
                            width: "100%",
                            height: 120,
                            objectFit: "cover",
                            borderRadius: 4,
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: "100%",
                            height: 120,
                            borderRadius: 4,
                            bgcolor: "action.hover",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "text.secondary",
                            typography: "caption",
                          }}
                        >
                          Урьдчилсан харагдац байхгүй
                        </Box>
                      )}
                      <IconButton
                        size="small"
                        sx={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          bgcolor: "error.main",
                          color: "common.white",
                          "&:hover": {
                            bgcolor: "error.dark",
                          },
                        }}
                        onClick={() => remove(index)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <FormControl
                      fullWidth
                      size="small"
                      error={!!errors.photos?.[index]?.type_id}
                    >
                      <InputLabel>Зургийн төрөл</InputLabel>
                      <Controller
                        name={`photos.${index}.type_id`}
                        control={control}
                        defaultValue={item.type_id}
                        render={({ field }) => (
                          <Select {...field} label="Зургийн төрөл">
                            {photoTypes?.map((type) => (
                              <MenuItem key={type.id} value={type.id}>
                                {type.name}
                              </MenuItem>
                            ))}
                          </Select>
                        )}
                      />
                      {errors.photos?.[index]?.type_id && (
                        <Typography
                          variant="caption"
                          color="error"
                          sx={{ mt: 0.5, display: "block" }}
                        >
                          {errors.photos[index].type_id.message}
                        </Typography>
                      )}
                    </FormControl>
                  </Card>
                );
              })}
            </Box>
          </Box>
        )}
      </Stack>

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="flex-end"
        spacing={1.25}
        sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider" }}
      >
        <Button
          type="button"
          color="inherit"
          variant="outlined"
          size="small"
          onClick={onSuccess}
          disabled={isSubmitting}
        >
          Хаах
        </Button>
        <LoadingButton
          type="submit"
          color="primary"
          variant="contained"
          size="small"
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          Илгээх
        </LoadingButton>
      </Stack>
    </FormProvider>
  );
}

export default NewCount;
