"use client";

import Container from "@mui/material/Container";

import { paths } from "src/routes/paths";

import { useGetMenusFordropdown } from "src/api/menu";

import { useSettingsContext } from "src/components/settings";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";

import UnitNewEditForm from "../unit-new-edit-form";

// ----------------------------------------------------------------------

export default function UnitCreateView() {
  const settings = useSettingsContext();

  const { menus } = useGetMenusFordropdown();

  return (
    <Container maxWidth={settings.themeStretch ? false : "xxl"}>
      <CustomBreadcrumbs
        heading="Нэгж нэмэх"
        links={[
          {
            name: "Эрхийн жагсаалт",
            href: paths.dashboard.unit.root,
          },
          {
            name: "Нэмэх",
          },
        ]}
        sx={{
          mb: { xs: 3, md: 5 },
        }}
      />

      <UnitNewEditForm menus={menus} />
    </Container>
  );
}
