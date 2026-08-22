import PropTypes from "prop-types";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
import { alpha, useTheme } from "@mui/material/styles";

import { bgGradient } from "src/theme/css";
import { Typography } from "@mui/material";

// ----------------------------------------------------------------------

export default function ProfileCover({
  name,
  avatarUrl,
  roles,
  coverUrl,
  email,
}) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        ...bgGradient({
          color: alpha(theme.palette.primary?.dark, 0.8),
          imgUrl: coverUrl,
        }),
        height: 1,
        color: "common.white",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        sx={{
          left: { md: 24 },
          bottom: { md: 25 },
          zIndex: { md: 10 },
          pt: { xs: 6, md: 0 },
          position: { md: "absolute" },
        }}
      >
        <Avatar
          alt={name}
          src={avatarUrl}
          sx={{
            mx: "auto",
            width: { xs: 64, md: 128 },
            height: { xs: 64, md: 128 },
            border: `solid 2px ${theme.palette.common.white}`,
          }}
        >
          {name?.charAt(0).toUpperCase()}
        </Avatar>

        <Stack direction={"column"}>
          <Typography
            variant="h4"
            sx={{
              mt: 0.5,
              ml: { md: 3 },
              textAlign: { xs: "center", md: "unset" },
            }}
          >
            {name}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              mt: 0.5,
              ml: { md: 3 },
              textAlign: { xs: "center", md: "unset" },
            }}
          >
            {roles}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              mt: 0.5,
              ml: { md: 3 },
              textAlign: { xs: "center", md: "unset" },
            }}
          >
            {email}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

ProfileCover.propTypes = {
  avatarUrl: PropTypes.string,
  coverUrl: PropTypes.string,
  name: PropTypes.string,
  roles: PropTypes.string,
};
