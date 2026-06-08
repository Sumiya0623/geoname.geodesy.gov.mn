import * as Yup from "yup";
import { useForm } from "react-hook-form";
import { useMemo, useEffect } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import Stack from "@mui/material/Stack";
import { Box, Button } from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useSnackbar } from "src/components/snackbar";
import FormProvider, {
  RHFMultiSelect,
  RHFTextField,
} from "src/components/hook-form";

// ----------------------------------------------------------------------
export default function UserNewEditForm({
  currentUser,
  roles,
  units,
  onCloseForm,
  refetch,
}) {
  const { enqueueSnackbar } = useSnackbar();

  const NewUserSchema = Yup.object().shape({
    unit: Yup.array().nullable(),
    roles: Yup.mixed().nullable(),
  });

  const defaultValues = useMemo(
    () => ({
      id: currentUser?.id || "",
      unit: Array.isArray(currentUser?.unit) ? currentUser.unit.map((u) => u.id) : [],
      phone: currentUser?.phone || null,
      email: currentUser?.email || null,
      roles: Array.isArray(currentUser?.roles)
        ? currentUser.roles.map((r) => (typeof r === "object" ? r.id : r))
        : [],
    }),
    [currentUser]
  );

  const methods = useForm({
    resolver: yupResolver(NewUserSchema),
    defaultValues,
    mode: "onChange",
  });

  const UNIT_ROLE_NAMES = ["Аймгийн мэргэжилтэн", "Сумын даамал"];

  const {
    reset,
    watch,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const watchedRoles = watch("roles");

  const selectedRoleNames = (Array.isArray(watchedRoles) ? watchedRoles : [])
    .map((r) => (roles || []).find((opt) => opt.id === Number(r))?.name)
    .filter(Boolean);

  const isAimag = selectedRoleNames.includes("Аймгийн мэргэжилтэн");
  const isSum = selectedRoleNames.includes("Сумын даамал");
  const showUnit = isAimag || isSum;

  const filteredUnits = useMemo(() => {
    if (!units) return [];
    if (isAimag && !isSum) return units.filter((u) => u.level === "Аймаг/Нийслэл");
    if (isSum && !isAimag) return units.filter((u) => u.level === "Сум/Дүүрэг");
    return units.filter((u) => u.level === "Аймаг/Нийслэл" || u.level === "Сум/Дүүрэг");
  }, [units, isAimag, isSum]);

  useEffect(() => {
    if (currentUser) {
      reset(defaultValues);
    }
  }, [currentUser, defaultValues, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const { id, unit, roles } = data;
    const payload = {
      unit_ids: Array.isArray(unit) ? unit.map(Number) : [],
      role_ids: Array.isArray(roles)
        ? roles.map((r) => (typeof r === "object" ? r.id : r))
        : [],
    };
    const method = currentUser ? "patch" : "post";
    const URL = currentUser ? endpoints.user.edit(id) : endpoints.user.create;
    try {
      const response = await axiosInstance[method](URL, payload);
      if (response.status === 200 || response.status === 201) {
        enqueueSnackbar(
          `Хэрэглэгчийн мэдээлэл  ${currentUser ? "өөрчлөгдлөө" : "нэмэгдлээ"}`
        );
        reset();
        onCloseForm();
        refetch();
      }
    } catch (error) {
      enqueueSnackbar(
        `Хэрэглэгчийн мэдээллийг ${currentUser ? "өөрчлөх" : "үүсгэх"} үед алдаа гарлаа`,
        {
          variant: "error",
        }
      );
    }
  });

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Stack spacing={3} sx={{ p: { xs: 2, sm: 3 }, width: "100%" }}>
        <Box
          gap={{ xs: 2, sm: 2, md: 3 }}
          display="grid"
          gridTemplateColumns={{
            xs: "repeat(1, 1fr)",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
          }}
          sx={{
            width: "100%",
            minHeight: "auto",
          }}
        >
          <Stack direction="row" spacing={2}>
            <RHFTextField
              name="phone"
              label="Утас"
              placeholder="Утасны дугаар"
              disabled
            />
            <RHFTextField
              name="email"
              label="Email"
              placeholder="Email"
              disabled
            />
          </Stack>
          <RHFMultiSelect
            name="roles"
            label="Эрхүүд"
            chip
            checkbox
            placeholder="Эрхүүдээс сонгоно уу"
            options={(roles || []).map((option) => ({
              value: option.id,
              label: option.name,
            }))}
          />
          {showUnit && (
            <RHFMultiSelect
              name="unit"
              label="Засаг захиргаа"
              chip
              checkbox
              placeholder="Нэгжүүдээс сонгоно уу"
              options={filteredUnits.map((option) => ({
                value: option.id,
                label: option.parent_name
                  ? `${option.parent_name} - ${option.unit}`
                  : option.unit,
              }))}
            />
          )}
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems="center"
          justifyContent="flex-end"
          spacing={1.5}
          sx={{
            mt: { xs: 2, sm: 3 },
          }}
        >
          <Button
            variant="outlined"
            color="inherit"
            onClick={onCloseForm}
            sx={{
              minWidth: 100,
              width: { xs: "100%", sm: "auto" },
            }}
          >
            Хаах
          </Button>

          <LoadingButton
            type="submit"
            color="primary"
            variant="contained"
            loading={isSubmitting}
            sx={{
              minWidth: 150,
              width: { xs: "100%", sm: "auto" },
            }}
          >
            {currentUser ? "Өөрчлөлт хадгалах" : "Нэмэх"}
          </LoadingButton>
        </Stack>
      </Stack>
    </FormProvider>
  );
}
