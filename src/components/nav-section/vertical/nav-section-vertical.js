import PropTypes from "prop-types";
import { memo, useState, useCallback } from "react";

import Stack from "@mui/material/Stack";
import Collapse from "@mui/material/Collapse";
import ListSubheader from "@mui/material/ListSubheader";
import { PowerSettingsNew as TurnOffIcon } from "@mui/icons-material";
import { useRouter } from "src/routes/hooks";
import { useAuthContext } from "src/auth/hooks";
import Iconify from "src/components/iconify";
import NavList from "./nav-list";
import { Box, Button } from "@mui/material";

function NavSectionVertical({ data, slotProps, ...other }) {
  const { logout } = useAuthContext();
  const router = useRouter();
  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/");
    } catch (error) {
      console.error(error);
    }
  };
  return (
    <>
      <Stack
        component="nav"
        id="nav-section-vertical"
        sx={{ height: 1, justifyContent: "space-between" }}
        {...other}
      >
        <Box sx={{ flexGrow: 1 }}>
          {data.map((group, index) => (
            <Group
              key={group.id || index}
              subheader={group.name}
              items={group.submenus}
              slotProps={slotProps}
            />
          ))}
        </Box>

        {/* Bottom: logout button only */}
        <Stack direction="row" justifyContent="center" sx={{ px: 3, pb: 3 }}>
          <Button
            variant="contained"
            color="error"
            fullWidth
            onClick={handleLogout}
            endIcon={<TurnOffIcon fontSize="small" />}
            sx={{
              justifyContent: "center",
              "& .MuiButton-endIcon": {
                ml: 1,
              },
            }}
          >
            Гарах
          </Button>
        </Stack>
      </Stack>
    </>
  );
}

NavSectionVertical.propTypes = {
  data: PropTypes.array,
  slotProps: PropTypes.object,
};

export default memo(NavSectionVertical);

// ----------------------------------------------------------------------

function Group({ subheader, items, slotProps }) {
  const [open, setOpen] = useState(true);

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const renderContent =
    items &&
    items.map((list) => (
      <NavList key={list.id} data={list} depth={1} slotProps={slotProps} />
    ));

  return (
    <Stack sx={{ px: 2 }}>
      {subheader ? (
        <>
          <ListSubheader
            disableGutters
            disableSticky
            onClick={handleToggle}
            sx={{
              fontSize: 11,
              cursor: "pointer",
              typography: "overline",
              display: "inline-flex",
              color: "common.white",
              mb: `${slotProps?.gap || 4}px`,
              p: (theme) => theme.spacing(2, 1, 1, 1.5),
              transition: (theme) =>
                theme.transitions.create(["color"], {
                  duration: theme.transitions.duration.shortest,
                }),
              "&:hover": {
                color: "text.primary",
              },
              ...slotProps?.subheader,
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              width={1}
            >
              {subheader}

              <Iconify
                icon={
                  open
                    ? "eva:arrow-ios-downward-fill"
                    : "eva:arrow-ios-forward-fill"
                }
              />
            </Stack>
          </ListSubheader>

          <Collapse in={open}>{renderContent}</Collapse>
        </>
      ) : (
        renderContent
      )}
    </Stack>
  );
}

Group.propTypes = {
  items: PropTypes.array,
  subheader: PropTypes.string,
  slotProps: PropTypes.object,
};
