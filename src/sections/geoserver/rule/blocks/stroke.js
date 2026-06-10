import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Unstable_Grid2";
import MenuItem from "@mui/material/MenuItem";
import {
  RHFHexColorPicker,
  RHFSlider,
  RHFTextField,
  RHFSelect,
} from "src/components/hook-form";

const LINECAPS = [
  { value: "butt", label: "butt" },
  { value: "round", label: "round" },
  { value: "square", label: "square" },
];

const LINEJOINS = [
  { value: "miter", label: "miter" },
  { value: "round", label: "round" },
  { value: "bevel", label: "bevel" },
];

export default function StrokeFillBlock() {
  return (
    <Card>
      <Stack spacing={1.5} sx={{ p: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Хүрээ /Stroke/
        </Typography>
        <Grid container spacing={2}>
          <Grid xs={12} md={4}>
            <RHFHexColorPicker name="stroke_color" label="Stroke color" />
          </Grid>
          <Grid xs={12} md={4}>
            <RHFSlider
              name="stroke_width"
              helperText="Өргөн"
              min={0}
              max={3}
              step={0.1}
            />
          </Grid>
          <Grid xs={12} md={4}>
            <RHFSlider
              name="stroke_opacity"
              helperText="Opacity"
              min={0}
              max={1}
              step={0.01}
            />
          </Grid>
          <Grid xs={12} md={6}>
            <RHFTextField
              name="stroke_dasharray"
              label="Dasharray"
              variant="filled"
              placeholder="4 2 1 2"
            />
          </Grid>
          <Grid xs={12} md={3}>
            <RHFSelect name="stroke_linecap" label="Line cap" variant="filled">
              {LINECAPS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </RHFSelect>
          </Grid>
          <Grid xs={12} md={3}>
            <RHFSelect
              name="stroke_linejoin"
              label="Line join"
              variant="filled"
            >
              {LINEJOINS.map((o) => (
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
