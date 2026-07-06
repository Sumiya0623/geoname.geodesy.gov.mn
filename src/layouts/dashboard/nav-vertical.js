import { useEffect } from "react";
import PropTypes from "prop-types";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Drawer from "@mui/material/Drawer";

import { usePathname } from "src/routes/hooks";
import { useAuthContext } from "src/auth/hooks";
import { useResponsive } from "src/hooks/use-responsive";

import Logo from "src/components/logo";
import Scrollbar from "src/components/scrollbar";
import ProfileAvatar from "src/components/profile-avatar";
import { NavSectionVertical } from "src/components/nav-section";
import { RouterLink } from "src/routes/components";

import { NAV } from "../config-layout";
import { useNavData } from "./config-navigation";
import NavToggleButton from "../common/nav-toggle-button";

export default function NavVertical({ openNav, onCloseNav }) {
  const { user } = useAuthContext();
  const pathname = usePathname();
  const lgUp = useResponsive("up", "lg");
  const navData = useNavData();

  useEffect(() => {
    if (openNav) {
      onCloseNav();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const renderContent = (
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
      <Logo sx={{ display: "flex", justifyContent: "center", mt: 2, mb: 1 }} />

      {/* Профайл хэсэг */}
      <Box sx={{ px: 2, py: 1.5, bgcolor: "primary.main" }}>
        <Stack
          component={RouterLink}
          href="/dashboard/profile"
          direction="row"
          alignItems="center"
          spacing={1.25}
          sx={{
            p: 1,
            borderRadius: 2,
            textDecoration: "none",
            bgcolor: "rgba(255,255,255,0.12)",
            "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
          }}
        >
          <ProfileAvatar user={user} size={44} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box
              sx={{
                color: "common.white",
                fontWeight: 700,
                fontSize: 14,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user?.full_name || user?.first_name || "Профайл"}
            </Box>
            {user?.email && (
              <Box
                sx={{
                  color: "rgba(255,255,255,0.75)",
                  fontSize: 11,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user.email}
              </Box>
            )}
          </Box>
        </Stack>
      </Box>

      <NavSectionVertical
        data={navData}
        slotProps={{ currentRole: user?.role }}
        sx={{ backgroundColor: "primary.main", flexGrow: 1 }}
      />
    </Scrollbar>
  );

  return (
    <Box
      sx={{
        flexShrink: { lg: 0 },
        width: { lg: NAV.W_VERTICAL },
      }}
    >
      <NavToggleButton />

      {lgUp ? (
        <Stack
          sx={{
            height: 1,
            position: "fixed",
            width: NAV.W_VERTICAL,
            borderRight: (theme) => `dashed 1px ${theme.palette.divider}`,
          }}
        >
          {renderContent}
        </Stack>
      ) : (
        <Drawer
          open={openNav}
          onClose={onCloseNav}
          PaperProps={{
            sx: {
              width: NAV.W_VERTICAL,
            },
          }}
        >
          {renderContent}
        </Drawer>
      )}
    </Box>
  );
}

NavVertical.propTypes = {
  openNav: PropTypes.bool,
  onCloseNav: PropTypes.func,
};
