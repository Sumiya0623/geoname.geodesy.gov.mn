import * as Yup from "yup";
import PropTypes from "prop-types";
import { useForm } from "react-hook-form";
import { useMemo, useEffect } from "react";
import { yupResolver } from "@hookform/resolvers/yup";

import { Box, Button, Stack } from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";

import { requiredMsg } from "src/utils/regex";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useSnackbar } from "src/components/snackbar";
import FormProvider, { RHFTextField } from "src/components/hook-form";

export default function SubLevelInlineForm({
  currentConstant,
  initialValues = null,
  parentId,
  onCancel,
  onSaved,
}) {
  const { enqueueSnackbar } = useSnackbar();

  const Schema = Yup.object().shape({
    unit: Yup.string().required(requiredMsg),
    centername: Yup.string().required(requiredMsg),
    code: Yup.string().nullable(),
  });

  const defaultValues = useMemo(() => {
    if (currentConstant) {
      return {
        id: currentConstant.id || "",
        unit: currentConstant.unit || "",
        centername: currentConstant.centername || "",
        parent: currentConstant.parent || parentId || "",
      };
    }
    if (initialValues) {
      return {
        id: "",
        unit: initialValues.unit || "",
        centername: initialValues.centername || "",
        parent: parentId || "",
      };
    }
    return {
      id: "",
      unit: "",
      centername: "",
      parent: parentId || "",
    };
  }, [currentConstant, initialValues, parentId]);

  const methods = useForm({
    resolver: yupResolver(Schema),
    defaultValues,
  });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting, isDirty },
  } = methods;

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const { id, parent: _ignoredParentField, ...rest } = data;
    const effectiveParent = currentConstant ? currentConstant.parent : parentId;
    const request_body = { ...rest, parent: effectiveParent || null };
    const method = currentConstant ? "patch" : "post";
    const URL = currentConstant
      ? endpoints.constant.edit(id)
      : endpoints.constant.create;
    try {
      const response = await axiosInstance[method](URL, request_body);
      if (response.status === 200 || response.status === 201) {
        enqueueSnackbar(
          `Ангилал амжилттай ${currentConstant ? "өөрчлөгдлөө" : "нэмэгдлээ"}`,
        );
        onSaved && onSaved(response.data);
        reset();
      }
    } catch (error) {
      enqueueSnackbar(
        `Ангилалыг ${currentConstant ? "өөрчлөх" : "үүсгэх"} үед алдаа гарлаа`,
        {
          variant: "error",
        },
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
          sm: "repeat(1, 1fr)",
          md: "repeat(3, 1fr)",
        }}
        sx={{ mb: 1 }}
      >
        <RHFTextField name="unit" label="Нэр" variant="filled" />
        <RHFTextField name="centername" label="Төвийн нэр" variant="filled" />
      </Box>
      <Stack direction="row" spacing={1} justifyContent="flex-start">
        <LoadingButton
          type="submit"
          color="primary"
          variant="contained"
          loading={isSubmitting}
          disabled={!isDirty}
        >
          {currentConstant ? "Өөрчлөх" : "Нэмэх"}
        </LoadingButton>
        <Button
          variant="outlined"
          color="inherit"
          onClick={onCancel}
        >
          Буцах
        </Button>
      </Stack>
    </FormProvider>
  );
}

SubLevelInlineForm.propTypes = {
  currentConstant: PropTypes.object,
  initialValues: PropTypes.object,
  parentId: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    .isRequired,
  onCancel: PropTypes.func,
  onSaved: PropTypes.func,
};
