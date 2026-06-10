import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Unstable_Grid2";
import MenuItem from "@mui/material/MenuItem";
import { RHFSlider, RHFSelect } from "src/components/hook-form";

const BLENDMODES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
];

export default function RasterBlock() {
  return (
    <Card>
      <Stack spacing={1.5} sx={{ p: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Raster style
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Raster-ийн opacity, blend mode зэрэг ерөнхий параметрүүдийг хэрэглэнэ.
        </Typography>
        <Grid container spacing={2}>
          <Grid xs={12} md={6}>
            <RHFSlider
              name="opacity"
              helperText="Opacity"
              min={0}
              max={1}
              step={0.01}
            />
          </Grid>
          <Grid xs={12} md={6}>
            <RHFSelect name="blend_mode" label="Blend mode" variant="filled">
              {BLENDMODES.map((v) => (
                <MenuItem key={v} value={v}>
                  {v}
                </MenuItem>
              ))}
            </RHFSelect>
          </Grid>
        </Grid>
      </Stack>
    </Card>
  );
}
