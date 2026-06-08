import PropTypes from "prop-types";

import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { usePathname } from "src/routes/hooks";
import { RouterLink } from "src/routes/components";

// ----------------------------------------------------------------------

export default function NavSubList({ data, slotProps, ...other }) {
  const pathname = usePathname();

  return (
    <>
      {data.map((list, index) => (
        <Stack key={list.subheader + index} spacing={1} {...other}>
          {list.subheader && (
            <Typography variant="subtitle2" noWrap sx={slotProps?.subheader}>
              {list.subheader}
            </Typography>
          )}
          {list.items
            // 1) path байх ёстой
            .filter((link) => !!link?.path)
            // 2) path === "hidden" бол алгас
            .filter(
              (link) => String(link.path).trim().toLowerCase() !== "hidden"
            )
            .map((link) => {
              // trailing slash-г нормчлоод active шалгах
              const norm = (p) => String(p || "").replace(/\/+$/, "");
              const active = norm(pathname) === norm(link.path);

              return (
                <Link
                  noWrap
                  key={link.id || link.title} // боломжтой бол id хэрэглэх нь дээр
                  component={RouterLink}
                  href={link.path}
                  className={active ? "active" : ""}
                  variant="body2"
                  sx={{
                    fontSize: 13,
                    color: "text.secondary",
                    transition: (theme) => theme.transitions.create("all"),
                    "&:hover": { color: "text.primary" },
                    ...(active && {
                      color: "text.primary",
                      textDecoration: "underline",
                      fontWeight: "fontWeightSemiBold",
                    }),
                    ...slotProps?.subItem,
                  }}
                >
                  {link.title}
                </Link>
              );
            })}
        </Stack>
      ))}
    </>
  );
}

NavSubList.propTypes = {
  data: PropTypes.array,
  slotProps: PropTypes.object,
};
