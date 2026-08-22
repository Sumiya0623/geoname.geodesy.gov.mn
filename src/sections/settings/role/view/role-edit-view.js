"use client";

import PropTypes from "prop-types";
import Container from "@mui/material/Container";
import { paths } from "src/routes/paths";
import { useSettingsContext } from "src/components/settings";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";
import RoleNewEditForm from "../role-new-edit-form";
import { useGetMenus, useGetRole } from "src/api/constant";

export default function RoleEditView({ id }) {
  const settings = useSettingsContext();
  const { role } = useGetRole(id);
  const { menus = [] } = useGetMenus();
  return (
    <Container maxWidth={settings.themeStretch ? false : "xxl"}>
      <CustomBreadcrumbs
        heading="Эрх засах"
        links={[
          {
            name: "Эрхийн жагсаалт",
            href: paths.dashboard.role.root,
          },
          { name: "Засах" },
        ]}
        sx={{ mb: { xs: 3, md: 1 } }}
      />
      <RoleNewEditForm currentRole={role} menus={menus} />
    </Container>
  );
}

RoleEditView.propTypes = {
  id: PropTypes.string,
};
