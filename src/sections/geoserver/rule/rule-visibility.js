import { Card, Divider, MenuItem, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Unstable_Grid2";
import { RHFSelect, RHFTextField, RHFSlider } from "src/components/hook-form";

const BLENDMODES = [
  { value: "normal", label: "normal" },
  { value: "multiply", label: "multiply" },
  { value: "screen", label: "screen" },
  { value: "overlay", label: "overlay" },
  { value: "darken", label: "darken" },
  { value: "lighten", label: "lighten" },
];

export default function VisibilityBlock() {
  return (
    <Card>
      <Stack spacing={1.5} sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Дэлгэцний тохиргоо
        </Typography>
        <Divider sx={{ borderStyle: "dashed" }} />
        <Grid container spacing={2}>
          <Grid xs={12} sm={6} md={3}>
            <RHFSlider name="opacity" helperText="Opacity" min={0} max={1} step={0.01} />
          </Grid>
          <Grid xs={12} sm={6} md={3}>
            <RHFTextField
              name="z_index"
              label="Z-index"
              type="number"
              variant="filled"
            />
          </Grid>
          <Grid xs={12} sm={6} md={3}>
            <RHFTextField
              name="order"
              label="Order"
              type="number"
              variant="filled"
            />
          </Grid>
          <Grid xs={12} sm={6} md={3}>
            <RHFSelect name="blend_mode" label="Blend mode" variant="filled">
              {BLENDMODES.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </RHFSelect>
          </Grid>
        </Grid>
      </Stack>
    </Card>
  );
}
