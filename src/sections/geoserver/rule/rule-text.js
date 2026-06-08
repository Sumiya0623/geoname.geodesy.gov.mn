"use client";

import {
  Card,
  Stack,
  Divider,
  Typography,
  Box,
  MenuItem,
} from "@mui/material";
import Grid from "@mui/material/Unstable_Grid2";

import {
  RHFSelect,
  RHFTextField,
  RHFHexColorPicker,
  RHFSlider,
} from "src/components/hook-form";

const FONT_FAMILIES = [
  "DejaVu Sans",
  "DejaVu Serif",
  "DejaVu Sans Mono",
  "Liberation Sans",
  "Liberation Serif",
  "Liberation Mono",
  "Arial",
  "Times New Roman",
  "Courier New",
  "Noto Sans",
  "Noto Serif",
];

const FONT_STYLES = ["normal", "italic", "oblique"]; // GeoServer SLD-д ихэвчлэн normal/italic хангалттай
const FONT_WEIGHTS = ["normal", "bold"]; // SLD дээр найдвартай нь эдгээр

export default function LabelBlock({ attributes }) {
  return (
    <Card>
      <Stack spacing={1.5} sx={{ p: 1.5 }}>
        <Stack direction="row" alignItems="center">
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Text (Label)
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
        </Stack>

        <Divider sx={{ borderStyle: "dashed" }} />

        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid xs={12} md={6}>
            <RHFSelect name="text_field" label="Утга" variant="filled">
              <MenuItem
                value=""
                sx={{ fontStyle: "italic", color: "text.secondary" }}
              >
                None
              </MenuItem>
              <Divider sx={{ borderStyle: "dashed" }} />
              {attributes.map((field) => (
                <MenuItem key={field} value={String(field)}>
                  {field}
                </MenuItem>
              ))}
            </RHFSelect>
          </Grid>
          <Grid xs={12} md={6}>
            <RHFSelect
              name="text_font_family"
              label="Font family"
              variant="filled"
            >
              {FONT_FAMILIES.map((f) => (
                <MenuItem key={f} value={f} sx={{ fontFamily: f }}>
                  {f}
                </MenuItem>
              ))}
            </RHFSelect>
          </Grid>
          <Grid xs={12} md={3}>
            <RHFTextField
              name="text_size"
              label="Size"
              type="number"
              variant="filled"
            />
          </Grid>

          <Grid xs={12} md={3}>
            <RHFHexColorPicker name="text_color" label="Color" />
          </Grid>
          <Grid xs={12} md={3}>
            <RHFSelect
              name="text_font_style"
              label="Font style"
              variant="filled"
            >
              {FONT_STYLES.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </RHFSelect>
          </Grid>
          <Grid xs={12} md={3}>
            <RHFSelect
              name="text_font_weight"
              label="Font weight"
              variant="filled"
            >
              {FONT_WEIGHTS.map((w) => (
                <MenuItem key={w} value={w}>
                  {w}
                </MenuItem>
              ))}
            </RHFSelect>
          </Grid>

          <Grid xs={12} md={2}>
            <RHFHexColorPicker name="text_halo_color" label="Stroke color" />
          </Grid>

          <Grid xs={12} md={2}>
            {/* <RHFTextField
              name="text_halo_radius"
              label="Stroke (halo) size"
              type="number"
              variant="filled"
            /> */}
            <RHFSlider
              name="text_halo_radius"
              helperText="Stroke (halo) size"
              min={0}
              max={20}
              step={0.1}
            />
          </Grid>
          <Grid xs={12} md={2}>
            <RHFSlider
              name="text_halo_opacity"
              helperText="Opacity"
              min={0}
              max={1}
              step={0.01}
            />
          </Grid>

          <Grid xs={12} md={2}>
            <RHFSelect
              name="text_anchor"
              label="Text anchor"
              variant="filled"
            >
              {/* GeoServer SLD AnchorPoint-тэй таарах түгээмэл сонголтууд */}
              <MenuItem value="">Default</MenuItem>
              <MenuItem value="top-left">top-left</MenuItem>
              <MenuItem value="top">top</MenuItem>
              <MenuItem value="top-right">top-right</MenuItem>
              <MenuItem value="left">left</MenuItem>
              <MenuItem value="center">center</MenuItem>
              <MenuItem value="right">right</MenuItem>
              <MenuItem value="bottom-left">bottom-left</MenuItem>
              <MenuItem value="bottom">bottom</MenuItem>
              <MenuItem value="bottom-right">bottom-right</MenuItem>
            </RHFSelect>
          </Grid>

          <Grid xs={6} md={2}>
            <RHFSlider
              helperText="Displacement X (px)"
              name="text_displacement_x"
              min={-20}
              max={20}
              step={1}
            />
          </Grid>

          <Grid xs={6} md={2}>
            <RHFSlider
              helperText="Displacement Y (px)"
              name="text_displacement_y"
              min={-20}
              max={20}
              step={1}
            />
          </Grid>
        </Grid>
      </Stack>
    </Card>
    // <Collapse timeout="auto" unmountOnExit>
    // </Collapse>
  );
}
