import PropTypes from "prop-types";

import {
  Box,
  Chip,
  Stack,
  Tooltip,
  TableRow,
  TableCell,
  Typography,
  IconButton,
} from "@mui/material";

import { fDate } from "src/utils/format-time";

import Iconify from "src/components/iconify";
import ProfileAvatar from "src/components/profile-avatar";
import { statusColor } from "src/sections/map/recountStatus";

// ----------------------------------------------------------------------
// Суурин судалгаа — дахин тооллогын нэг мөр. Нэр, ангиллын 3 түвшин,
// байршил (геометрийн дүрс → dialog), төлвүүд, мөрийн үйлдлийн цэс.
// ----------------------------------------------------------------------

export default function RecountTableRow({
  row: r,
  rowQueue,
  onLocation,
  onMenu,
  menuOpen,
}) {
  const { page = 0, rowsPerPage = 10, index = 0 } = rowQueue || {};
  // Геометрийн дүрс — цэг/шугам/талбай. Дарахад байршлыг зурагт харуулна.
  const geom = r.loc || r.name?.geom || null;
  const gt = geom?.type || r.name?.geom_type || "";
  const geomIcon = gt.includes("Point")
    ? "mdi:map-marker"
    : gt.includes("Line")
      ? "mdi:vector-polyline"
      : gt.includes("Polygon")
        ? "mdi:vector-square"
        : "mdi:map-marker-off-outline";
  const geomColor = gt.includes("Point")
    ? "#16a34a"
    : gt.includes("Line")
      ? "#2563eb"
      : gt.includes("Polygon")
        ? "#d97706"
        : null;

  return (
    <TableRow hover>
      <TableCell>{page * rowsPerPage + index + 1}</TableCell>

      {/* Нэр + доор нь төлвүүд ба байршлын дүрс */}
      <TableCell sx={{ whiteSpace: "normal" }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {r.draft || r.name?.name || "—"}
        </Typography>
        <Stack
          direction="row"
          alignItems="center"
          flexWrap="wrap"
          gap={0.5}
          sx={{ mt: 0.25 }}
        >
          {r.statuses?.length ? (
            r.statuses.map((st) => {
              const col = statusColor(st);
              return (
                <Chip
                  key={st.id}
                  label={st.name}
                  sx={{
                    height: 20,
                    fontSize: 11,
                    fontWeight: 600,
                    color: col,
                    bgcolor: `${col}1f`,
                    border: `1px solid ${col}66`,
                  }}
                />
              );
            })
          ) : (
            <Typography variant="caption" color="text.disabled">
              Төлөв тодорхойлоогүй
            </Typography>
          )}

          {geom ? (
            <Tooltip title="Байршлыг харах">
              <IconButton
                sx={{ p: 0.25 }}
                onClick={() =>
                  onLocation({
                    title: r.draft || r.name?.name || "Байршил",
                    geom,
                  })
                }
              >
                <Iconify icon={geomIcon} width={16} sx={{ color: geomColor }} />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Байршил бүртгэгдээгүй">
              <span>
                <IconButton disabled sx={{ p: 0.25 }}>
                  <Iconify icon={geomIcon} width={16} />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Stack>
      </TableCell>
      {/* Үндсэн + Дэд ангилал НЭГ МӨРӨНД (Байгаль › Уул) */}
      <TableCell>
        <Typography variant="body2" noWrap>
          {[r.type_l1 ?? r.name?.type_l1, r.type_l2 ?? r.name?.type_l2]
            .filter(Boolean)
            .join(" › ") || "—"}
        </Typography>
      </TableCell>

      {/* Ангилал (3‑р түвшин) */}
      <TableCell>
        <Typography variant="body2">
          {r.type_l3 ?? r.name?.type_l3 ?? "—"}
        </Typography>
      </TableCell>

      {/* Үүсгэсэн — хэрэглэгч (ProfileAvatar) + огноо нэг баганад */}
      <TableCell sx={{ whiteSpace: "nowrap" }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <ProfileAvatar user={r.user} size={28} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {r.user?.full_name || "—"}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {r.created_date ? fDate(r.created_date, "yyyy.MM.dd") : ""}
            </Typography>
          </Box>
        </Stack>
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

RecountTableRow.propTypes = {
  row: PropTypes.object,
  rowQueue: PropTypes.object,
  onLocation: PropTypes.func,
  onMenu: PropTypes.func,
  menuOpen: PropTypes.bool,
};
