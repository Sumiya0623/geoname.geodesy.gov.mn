import PropTypes from "prop-types";
import { forwardRef } from "react";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import { useResponsive } from "src/hooks/use-responsive";
import { RouterLink } from "src/routes/components";
import { Typography } from "@mui/material";

export const logoShortUrl = `${process.env.NEXT_PUBLIC_ASSETS_DIR}/logo/logo.svg`;

const Logo = forwardRef(
  ({ disabledLink = false, single = false, sx, ...other }, ref) => {
    const isDesktop = useResponsive("up", "sm");
    const logo = (
      <Box
        ref={ref}
        sx={{
          display: "inline-flex",
          alignItems: "left",
          ...sx,
        }}
        {...other}
      >
        <Box
          component="img"
          src={logoShortUrl}
          alt="Logo"
          sx={{ height: 40, flexShrink: 0 }}
        />

        {!single && (
          <Typography
            align="flex-start"
            variant={isDesktop ? "h5" : "h6"}
            sx={{
              ml: 1,
              fontWeight: "bold",
              textOverflow: "ellipsis",
            }}
          >
            Газар зүйн нэр
          </Typography>
        )}
      </Box>
    );

    if (disabledLink) return logo;

    return (
      <Link
        align="center"
        component={RouterLink}
        href="/"
        sx={{ display: "contents", py: 0 }}
      >
        {logo}
      </Link>
    );
  },
);

Logo.propTypes = {
  disabledLink: PropTypes.bool,
  single: PropTypes.bool,
  sx: PropTypes.object,
};

export default Logo;
