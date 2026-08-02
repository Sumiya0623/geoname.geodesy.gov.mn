"use client";

import PropTypes from "prop-types";
import { useMemo } from "react";

import {
  Box,
  Card,
  Chip,
  Stack,
  Divider,
  Typography,
  IconButton,
} from "@mui/material";

import Iconify from "src/components/iconify";

// ----------------------------------------------------------------------
// «Шийдвэр» / «Хүсэлт» табын WMS давхарга дээр дарахад гарах товч мэдээлэл.
//   Шийдвэр : ЗЗ нэгжийн НИЙТ тоо + АКТЫН ТӨРӨЛ тус бүрийн тоо (legal_unit_view)
//   Хүсэлт  : саналын нэр, төрөл, төлөв (request_view)
// ----------------------------------------------------------------------

export default function TabInfoCard({ info, onClose }) {
  const { tab, props: p } = info || {};

  const view = useMemo(() => {
    if (!p) return null;
    if (tab === "legal") {
      let counts = p.type_counts;
      if (typeof counts === "string") {
        try {
          counts = JSON.parse(counts);
        } catch (e) {
          counts = {};
        }
      }
      return {
        title: p.unit_name || "ЗЗ нэгж",
        sub: [p.parent_unit, p.level_name].filter(Boolean).join(" · "),
        total: p.total,
        rows: Object.entries(counts || {}).map(([name, n]) => ({ name, n })),
      };
    }
    return {
      title: p.option_names || p.current_name || `Хүсэлт #${p.id ?? ""}`,
      sub: [p.kind, p.type_name].filter(Boolean).join(" · "),
      total: null,
      rows: [
        { name: "Төлөв", n: p.status_name || "—" },
        ...(p.current_name
          ? [{ name: "Одоогийн нэр", n: p.current_name }]
          : []),
        ...(p.age_name ? [{ name: "Нас", n: p.age_name }] : []),
      ],
    };
  }, [tab, p]);

  if (!view) return null;

  return (
    <Card
      sx={{
        position: "absolute",
        top: 20,
        right: 80,
        p: 1.5,
        width: 260,
        zIndex: 5,
        borderRadius: 1.5,
      }}
    >
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        spacing={1}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>
            {view.title}
          </Typography>
          {view.sub && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {view.sub}
            </Typography>
          )}
        </Box>
        <IconButton size="small" onClick={onClose}>
          <Iconify icon="mingcute:close-line" width={16} />
        </IconButton>
      </Stack>

      {view.total != null && (
        <Chip
          size="small"
          color="primary"
          variant="soft"
          label={`Нийт ${view.total}`}
          sx={{ mt: 1 }}
        />
      )}

      <Divider sx={{ my: 1, borderStyle: "dashed" }} />

      <Stack spacing={0.75}>
        {view.rows.map((r) => (
          <Stack
            key={r.name}
            direction="row"
            justifyContent="space-between"
            spacing={1}
          >
            <Typography variant="body2" color="text.secondary" noWrap>
              {r.name}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, flexShrink: 0 }}>
              {r.n}
            </Typography>
          </Stack>
        ))}
        {!view.rows.length && (
          <Typography variant="caption" color="text.secondary">
            Мэдээлэл алга
          </Typography>
        )}
      </Stack>
    </Card>
  );
}

TabInfoCard.propTypes = {
  info: PropTypes.object,
  onClose: PropTypes.func,
};
