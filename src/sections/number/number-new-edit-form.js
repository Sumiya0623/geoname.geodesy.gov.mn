import * as Yup from "yup";
import PropTypes from "prop-types";
import { useForm } from "react-hook-form";
import { useMemo, useEffect } from "react";
import { yupResolver } from "@hookform/resolvers/yup";

import { Box, Button, Divider, MenuItem } from "@mui/material";
import Stack from "@mui/material/Stack";
import LoadingButton from "@mui/lab/LoadingButton";

import axiosInstance, { endpoints } from "src/utils/axios";

import { useSnackbar } from "src/components/snackbar";
import FormProvider, {
  RHFSelect,
} from "src/components/hook-form";

// ----------------------------------------------------------------------

export default function NumberNewEditForm({
  currentNumber,
  onCloseForm,
  refetch,
  networks,
  units,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const NewConstantSchema = Yup.object().shape({
    unit: Yup.mixed().nullable(),
    network: Yup.mixed().nullable(),
  });
  const defaultValues = useMemo(
    () => ({
      id: currentNumber?.id || "",
      unit: currentNumber?.unit?.id || "",
      network: currentNumber?.network?.id || "",
    }),
    [currentNumber]
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
    if (currentNumber) {
      reset(defaultValues);
    }
  }, [currentNumber, defaultValues, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const { id, network, unit } = data;

    const request_body = {
      ...(unit ? { unit_id: Number(unit) } : {}), // ← unit нь string ID
      ...(network ? { network_id: Number(network) } : {}), // ← network нь string ID
    };

    const method = currentNumber ? "patch" : "post";
    const URL = currentNumber
      ? endpoints.number.edit(id)
      : endpoints.number.create;

    try {
      const response = await axiosInstance[method](URL, request_body);
      if (response.status === 200 || response.status === 201) {
        enqueueSnackbar(
          `Дугаарлалт амжилттай ${currentNumber ? "өөрчлөгдлөө" : "олгогдлоо"}`
        );
        reset();
        onCloseForm();
        refetch();
      }
    } catch (error) {
      enqueueSnackbar(
        `Дугаарлалтыг ${currentNumber ? "өөрчлөх" : "үүсгэх"} үед алдаа гарлаа`,
        { variant: "error" }
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
        <RHFSelect name="unit" label="Засаг захиргаа" variant="filled">
          <MenuItem
            value=""
            sx={{ fontStyle: "italic", color: "text.secondary" }}
          >
            None
          </MenuItem>

          <Divider sx={{ borderStyle: "dashed" }} />

          {units.map((unit) => (
            <MenuItem key={unit.id} value={`${unit.id}`}>
              {unit.unit}
            </MenuItem>
          ))}
        </RHFSelect>
        <RHFSelect name="network" label="Сүлжээ" variant="filled">
          <MenuItem
            value=""
            sx={{ fontStyle: "italic", color: "text.secondary" }}
          >
            None
          </MenuItem>

          <Divider sx={{ borderStyle: "dashed" }} />

          {networks.map((network) => (
            <MenuItem key={network.id} value={`${network.id}`}>
              {network.name}
            </MenuItem>
          ))}
        </RHFSelect>{" "}
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
          {currentNumber ? "Өөрчлөх" : "Нэмэх"}
        </LoadingButton>
      </Stack>
    </FormProvider>
  );
}

NumberNewEditForm.propTypes = {
  currentNumber: PropTypes.object,
  onCloseForm: PropTypes.func,
  refetch: PropTypes.func,
  networks: PropTypes.array,
  units: PropTypes.array,
};
