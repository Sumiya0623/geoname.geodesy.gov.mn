"use client";

import PropTypes from "prop-types";

import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import Divider from "@mui/material/Divider";

import Logo from "src/components/logo";
import Scrollbar from "src/components/scrollbar";
import { useAuthContext } from "src/auth/hooks";
import { NavSectionVertical } from "src/components/nav-section";

import { NAV } from "src/layouts/config-layout";
import { useNavData } from "src/layouts/dashboard/config-navigation";

// ----------------------------------------------------------------------
// Газрын зураг дээрх "Үндсэн цэс" — dashboard навигацийг drawer хэлбэрээр.
// ----------------------------------------------------------------------

export default function MapNavDrawer({ open, onClose }) {
  const { user } = useAuthContext();
  const navData = useNavData();

  return (
    <Drawer
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: NAV.W_VERTICAL, bgcolor: "primary.main" },
      }}
    >
      <Scrollbar
        sx={{
          height: 1,
          "& .simplebar-content": {
            height: 1,
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", mt: 2, ml: 2, mb: 1 }}>
          <Logo />
        </Box>

        <Divider sx={{ opacity: 0.2 }} />

        <NavSectionVertical
          data={navData}
          slotProps={{ currentRole: user?.role }}
          sx={{ backgroundColor: "primary.main", flexGrow: 1 }}
        />
      </Scrollbar>
    </Drawer>
  );
}

MapNavDrawer.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
};
