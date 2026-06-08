import * as Yup from "yup";
import { useForm } from "react-hook-form";
import { useMemo, useEffect } from "react";
import { yupResolver } from "@hookform/resolvers/yup";

import { Box, Button } from "@mui/material";
import Stack from "@mui/material/Stack";
import LoadingButton from "@mui/lab/LoadingButton";

import { requiredMsg } from "src/utils/regex";
import axiosInstance, { endpoints } from "src/utils/axios";

import { useSnackbar } from "src/components/snackbar";
import FormProvider, {
  RHFTextField,
} from "src/components/hook-form";

// ----------------------------------------------------------------------

export default function ConstantNewEditForm({
  currentConstant,
  onCloseForm,
  refetch,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const NewConstantSchema = Yup.object().shape({
    key: Yup.string().required(requiredMsg),
    name: Yup.string().required(requiredMsg),
    label: Yup.string().nullable(),
    code: Yup.string().nullable(),
    desc: Yup.string().nullable(),
    color: Yup.string().nullable(),
    parent_id: Yup.mixed().nullable(),
  });
  const defaultValues = useMemo(
    () => ({
      id: currentConstant?.id || "",
      key: currentConstant?.key || "",
      name: currentConstant?.name || "",
      label: currentConstant?.label || "",
      code: currentConstant?.code || "",
      desc: currentConstant?.desc || "",
      color: currentConstant?.color || "",
      parent_id: currentConstant?.parent?.id || null,
    }),
    [currentConstant]
  );

  const methods = useForm({
    resolver: yupResolver(NewConstantSchema),
    defaultValues,
  });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting, isDirty },
  } = methods;

  useEffect(() => {
    if (currentConstant) {
      reset(defaultValues);
    }
  }, [currentConstant, defaultValues, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const { id, ...rest } = data;
    // const { id, parent_id, ...rest } = data;
    const request_body = { ...rest };
    const method = currentConstant ? "patch" : "post";
    const URL = currentConstant
      ? endpoints.constant.edit(id)
      : endpoints.constant.create;
    try {
      const response = await axiosInstance[method](URL, request_body);
      if (response.status === 200 || response.status === 201) {
        enqueueSnackbar(
          `Тогтмол амжилттай ${currentConstant ? "өөрчлөгдлөө" : "нэмэгдлээ"}`
        );
        // reset();
        // onCloseForm();
        refetch();
      }
    } catch (error) {
      enqueueSnackbar(
        `Тогтмолыг ${currentConstant ? "өөрчлөх" : "үүсгэх"} үед алдаа гарлаа`,
        {
          variant: "error",
        }
      );
    }
  });

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Box
        gap={2}
        display="grid"
        gridTemplateColumns={{
          xs: "repeat(1, 1fr)",
          sm: "repeat(2, 1fr)",
          md: "repeat(5, 1fr)",
        }}
        sx={{ px: { xs: 2, md: 0 } }}
      >
        <RHFTextField name="name" label="Нэр" variant="filled" />
        <RHFTextField name="key" label="Түлхүүр үг" variant="filled" />
        {/* <RHFSelect name="parent_id" label="Харъяа" variant="filled">
          <MenuItem
            value=""
            sx={{ fontStyle: "italic", color: "text.secondary" }}
          >
            None
          </MenuItem>

          <Divider sx={{ borderStyle: "dashed" }} />

          {menus.map((constant) => (
            <MenuItem key={constant.id} value={`${constant.id}`}>
              {constant.name}
            </MenuItem>
          ))}
        </RHFSelect> */}
        <RHFTextField name="parent_id" label="Parent_id" type='number' variant="filled" />
        <RHFTextField name="desc" label="Path/Desc" variant="filled" />
        <RHFTextField name="color" label="Color/Icon" variant="filled" />
        <RHFTextField name="code" label="Code" variant="filled" />
        <RHFTextField name="label" label="Label" variant="filled" />
      </Box>

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="flex-end"
        sx={{ mt: 2 }}
        spacing={1.5}
      >
        <Button variant="outlined" color="inherit" onClick={onCloseForm}>
          Хаах
        </Button>

        <LoadingButton
          type="submit"
          color="primary"
          variant="contained"
          loading={isSubmitting}
          disabled={!isDirty}
        >
          {currentConstant ? "Өөрчлөх" : "Нэмэх"}
        </LoadingButton>
      </Stack>
    </FormProvider>
  );
}
