import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Unstable_Grid2";
import MenuItem from "@mui/material/MenuItem";
import { RHFSelect, RHFSvgUpload } from "src/components/hook-form";

export default function PointBlock() {
  return (
    <Card>
      <Stack spacing={1.5} sx={{ p: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Point style
        </Typography>
        <Grid container spacing={2}>
          <Grid xs={12} md={6}>
            <RHFSelect name="size" label="Size" variant="filled">
              {Array.from({ length: 20 }, (_, i) => i + 1).map((o) => (
                <MenuItem key={o} value={o}>
                  {o}
                </MenuItem>
              ))}
            </RHFSelect>
          </Grid>
          <Grid xs={12} md={12}>
            <RHFSvgUpload
              name="icon"
              helperText="Зөвхөн SVG файл сонгоно уу."
              showOnlyInput
            />
          </Grid>
        </Grid>
      </Stack>
    </Card>
  );
}
