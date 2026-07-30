"use client";

import PropTypes from "prop-types";
import { useState } from "react";

import Chip from "@mui/material/Chip";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Unstable_Grid2";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import Box from "@mui/material/Box";
import { fDate } from "src/utils/format-time";
import Iconify from "src/components/iconify";
import ProfileAvatar from "src/components/profile-avatar";

export default function ProjectDetailsContent({ project }) {
  const percent = Number(project?.percent) || 0;
  const [open, setOpen] = useState(false);
  const units = project?.units || [];
  const renderGeneral = (
    <Stack
      component={Card}
      id="agreement-detail"
      spacing={2}
      sx={{ p: { xs: 2, md: 3 } }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        justifyContent="space-between"
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <ProfileAvatar user={project?.org} size="small" />
          <Typography variant="body2">{project?.org?.full_name}</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Iconify icon="solar:chart-2-bold-duotone" width={20} />
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Гүйцэтгэл:
          </Typography>
          <Typography variant="body1">
            <b>
              {Number.isFinite(Number(percent))
                ? `${Number(percent).toFixed(1)}%`
                : "—"}
            </b>
          </Typography>
        </Stack>
      </Stack>
      <Box sx={{ mt: 0.5 }}>
        <LinearProgress
          variant="determinate"
          value={Math.max(0, Math.min(100, percent))}
          sx={{ height: 10, borderRadius: 999 }}
        />

        <Box
          sx={{
            mt: 0.5,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            color: "text.secondary",
          }}
        >
          <span>{fDate(project?.signed_date)}</span>
          <span>{fDate(project?.end_date)}</span>
        </Box>
      </Box>

      {/* Төслийн хамрах засаг захиргааны нэгж */}
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Iconify
            icon="solar:map-point-bold-duotone"
            width={18}
            sx={{ color: "primary.main" }}
          />
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Хамрах засаг захиргаа:
          </Typography>
        </Stack>
        {units.length ? (
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {units.map((u) => (
              <Chip
                key={u.id}
                size="small"
                variant="soft"
                color="primary"
                label={u.parent_unit ? `${u.parent_unit}, ${u.unit}` : u.unit}
              />
            ))}
          </Stack>
        ) : (
          <Typography variant="caption" color="text.secondary">
            Тохируулаагүй — «Гэрээт ажил» жагсаалтын цэснээс тохируулна уу.
          </Typography>
        )}
      </Box>
    </Stack>
  );

  return (
    <>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        rowGap={1}
        columnGap={2}
      >
        <Typography variant="h6" sx={{ wordBreak: "break-word", flex: 1 }}>
          {project?.name || "—"}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Chip label={`№ ${project?.dugaar || "—"}`} size="small" />
          <IconButton size="small" onClick={() => setOpen((v) => !v)}>
            <Iconify
              icon={open ? "eva:chevron-up-fill" : "eva:chevron-down-fill"}
              width={20}
            />
          </IconButton>
        </Stack>
      </Stack>
      <Collapse in={open}>
        <Divider sx={{ my: 1 }} />
        <Grid container spacing={{ xs: 2, md: 3, lg: 4 }}>
          <Grid xs={12} md={12}>
            {renderGeneral}
          </Grid>
        </Grid>
      </Collapse>
    </>
  );
}

ProjectDetailsContent.propTypes = {
  project: PropTypes.object,
};
