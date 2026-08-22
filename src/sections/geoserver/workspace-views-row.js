import PropTypes from "prop-types";

import {
  Box,
  Stack,
  Switch,
  Tooltip,
  TableRow,
  TableCell,
  Typography,
} from "@mui/material";
import { Icon } from "@iconify/react";

// ----------------------------------------------------------------------

const GEOM_ICON = {
  Цэг: { icon: "mdi:vector-point", color: "#16a34a" },
  Шугам: { icon: "mdi:vector-polyline", color: "#2563eb" },
  Талбай: { icon: "mdi:vector-square", color: "#d97706" },
};

const SERVICES = ["wms", "wfs", "wmts"];

function GeomIcon({ geom }) {
  const g = GEOM_ICON[geom];
  if (!g) return <Box component="span" sx={{ color: "text.disabled" }}>—</Box>;
  return (
    <Tooltip title={geom}>
      <Box component="span" sx={{ color: g.color, display: "inline-flex" }}>
        <Icon icon={g.icon} width={22} />
      </Box>
    </Tooltip>
  );
}
GeomIcon.propTypes = { geom: PropTypes.string };

export default function WorkspaceViewsRow({ row, no, busy, onService }) {
  return (
    <TableRow hover>
      <TableCell>{no}</TableCell>
      <TableCell>
        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
          {row.view}
        </Typography>
      </TableCell>
      <TableCell align="center">
        <GeomIcon geom={row.geom} />
      </TableCell>
      <TableCell>{row.level1 || "—"}</TableCell>
      <TableCell>{row.level2 || "—"}</TableCell>
      <TableCell>{row.level3 || "—"}</TableCell>
      <TableCell align="center">
        <Stack direction="row" justifyContent="center" spacing={0.5}>
          {SERVICES.map((s) => (
            <Stack key={s} alignItems="center" sx={{ width: 56 }}>
              <Typography variant="caption" color="text.secondary">
                {s.toUpperCase()}
              </Typography>
              <Switch
                checked={!!row[s]}
                disabled={!row.published || busy === `${row.view}:${s}`}
                onChange={(e) => onService(row, s, e.target.checked)}
              />
            </Stack>
          ))}
        </Stack>
      </TableCell>
    </TableRow>
  );
}

WorkspaceViewsRow.propTypes = {
  row: PropTypes.object,
  no: PropTypes.number,
  busy: PropTypes.string,
  onService: PropTypes.func,
};
