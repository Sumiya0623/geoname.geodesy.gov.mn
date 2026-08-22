import PropTypes from "prop-types";
import { useState } from "react";

import {
  Box,
  Chip,
  Stack,
  Collapse,
  Typography,
  IconButton,
} from "@mui/material";
import {
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
} from "@mui/icons-material";

// ----------------------------------------------------------------------
// Тооллогын газрын зургийн тайлбар (legend) — статус бүрийн ӨНГӨ + нэр + ТОО.
// Толгойгоос дарж доошоо нууж/нээж болно.
// ----------------------------------------------------------------------

export default function RecountLegend({ statuses, counts }) {
  const [open, setOpen] = useState(true);
  if (!statuses || statuses.length === 0) return null;

  return (
    <Box
      sx={{
        position: "absolute",
        bottom: 16,
        right: 16,
        zIndex: 5,
        bgcolor: "rgba(255,255,255,0.96)",
        borderRadius: 1,
        boxShadow: 3,
        minWidth: 180,
        overflow: "hidden",
      }}
    >
      <Box
        onClick={() => setOpen((v) => !v)}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1.5,
          py: 0.5,
          cursor: "pointer",
          bgcolor: "#0675c9",
          color: "#fff",
        }}
      >
        <Typography variant="subtitle2">Таних тэмдэг</Typography>
        <IconButton sx={{ color: "#fff", p: 0.25 }}>
          {open ? (
            <ExpandMoreIcon fontSize="small" />
          ) : (
            <ExpandLessIcon fontSize="small" />
          )}
        </IconButton>
      </Box>

      <Collapse in={open} timeout="auto" unmountOnExit>
        <Stack sx={{ p: 1.25 }} spacing={0.6}>
          {statuses.map((s) => (
            <Box
              key={s.id}
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <Box
                sx={{
                  width: 18,
                  height: 6,
                  bgcolor: s.color,
                  borderRadius: 0.5,
                  flexShrink: 0,
                }}
              />
              <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0 }}>
                {s.name}
              </Typography>
              <Chip
                label={counts?.[s.id] || 0}
                sx={{
                  height: 18,
                  fontSize: 11,
                  fontWeight: 600,
                  bgcolor: s.color,
                  color: "#fff",
                }}
              />
            </Box>
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
}

RecountLegend.propTypes = {
  statuses: PropTypes.array, // [{id, name, color}]
  counts: PropTypes.object, // {statusId: count}
};
