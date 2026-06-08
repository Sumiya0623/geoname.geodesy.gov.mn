import * as Yup from "yup";
import PropTypes from "prop-types";
import { useForm } from "react-hook-form";
import { useMemo, useEffect } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  Box,
  Button,
  Stack,
  MenuItem,
  Divider,
  Chip,
  Typography,
  Tooltip,
} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";
import FormProvider, {
  RHFSelect,
  RHFAutocomplete,
} from "src/components/hook-form";
import { useSnackbar } from "src/components/snackbar";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetRelatedUsers } from "src/api/user";
import { useGetMeasurementsFordropdown } from "src/api/measurement";

export default function ActNewEditForm({
  currentItem,
  onCloseForm,
  refetch,
  projectId,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const { users: engineers = [] } = useGetRelatedUsers({
    pagination: false,
  });
  const measurementBody = {
    projectId: projectId,
    is_new: true,
  };
  const { measurements = [], measurementsLoading } =
    useGetMeasurementsFordropdown(measurementBody);
  // ✅ Validation
  const Schema = Yup.object().shape({
    measurement_ids: Yup.array()
      .of(Yup.object())
      .min(1, "Дор хаяж 1-ийг сонго"),
    engineer_id: Yup.number()
      .typeError("Албан тушаалтаныг сонго")
      .required("Шаардлагатай"),
  });

  const defaultValues = useMemo(
    () => ({
      measurement_ids: currentItem?.measurements ?? [],
      engineer_id: currentItem?.officer?.id ?? "",
      projectId: projectId ?? "",
    }),
    [currentItem, projectId]
  );

  const methods = useForm({
    resolver: yupResolver(Schema),
    defaultValues,
  });

  const {
    reset,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting, isDirty, errors },
  } = methods;
  // ✅ props өөрчлөгдвөл form-оо шинэчилнэ
  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  // ✅ гаднаас ирэх projectId-г form-д баталгаажуулж байна
  useEffect(() => {
    if (projectId) setValue("projectId", projectId);
  }, [projectId, setValue]);

  const onSubmit = handleSubmit(async (data) => {
    const { act, engineer_id, measurement_ids, projectId: pid } = data;
    const formData = new FormData();
    const measurementIdList = (measurement_ids || []).map((m) => m?.id || m);
    if (currentItem) {
      if (act) formData.append("act", act);
      if (engineer_id) formData.append("engineer_id", String(engineer_id));
      measurementIdList.forEach((id) =>
        formData.append("measurement_ids", String(id))
      );
    } else {
      // POST - Create new item
      formData.append("projectId", String(pid));
      if (engineer_id) formData.append("engineer_id", String(engineer_id));
      measurementIdList.forEach((id) =>
        formData.append("measurement_ids", String(id))
      );
    }

    try {
      const url = currentItem
        ? endpoints.champaign.act.edit(currentItem.id)
        : endpoints.champaign.act.create;

      const method = currentItem ? "patch" : "post";

      const res = await axiosInstance[method](url, formData);
      if (res.status === 200 || res.status === 201) {
        enqueueSnackbar(
          currentItem ? "Амжилттай засагдлаа" : "Амжилттай нэмэгдлээ"
        );
        reset();
        refetch && refetch();
        onCloseForm();
      }
    } catch (e) {
      console.error(e);
      const errorMessage =
        e?.response?.data?.detail ||
        e?.response?.data?.result ||
        e?.response?.data?.message ||
        e?.data?.result ||
        "Алдаа гарлаа.";

      enqueueSnackbar(errorMessage, { variant: "error" });
    }
  });

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Box
        display="grid"
        gap={3}
        gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr" }}
      >
        <RHFAutocomplete
          name="measurement_ids"
          label="Хэмжилтийн жагсаалт"
          placeholder="Хайх эсвэл сонгоно уу"
          multiple
          disableCloseOnSelect
          options={(measurements || []).filter((m) => {
            const isNotSelected = !watch("measurement_ids")?.some(
              (selected) => selected?.id === m.id
            );
            const hasAct = m?.is_act === true;
            return isNotSelected && !hasAct;
          })}
          getOptionLabel={(option) =>
            option?.point?.name || option?.name || `#${option?.id}`
          }
          noOptionsText={
            measurementsLoading ? "Ачааллаж байна..." : "Илэрц олдсонгүй"
          }
          isOptionEqualToValue={(option, value) => option?.id === value}
          renderOption={(props, option) => {
            const unitName =
              option?.point?.unit?.[0]?.unit +
              ", " +
              option?.point?.unit?.[1]?.unit;

            return (
              <Box component="li" {...props} key={option.id}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    width: "100%",
                  }}
                >
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {option?.point?.name ?? option.name ?? `#${option.id}`}
                  </Typography>
                  <Typography sx={{ fontWeight: 600, fontSize: "0.875rem" }}>
                    {option?.network?.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {unitName ?? ""}
                  </Typography>
                </Box>
              </Box>
            );
          }}
          renderTags={(selected, getTagProps) =>
            selected.map((option, index) => {
              const label =
                option?.point?.name || option?.name || `#${option?.id}`;
              const unitName =
                option?.point?.unit?.[0]?.unit +
                ", " +
                option?.point?.unit?.[1]?.unit;
              const tooltipContent = (
                <Box>
                  <Typography
                    variant="caption"
                    display="block"
                    sx={{ fontWeight: 600 }}
                  >
                    {label}
                  </Typography>
                  {option?.network?.name && (
                    <Typography variant="caption" display="block">
                      Сүлжээ: {`${option?.network?.name?.slice(0, 4)}`}
                    </Typography>
                  )}
                  {option?.system?.name && (
                    <Typography variant="caption" display="block">
                      Систем: {option.system.name}
                    </Typography>
                  )}
                  {option?.line && (
                    <Typography variant="caption" display="block">
                      Шугам: {option.line}
                    </Typography>
                  )}
                  {unitName && (
                    <Typography variant="caption" display="block">
                      {unitName}
                    </Typography>
                  )}
                </Box>
              );

              return (
                <Tooltip key={option.id} title={tooltipContent}>
                  <Chip
                    {...getTagProps({ index })}
                    label={label}
                    size="small"
                    variant="soft"
                  />
                </Tooltip>
              );
            })
          }
          helperText={
            errors?.measurement_ids?.message ||
            `${watch("measurement_ids")?.length || 0} сонгосон`
          }
        />

        <RHFSelect name="engineer_id" label="Албан тушаалтан" variant="filled">
          <MenuItem
            value=""
            sx={{ fontStyle: "italic", color: "text.secondary" }}
          >
            Сонгоно уу
          </MenuItem>
          <Divider sx={{ borderStyle: "dashed" }} />
          {engineers?.map((user) => (
            <MenuItem key={user.id} value={user.id}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  gap: 2,
                }}
              >
                <Typography variant="body2">{user.full_name}</Typography>
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  {user?.roles &&
                    user?.roles.length > 0 &&
                    user?.roles.map((data) => (
                      <Chip
                        key={data?.id || data?.name}
                        label={data?.name}
                        size="small"
                        variant="soft"
                      />
                    ))}
                </Box>
              </Box>
            </MenuItem>
          ))}
        </RHFSelect>
      </Box>

      <Stack
        direction="row"
        justifyContent="flex-end"
        spacing={1.5}
        sx={{ mt: 2 }}
      >
        <Button variant="outlined" color="inherit" onClick={onCloseForm}>
          Хаах
        </Button>
        <LoadingButton
          type="submit"
          color="primary"
          variant="contained"
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          {currentItem ? "Өөрчлөх" : "Нэмэх"}
        </LoadingButton>
      </Stack>
    </FormProvider>
  );
}

ActNewEditForm.propTypes = {
  currentItem: PropTypes.object,
  onCloseForm: PropTypes.func,
  refetch: PropTypes.func,
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  measurements: PropTypes.array,
};
