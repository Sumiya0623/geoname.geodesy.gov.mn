import PropTypes from "prop-types";

import {
  Chip,
  Stack,
  Tooltip,
  TableRow,
  TableCell,
  Typography,
  IconButton,
} from "@mui/material";

import Iconify from "src/components/iconify";
import { statusColor } from "src/components/map/recountStatus";

// ----------------------------------------------------------------------
// Суурин судалгаа — дахин тооллогын нэг мөр. Нэр, ангиллын 3 түвшин,
// байршил (геометрийн дүрс → dialog), төлвүүд, мөрийн үйлдлийн цэс.
// ----------------------------------------------------------------------

export default function SuurinTableRow({ row: r, onLocation, onMenu, menuOpen }) {
  return (
    <TableRow hover>
          <TableCell>{r.draft || r.name?.name || "—"}</TableCell>
          <TableCell>{r.name?.type_l1 || "—"}</TableCell>
          <TableCell>{r.name?.type_l2 || "—"}</TableCell>
          <TableCell>{r.name?.type_l3 || "—"}</TableCell>
          <TableCell align="center">
            {(() => {
              const geom = r.loc || r.name?.geom || null;
              const gt = geom?.type || r.name?.geom_type || "";
              const icon = gt.includes("Point")
                ? "mdi:map-marker"
                : gt.includes("Line")
                  ? "mdi:vector-polyline"
                  : gt.includes("Polygon")
                    ? "mdi:vector-square"
                    : "mdi:map-marker-off-outline";
              const color = gt.includes("Point")
                ? "#16a34a"
                : gt.includes("Line")
                  ? "#2563eb"
                  : gt.includes("Polygon")
                    ? "#d97706"
                    : null;
              // Геометргүй — ИДЭВХГҮЙ өнгө, дарагдахгүй
              if (!geom) {
                return (
                  <Tooltip title="Байршил бүртгэгдээгүй">
                    <span>
                      <IconButton disabled>
                        <Iconify icon={icon} width={18} />
                      </IconButton>
                    </span>
                  </Tooltip>
                );
              }
              return (
                <Tooltip title="Байршлыг харах">
                  <IconButton
                    onClick={() =>
                      onLocation({
                        title: r.draft || r.name?.name || "Байршил",
                        geom,
                      })
                    }
                  >
                    <Iconify
                      icon={icon}
                      width={18}
                      sx={{ color }}
                    />
                  </IconButton>
                </Tooltip>
              );
            })()}
          </TableCell>
          <TableCell>
            {r.statuses?.length ? (
              <Stack
                direction="row"
                flexWrap="wrap"
                gap={0.5}
                sx={{ py: 0.25 }}
              >
                {r.statuses.map((st) => {
                  const col = statusColor(st);
                  return (
                    <Chip
                      key={st.id}
                      label={st.name}
                      sx={{
                        height: 22,
                        fontWeight: 600,
                        color: col,
                        bgcolor: `${col}1f`,
                        border: `1px solid ${col}66`,
                      }}
                    />
                  );
                })}
              </Stack>
            ) : (
              <Typography variant="caption" color="text.disabled">
                Тодорхойлоогүй
              </Typography>
            )}
          </TableCell>
          <TableCell align="right">
            <IconButton
              color={menuOpen ? "inherit" : "default"}
              onClick={(e) => onMenu(e.currentTarget, r)}
            >
              <Iconify icon="eva:more-vertical-fill" width={18} />
            </IconButton>
          </TableCell>
        </TableRow>
  );
}

SuurinTableRow.propTypes = {
  row: PropTypes.object,
  onLocation: PropTypes.func,
  onMenu: PropTypes.func,
  menuOpen: PropTypes.bool,
};
