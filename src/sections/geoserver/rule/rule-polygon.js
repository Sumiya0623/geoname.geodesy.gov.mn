import { Card, Divider, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Unstable_Grid2";
import {
  RHFHexColorPicker,
  RHFSlider,
} from "src/components/hook-form";

export default function PolygonBlock() {
  return (
    <Card>
      <Stack spacing={1.5} sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Polygon style
        </Typography>
        <Divider sx={{ borderStyle: "dashed" }} />
        {/* ЗӨВ: spacing-г зөвхөн container дээр тавина */}
        <Grid container spacing={2}>
          <Grid xs={12} sm={6}>
            <RHFHexColorPicker name="fill_color" label="Fill color" fullWidth />
          </Grid>
          <Grid xs={12} sm={6}>
            <RHFSlider
              name="fill_opacity"
              helperText="Opacity"
              min={0}
              max={1}
              step={0.01}
            />
          </Grid>
        </Grid>
      </Stack>
    </Card>
  );
}
