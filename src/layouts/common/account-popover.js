import { m } from "framer-motion";

import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Divider from "@mui/material/Divider";
import { alpha } from "@mui/material/styles";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";

import { useRouter } from "src/routes/hooks";

import { useAuthContext } from "src/auth/hooks";
import { varHover } from "src/components/animate";
import { useSnackbar } from "src/components/snackbar";
import CustomPopover, { usePopover } from "src/components/custom-popover";
import { Button, Chip } from "@mui/material";

export default function AccountPopover() {
  const router = useRouter();

  const { user, logout } = useAuthContext();

  const { enqueueSnackbar } = useSnackbar();

  const popover = usePopover();

  const handleLogout = async () => {
    try {
      await logout();
      popover.onClose();
      router.replace("/");
    } catch (error) {
      console.error(error);
      enqueueSnackbar("Гарах үед алдаа гарлаа!", { variant: "error" });
    }
  };

  return (
    <>
      <IconButton
        component={m.button}
        whileTap="tap"
        whileHover="hover"
        variants={varHover(1.05)}
        onClick={popover.onOpen}
        sx={{
          width: 40,
          height: 40,
          background: (theme) => alpha(theme.palette.grey[500], 0.08),
          ...(popover.open && {
            background: (theme) =>
              `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
          }),
        }}
      >
        <Avatar
          src={user?.photo}
          alt={user?.full_name}
          sx={{
            width: 36,
            height: 36,
            border: (theme) => `solid 2px ${theme.palette.background.default}`,
          }}
        >
          {user?.full_name?.charAt(0).toUpperCase()}
        </Avatar>
      </IconButton>

      <CustomPopover
        open={popover.open}
        onClose={popover.onClose}
        sx={{ width: 200, p: 0 }}
      >
        <Box sx={{ p: 2, pb: 1.5 }}>
          <Typography variant="subtitle2" noWrap>
            {user?.full_name}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
            {user?.email}
          </Typography>
          {user?.roles?.length > 0 && (
            <Box
              sx={{
                mt: 0.1,
                display: "flex-start",
                flexDirection: "column",
                gap: 1,
                mx: 2,
                maxWidth: "100%",
              }}
            >
              {user.roles.map((role) => (
                <Chip
                  key={role.id || role.name}
                  label={role.name}
                  size="small"
                  variant="filled"
                  color="primary"
                  sx={{
                    mt: 0.5,
                    p: 0.5,
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    maxWidth: "100%",
                    height: "auto",
                    "& .MuiChip-label": {
                      px: 1,
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                      lineHeight: 1.2,
                    },
                  }}
                />
              ))}
            </Box>
          )}
        </Box>
        {/* <Stack sx={{ p: 1 }}>
          {OPTIONS.map((option) => (
            <MenuItem key={option.label} onClick={() => handleClickItem(option.linkTo)}>
              {option.label}
            </MenuItem>
          ))}
        </Stack> */}
        <Divider sx={{ borderStyle: "dashed" }} />

        <MenuItem
          sx={{ m: 1, fontWeight: "fontWeightBold" }}
        >
          <Button
            href='/dashboard/profile'
            sx={{ p: 0, m: 0 }}
          >
            Профайл
          </Button>
        </MenuItem>
        <MenuItem
          onClick={handleLogout}
          sx={{ m: 1, fontWeight: "fontWeightBold", color: "error.main" }}
        >
          Гарах
        </MenuItem>
      </CustomPopover>
    </>
  );
}
