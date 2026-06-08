import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Unstable_Grid2";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { useFormContext, Controller } from "react-hook-form";

const presetOptions = [
  { value: 1000, label: `1:1'000` },
  { value: 2000, label: `1:2'000` },
  { value: 5000, label: `1:5'000` },
  { value: 10000, label: `1:10'000` },
  { value: 25000, label: `1:25'000` },
  { value: 50000, label: `1:50'000` },
  { value: 100000, label: `1:100'000` },
  { value: 200000, label: `1:200'000` },
  { value: 500000, label: `1:500'000` },
  { value: 1000000, label: `1:1'000'000` },
];

function formatApostrophe(n) {
  const s = String(n ?? "");
  if (!s) return "";
  let out = "";
  let count = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    out = s[i] + out;
    count++;
    if (count === 3 && i !== 0) {
      out = "'" + out;
      count = 0;
    }
  }
  return out;
}

export default function ScaleBlock() {
  const { control } = useFormContext();

  return (
    <Card>
      <Stack spacing={1.5} sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Харагдах масштаб
        </Typography>
        <Divider sx={{ borderStyle: "dashed" }} />

        <Grid container spacing={2}>
          <Grid xs={12} sm={6}>
            <Controller
              name="min_scale_denom"
              control={control}
              render={({ field }) => {
                const selected = presetOptions.find((o) => o.value === field.value) || null;
                const inputText = field.value === null || field.value === undefined || field.value === "" ? "" : String(field.value);
                return (
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      {field.value ? `1:${formatApostrophe(field.value)}` : ""}
                    </Typography>
                    <Autocomplete
                      freeSolo
                      options={presetOptions}
                      value={selected}
                      inputValue={inputText}
                      isOptionEqualToValue={(opt, val) => opt.value === (val?.value)}
                      getOptionLabel={(opt) => opt?.label || ""}
                      onChange={(_, newOpt) => {
                        if (!newOpt) {
                          field.onChange("");
                          return;
                        }
                        if (typeof newOpt.value === "number") {
                          field.onChange(newOpt.value);
                        }
                      }}
                      onInputChange={(_, newInput, reason) => {
                        if (reason !== "input") return;
                        let digits = "";
                        for (const ch of String(newInput || "")) {
                          if (ch >= "0" && ch <= "9") digits += ch;
                        }
                        field.onChange(digits === "" ? "" : Number(digits));
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Min"
                          variant="filled"
                          size="small"
                          inputProps={{
                            ...params.inputProps,
                            inputMode: "numeric",
                            pattern: "[0-9]*",
                          }}
                        />
                      )}
                    />
                  </Stack>
                );
              }}
            />
          </Grid>

          <Grid xs={12} sm={6}>
            <Controller
              name="max_scale_denom"
              control={control}
              render={({ field }) => {
                const selected = presetOptions.find((o) => o.value === field.value) || null;
                const inputText = field.value === null || field.value === undefined || field.value === "" ? "" : String(field.value);
                return (
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      {field.value ? `1:${formatApostrophe(field.value)}` : ""}
                    </Typography>
                    <Autocomplete
                      freeSolo
                      options={presetOptions}
                      value={selected}
                      inputValue={inputText}
                      isOptionEqualToValue={(opt, val) => opt.value === (val?.value)}
                      getOptionLabel={(opt) => opt?.label || ""}
                      onChange={(_, newOpt) => {
                        if (!newOpt) {
                          field.onChange("");
                          return;
                        }
                        if (typeof newOpt.value === "number") {
                          field.onChange(newOpt.value);
                        }
                      }}
                      onInputChange={(_, newInput, reason) => {
                        if (reason !== "input") return;
                        let digits = "";
                        for (const ch of String(newInput || "")) {
                          if (ch >= "0" && ch <= "9") digits += ch;
                        }
                        field.onChange(digits === "" ? "" : Number(digits));
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Max"
                          variant="filled"
                          size="small"
                          inputProps={{
                            ...params.inputProps,
                            inputMode: "numeric",
                            pattern: "[0-9]*",
                          }}
                        />
                      )}
                    />
                  </Stack>
                );
              }}
            />
          </Grid>
        </Grid>
      </Stack>
    </Card>
  );
}
