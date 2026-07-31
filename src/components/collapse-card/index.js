import PropTypes from "prop-types";
import { useState } from "react";

import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Collapse from "@mui/material/Collapse";
import Typography from "@mui/material/Typography";

import Iconify from "src/components/iconify";

// ----------------------------------------------------------------------
// Задардаг карт — толгойд icon + гарчиг (+тоо), дарж нээх/хаах.
// Төслийн үе шатны хуудсууд (Суурин судалгаа, Хээрийн судалгаа г.м) дотор
// жагсаалт бүрийг ижил хэлбэрээр багцлахад ашиглана.
// ----------------------------------------------------------------------

export default function CollapseCard({
  icon = "solar:folder-bold",
  title,
  count,
  defaultOpen = true,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card sx={{ mb: 2 }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ p: 2.5, cursor: "pointer" }}
        onClick={() => setOpen((v) => !v)}
      >
        <Iconify icon={icon} width={22} />
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {title}
          {count ? ` (${count})` : ""}
        </Typography>
        <Iconify
          icon={open ? "eva:chevron-up-fill" : "eva:chevron-down-fill"}
          width={20}
        />
      </Stack>

      <Collapse in={open} timeout="auto" unmountOnExit>
        <Divider />
        {children}
      </Collapse>
    </Card>
  );
}

CollapseCard.propTypes = {
  icon: PropTypes.string,
  title: PropTypes.string,
  count: PropTypes.number,
  defaultOpen: PropTypes.bool,
  children: PropTypes.node,
};
