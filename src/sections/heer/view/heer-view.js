"use client";

import PropTypes from "prop-types";
import { useState } from "react";

import { Box, Card, Stack, Button, Typography } from "@mui/material";

import Iconify from "src/components/iconify";

import WorkMapDialog from "../work-map-dialog";

// ----------------------------------------------------------------------
// Хээрийн судалгаа — ажлын зураг (төслийн дахин тооллогоор A0 PDF).
// ----------------------------------------------------------------------

export default function HeerView({ projectId }) {
  const [open, setOpen] = useState(false);

  if (!projectId) return null;

  return (
    <Box>
      <Card sx={{ p: 2.5 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ sm: "center" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Typography variant="h6">Ажлын зураг</Typography>
            <Typography variant="body2" color="text.secondary">
              Тухайн төслийн дахин тооллогын цэгүүдээр хээрийн судалгааны ажлын
              зургийг (A0) үүсгэнэ. Сумдыг тооллогын байршлаас авто тодорхойлж,
              урьдчилан харуулна.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Iconify icon="solar:map-bold" />}
            onClick={() => setOpen(true)}
            sx={{ flexShrink: 0 }}
          >
            Ажлын зураг үүсгэх
          </Button>
        </Stack>
      </Card>

      <WorkMapDialog
        open={open}
        onClose={() => setOpen(false)}
        projectId={projectId}
      />
    </Box>
  );
}

HeerView.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
