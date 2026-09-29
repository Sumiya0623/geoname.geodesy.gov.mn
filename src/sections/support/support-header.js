"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";

import { useAuthContext } from "src/auth/hooks";

import Iconify from "src/components/iconify";
import ProfileAvatar from "src/components/profile-avatar";

// ----------------------------------------------------------------------
// Төв системийн тусламжийн хуудастай ижил толгой: системийн нэр, цэс,
// нэвтэрсэн хэрэглэгч.
// ----------------------------------------------------------------------

const LINKS = [
  { href: "/", label: "НҮҮР" },
  { href: "/dashboard", label: "СИСТЕМ" },
  { href: "/guideline", label: "ЗААВАР" },
  { href: "/support", label: "ТУСЛАМЖ" },
];

export default function SupportHeader() {
  const pathname = usePathname();
  const { user } = useAuthContext();

  return (
    <Box component="header">
      {/* Системийн нэр */}
      <Box sx={{ bgcolor: "primary.main", py: { xs: 1.25, md: 1.75 } }}>
        <Container maxWidth="xl">
          <Typography
            variant="h5"
            sx={{
              color: "common.white",
              fontWeight: 700,
              textAlign: "center",
              fontSize: { xs: "1rem", md: "1.5rem" },
            }}
          >
            Газар зүйн нэрийн дэд систем
          </Typography>
        </Container>
      </Box>

      {/* Цэс ба хэрэглэгч */}
      <Box sx={{ bgcolor: "grey.900" }}>
        <Container maxWidth="xl">
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1}
            sx={{ py: 0.75, minHeight: 48 }}
          >
            <Stack
              direction="row"
              spacing={{ xs: 0.25, md: 1.5 }}
              sx={{ overflowX: "auto", minWidth: 0 }}
            >
              {LINKS.map((link) => {
                const active = pathname?.startsWith(link.href) && link.href !== "/";
                return (
                  <Button
                    key={link.href}
                    component={NextLink}
                    href={link.href}
                    size="small"
                    sx={{
                      flexShrink: 0,
                      color: active ? "common.white" : "grey.400",
                      fontSize: { xs: "0.7rem", md: "0.8rem" },
                      fontWeight: 700,
                      px: { xs: 1, md: 1.5 },
                      "&:hover": { color: "common.white" },
                    }}
                  >
                    {link.label}
                  </Button>
                );
              })}
            </Stack>

            {user ? (
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ flexShrink: 0, pl: 1 }}
              >
                <ProfileAvatar user={user} size={28} />
                <Typography
                  variant="body2"
                  sx={{
                    color: "common.white",
                    display: { xs: "none", sm: "block" },
                  }}
                >
                  {user.full_name || user.first_name}
                </Typography>
              </Stack>
            ) : (
              <Button
                component={NextLink}
                href="/"
                size="small"
                startIcon={<Iconify icon="solar:login-3-bold-duotone" width={16} />}
                sx={{ flexShrink: 0, color: "common.white", fontSize: "0.75rem" }}
              >
                Нэвтрэх
              </Button>
            )}
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
