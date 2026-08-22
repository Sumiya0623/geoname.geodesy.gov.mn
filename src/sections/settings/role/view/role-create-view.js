"use client";

import Container from "@mui/material/Container";

import { paths } from "src/routes/paths";

import { useGetMenusFordropdown } from "src/api/menu";

import { useSettingsContext } from "src/components/settings";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";

import RoleNewEditForm from "../role-new-edit-form";

// ----------------------------------------------------------------------

export default function RoleCreateView() {
  const settings = useSettingsContext();

  const { menus } = useGetMenusFordropdown();

  return (
    <Container maxWidth={settings.themeStretch ? false : "xxl"}>
      <CustomBreadcrumbs
        heading="Эрх нэмэх"
        links={[
          {
            name: "Эрхийн жагсаалт",
            href: paths.dashboard.role.root,
          },
          {
            name: "Нэмэх",
          },
        ]}
        sx={{
          mb: { xs: 3, md: 5 },
        }}
      />

      <RoleNewEditForm menus={menus} />
    </Container>
  );
}
