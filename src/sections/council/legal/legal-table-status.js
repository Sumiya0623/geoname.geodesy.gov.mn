import PropTypes from "prop-types";
import { Box, Tab, Tabs } from "@mui/material";

import Label from "src/components/label";

// ----------------------------------------------------------------------
// Тогтоол, шийдвэрийн ТӨРӨЛ — toolbar‑ын дээд талд байрлах товч мөр
// (user-table-status‑тай ижил хэлбэр: Tabs + тооны Label).
// ----------------------------------------------------------------------

export default function LegalTableStatus({ types, value, onChange }) {
  return (
    <Box sx={{ px: 2, pt: 1 }}>
      <Tabs
        value={value ?? ""}
        onChange={(_e, v) => onChange(v === "" ? null : v)}
        variant="scrollable"
        scrollButtons="auto"
      >
        {types.map((t) => {
          const active = value === t.id;
          return (
            <Tab
              key={t.id}
              value={t.id}
              label={t.label || t.name}
              iconPosition="end"
              icon={
                <Label variant={active ? "filled" : "soft"} color="primary">
                  {String(t.order_count ?? 0)}
                </Label>
              }
              sx={{ "&:not(:last-of-type)": { mr: 3 } }}
            />
          );
        })}
      </Tabs>
    </Box>
  );
}

LegalTableStatus.propTypes = {
  types: PropTypes.array,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onChange: PropTypes.func,
};
