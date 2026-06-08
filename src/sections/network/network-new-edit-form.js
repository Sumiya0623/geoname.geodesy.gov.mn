import * as Yup from "yup";
import PropTypes from "prop-types";
import { useForm } from "react-hook-form";
import { useMemo, useEffect } from "react";
import { yupResolver } from "@hookform/resolvers/yup";

import { Box, Button } from "@mui/material";
import Stack from "@mui/material/Stack";
import LoadingButton from "@mui/lab/LoadingButton";

import { requiredMsg } from "src/utils/regex";
import axiosInstance, { endpoints } from "src/utils/axios";

import { useSnackbar } from "src/components/snackbar";
import FormProvider, { RHFTextField } from "src/components/hook-form";
// ----------------------------------------------------------------------

export default function NetWorkNewEditForm({
  currentConstant,
  onCloseForm,
  refetch,
  fixedParentId,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const NewConstantSchema = Yup.object().shape({
    key: Yup.string().required(requiredMsg),
    name: Yup.string().required(requiredMsg),
    label: Yup.string().nullable(),
    code: Yup.string().nullable(),
    parent: Yup.mixed().nullable(),
  });
  const defaultValues = useMemo(() => {
    const parentValue = currentConstant?.parent || fixedParentId || null;
    return {
      id: currentConstant?.id || "",
      key: currentConstant?.key || "GEODETIC_NETWORK",
      name: currentConstant?.name || "",
      label: currentConstant?.label || "",
      code: currentConstant?.code || "",
      parent: parentValue ? String(parentValue) : null,
    };
  }, [currentConstant, fixedParentId]);

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
    const request_body = { ...rest };

    const method = currentConstant ? "patch" : "post";
    const URL = currentConstant
      ? endpoints.constant.edit(id)
      : endpoints.constant.create;
    try {
      const response = await axiosInstance[method](URL, request_body);
      if (response.status === 200 || response.status === 201) {
        enqueueSnackbar(
          `Сүлжээ амжилттай ${currentConstant ? "өөрчлөгдлөө" : "нэмэгдлээ"}`
        );
        reset();
        onCloseForm();
        refetch();
      }
    } catch (error) {
      enqueueSnackbar(
        `Сүлжээг ${currentConstant ? "өөрчлөх" : "үүсгэх"} үед алдаа гарлаа`,
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
      >
        <RHFTextField name="name" label="Нэр" variant="filled" />

        <RHFTextField name="code" label="Дараалал" variant="filled" />
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

NetWorkNewEditForm.propTypes = {
  currentConstant: PropTypes.object,
  onCloseForm: PropTypes.func,
  refetch: PropTypes.func,
  parentconstants: PropTypes.array,
  fixedParentId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
