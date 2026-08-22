import PropTypes from "prop-types";

import {
  Box,
  Stack,
  Button,
  MenuItem,
  Divider,
  Typography,
} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";

import { useGetConstantsFordropdown } from "src/api/constant";
import FormProvider, { RHFSelect } from "src/components/hook-form";

import { useRequestForm, RequestSharedFields } from "./request-form-core";

// ----------------------------------------------------------------------
// "Шинээр" хүсэлт — нэрийн нас, нэр сонголтгүй. Inline (toolbar доор).
// ----------------------------------------------------------------------

export default function RequestNewForm({
  onClose,
  currentItem = null,
  selectedStatus = null,
  refetch,
}) {
  const { constants: ages } = useGetConstantsFordropdown("GEONAME_AGES");
  const f = useRequestForm({
    currentItem,
    selectedStatus,
    requireName: false,
    onClose,
    refetch,
  });

  return (
    <Box
      sx={{
        p: 2,
        borderLeft: "4px solid",
        borderColor: "success.main",
        bgcolor: "background.neutral",
        borderRadius: 1,
      }}
    >
      <FormProvider methods={f.methods} onSubmit={f.onSubmit}>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
          {f.isEdit ? "Хүсэлт засах" : "Шинэ нэрийн хүсэлт"}
          <Typography component="span" variant="body2" color="text.secondary">
            {" · "}
            {f.statusObj?.name || "Шинээр"}
          </Typography>
        </Typography>

        <Box
          gap={2}
          display="grid"
          gridTemplateColumns={{ xs: "1fr", sm: "repeat(2, 1fr)" }}
          sx={{ mb: 1 }}
        >
          <RHFSelect name="age" label="Нэрийн нас">
            <MenuItem value="">—</MenuItem>
            {ages.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.name}
              </MenuItem>
            ))}
          </RHFSelect>
        </Box>

        <RequestSharedFields
          currentItem={currentItem}
          photos={f.photos}
          setPhotos={f.setPhotos}
        />

        <Divider sx={{ my: 2, borderStyle: "dashed" }} />
        <Stack direction="row" spacing={1.5} justifyContent="flex-end">
          <Button variant="outlined" color="inherit" onClick={onClose}>
            Буцах
          </Button>
          <LoadingButton
            type="submit"
            variant="contained"
            color="primary"
            loading={f.isSubmitting}
          >
            {f.isEdit ? "Хадгалах" : "Бүртгэх"}
          </LoadingButton>
        </Stack>
      </FormProvider>
    </Box>
  );
}

RequestNewForm.propTypes = {
  onClose: PropTypes.func,
  currentItem: PropTypes.object,
  selectedStatus: PropTypes.object,
  refetch: PropTypes.func,
};
