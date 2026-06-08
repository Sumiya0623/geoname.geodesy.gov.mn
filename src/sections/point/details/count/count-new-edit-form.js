import * as Yup from "yup";
import PropTypes from "prop-types";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useMemo, useEffect } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import Stack from "@mui/material/Stack";
import LoadingButton from "@mui/lab/LoadingButton";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";

import axiosInstance, { endpoints } from "src/utils/axios";

import { useSnackbar } from "src/components/snackbar";
import { useGetRelatedUsers } from "src/api/user";
import { PhotoCamera } from "@mui/icons-material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useGetConstantsFordropdown } from "src/api/constant";
import Image from "next/image";
import { useAuthContext } from "src/auth/hooks";

// ----------------------------------------------------------------------

export default function CountNewEditForm({
  currentCount,
  onCloseForm,
  refetch,
  pointId,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const { users } = useGetRelatedUsers({ dropdown: true, is_citizen: true });
  const { user: currentUser } = useAuthContext();
  const allUsers = useMemo(() => {
    if (!currentUser) return users || [];
    if ((users || []).some((u) => u.id === currentUser.id)) return users || [];
    return [
      { id: currentUser.id, full_name: currentUser.full_name },
      ...(users || []),
    ];
  }, [users, currentUser]);

  const NewConstantSchema = Yup.object().shape({
    status: Yup.mixed().required("Төлвийг сонгоно уу."),
    counted_date: Yup.date().required("Огноог оруулна уу."),
    counted_by: Yup.mixed().required("Тооллого хийсэн инженерийг сонгоно уу."),
    description_flags: Yup.array().of(Yup.string()).nullable(),
    description_extra: Yup.string().nullable(),
  });

  const defaultValues = useMemo(
    () => ({
      point: currentCount?.point?.id || "",
      status: currentCount?.status?.id || "",
      counted_date: currentCount?.counted_date
        ? new Date(currentCount.counted_date)
        : new Date(),
      counted_by: currentCount?.counted_by?.id || currentUser?.id || "",
      description_flags: [],
      description_extra: "",
      photos: currentCount?.photos || [],
    }),
    [currentCount, currentUser?.id]
  );

  const methods = useForm({
    resolver: yupResolver(NewConstantSchema),
    defaultValues,
  });

  const {
    reset,
    handleSubmit,
    control,
    formState: { isSubmitting, isDirty, errors },
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
      fd.append("point_id", pointId);
      fd.append("status_id", data.status);

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
      fd.append("counted_by", data.counted_by || "");
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

      const isEdit = Boolean(currentCount?.id);
      const method = isEdit ? "patch" : "post";
      const URL = isEdit
        ? endpoints.point.count.edit(currentCount.id)
        : endpoints.point.count.create;

      await axiosInstance[method](URL, fd);

      enqueueSnackbar(
        isEdit ? "Амжилттай шинэчлэлээ." : "Амжилттай илгээлээ.",
        { variant: "success" }
      );
      reset();
      onCloseForm?.();
      refetch?.();
    } catch (err) {
      console.error(err);
      const message =
        err.errors?.photos?.map((p) => p.type_id) ||
        err.message ||
        "Алдаа гарлаа";
      enqueueSnackbar(message, { variant: "warning" });
    }
  });

  const handleFileChange = (ev) => {
    const files = Array.from(ev.target.files || []);
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
    <Box sx={{ p: 1, pt: 1 }}>
      <Stack spacing={3}>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth error={!!errors.status}>
              <InputLabel shrink>Цэгийн төлөв</InputLabel>
              <Select {...field} displayEmpty label="Цэгийн төлөв">
                <MenuItem value="">
                  <em>Сонгох...</em>
                </MenuItem>
                <Divider />
                {pointStatus?.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
              {errors.status && (
                <Typography variant="caption" color="error">
                  {errors.status.message}
                </Typography>
              )}
            </FormControl>
          )}
        />

        <Stack
          spacing={2}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
          }}
        >
          <Controller
            name="counted_date"
            control={control}
            render={({ field }) => (
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Огноо"
                  value={field.value}
                  onChange={field.onChange}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !!errors.counted_date,
                      size: "small",
                    },
                  }}
                />
              </LocalizationProvider>
            )}
          />

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
        </Stack>

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

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Зураг нэмэх
          </Typography>

          <input
            id="upload-photo"
            type="file"
            multiple
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          <label htmlFor="upload-photo">
            <Button
              fullWidth
              variant="outlined"
              component="span"
              sx={{ py: 1, borderStyle: "dashed" }}
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
                  xs: "1fr",
                  sm: "1fr 1fr",
                  md: "1fr 1fr 1fr",
                },
                gap: 2,
              }}
            >
              {fields.map((item, index) => (
                <Card key={item.id} sx={{ p: 1.5 }}>
                  <Box sx={{ position: "relative", mb: 1.5 }}>
                    <Image
                      src={item.preview}
                      alt="preview"
                      width={500}
                      height={300}
                      style={{
                        width: "100%",
                        height: 100,
                        objectFit: "cover",
                        borderRadius: 4,
                      }}
                    />

                    <IconButton
                      size="small"
                      sx={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        bgcolor: "error.main",
                        color: "white",
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
                          {photoTypes?.map((t) => (
                            <MenuItem key={t.id} value={t.id}>
                              {t.name}
                            </MenuItem>
                          ))}
                        </Select>
                      )}
                    />

                    {errors.photos?.[index]?.type_id && (
                      <Typography
                        variant="caption"
                        color="error"
                        sx={{ mt: 0.5 }}
                      >
                        {errors.photos[index].type_id.message}
                      </Typography>
                    )}
                  </FormControl>
                </Card>
              ))}
            </Box>
          </Box>
        )}

        <Stack
          direction="row"
          spacing={1.5}
          justifyContent="flex-end"
          sx={{ pt: 2, borderTop: "1px solid #eee" }}
        >
          <Button
            variant="outlined"
            color="inherit"
            size="small"
            onClick={onCloseForm}
          >
            Хаах
          </Button>

          <LoadingButton
            size="small"
            variant="contained"
            loading={isSubmitting}
            disabled={!isDirty}
            onClick={onSubmit}
          >
            {currentCount ? "Өөрчлөх" : "Нэмэх"}
          </LoadingButton>
        </Stack>
      </Stack>
    </Box>
  );
}

CountNewEditForm.propTypes = {
  currentCount: PropTypes.object,
  onCloseForm: PropTypes.func,
  refetch: PropTypes.func,
  pointId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
