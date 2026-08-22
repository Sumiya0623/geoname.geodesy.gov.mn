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

// ----------------------------------------------------------------------
// GeoServer workspace / дэд зангилаа нэмэх, засах inline форм.
// Бүх зангилаа WORKSPACES key‑тэй, parent‑аар мод бүтнэ.
// ----------------------------------------------------------------------

export default function WorkspaceInlineForm({
  currentItem = null,
  parentId = null,
  onCancel,
  onSaved,
}) {
  const { enqueueSnackbar } = useSnackbar();

  const Schema = Yup.object().shape({
    name: Yup.string().required(requiredMsg),
    code: Yup.string().nullable(),
  });

  const defaultValues = useMemo(
    () => ({
      id: currentItem?.id || "",
      name: currentItem?.name || "",
      code: currentItem?.code || "",
    }),
    [currentItem]
  );

  const methods = useForm({ resolver: yupResolver(Schema), defaultValues });
  const {
    reset,
    handleSubmit,
    formState: { isSubmitting, isDirty },
  } = methods;

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const { id, ...rest } = data;
    const request_body = {
      ...rest,
      key: "WORKSPACES",
      parent: currentItem?.parent ?? (parentId !== null ? parentId : null),
    };
    const method = currentItem ? "patch" : "post";
    const URL = currentItem
      ? endpoints.workspace.edit(id)
      : endpoints.workspace.create;
    try {
      const response = await axiosInstance[method](URL, request_body);
      if (response.status === 200 || response.status === 201) {
        enqueueSnackbar(
          `Workspace амжилттай ${currentItem ? "өөрчлөгдлөө" : "нэмэгдлээ"}`
        );
        onSaved && onSaved(response.data);
        reset();
      }
    } catch (error) {
      const status = error?.response?.status;
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.name?.[0] ||
        error?.message;
      enqueueSnackbar(
        detail ||
          `Workspace ${currentItem ? "өөрчлөх" : "үүсгэх"} үед алдаа гарлаа`,
        { variant: status && status < 500 ? "warning" : "error" }
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
        }}
        sx={{ mb: 1 }}
      >
        <RHFTextField name="name" label="Нэр" variant="filled" />
        <RHFTextField name="code" label="Код" variant="filled" />
      </Box>
      <Stack direction="row" spacing={1} justifyContent="flex-start">
        <LoadingButton
          type="submit"
          color="primary"
          variant="contained"
          loading={isSubmitting}
          disabled={!isDirty}
        >
          {currentItem ? "Өөрчлөх" : "Нэмэх"}
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

WorkspaceInlineForm.propTypes = {
  currentItem: PropTypes.object,
  parentId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onCancel: PropTypes.func,
  onSaved: PropTypes.func,
};
