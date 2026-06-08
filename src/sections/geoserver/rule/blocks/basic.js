import PropTypes from "prop-types";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import MenuItem from "@mui/material/MenuItem";
import Grid from "@mui/material/Unstable_Grid2";
import { RHFTextField, RHFSelect } from "src/components/hook-form";
import FilterBuilder from "./filterbuilder";

export default function Basics({ currentRule, symbolizers, fields }) {
  return (
    <Card>
      <Stack spacing={1.5} sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Үндсэн мэдээлэл
        </Typography>
        <Divider sx={{ borderStyle: "dashed" }} />
        <Grid container spacing={1.5}>
          <Grid xs={12} sm={6}>
            <RHFTextField
              // disabled={!!currentRule}
              name="name"
              label="Талбар*"
              variant="filled"
            />
          </Grid>
          <Grid xs={12} sm={6}>
            <RHFSelect
              name="symbolizer"
              label="Геометр"
              variant="filled"
              disabled={!!currentRule}
            >
              {symbolizers.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </RHFSelect>
          </Grid>
        </Grid>
        <Grid xs={12} sm={12}>
          <FilterBuilder fields={fields} />
        </Grid>
      </Stack>
    </Card>
  );
}

Basics.propTypes = {
  currentRule: PropTypes.object,
  symbolizers: PropTypes.array.isRequired,
  fields: PropTypes.array.isRequired,
};
