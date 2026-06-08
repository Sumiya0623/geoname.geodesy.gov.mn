"use client";

import PropTypes from "prop-types";

import Container from "@mui/material/Container";

import { paths } from "src/routes/paths";

import { useGetRole } from "src/api/role";
import { useGetMenusFordropdown } from "src/api/menu";

import { useSettingsContext } from "src/components/settings";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";

import RoleNewEditForm from "../log-new-edit-form";

// ----------------------------------------------------------------------

export default function RoleDetailsView({ id }) {
  const settings = useSettingsContext();

  const { role } = useGetRole(id);

  const { menus } = useGetMenusFordropdown();

  return (
    <Container maxWidth={settings.themeStretch ? false : "xxl"}>
      <CustomBreadcrumbs
        heading="Эрхийн дэлгэрэнгүй"
        links={[
          {
            name: "Эрхийн жагсаалт",
            href: paths.dashboard.role.root,
          },
          { name: "Дэлгэрэнгүй" },
        ]}
      />

      <RoleNewEditForm
        currentRole={role}
        //
        menus={menus}
        //
        view
      />
    </Container>
  );
}

RoleDetailsView.propTypes = {
  id: PropTypes.string,
};
