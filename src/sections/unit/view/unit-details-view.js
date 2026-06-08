"use client";

import PropTypes from "prop-types";

import Container from "@mui/material/Container";

import { paths } from "src/routes/paths";
import { useSettingsContext } from "src/components/settings";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";

import { useGetLevel, useGetLevelsFordropdown } from "src/api/level";

// ----------------------------------------------------------------------

export default function UnitDetailsView({ id }) {
  const settings = useSettingsContext();
  const { level } = useGetLevel(id);
  const { menus } = useGetLevelsFordropdown(`parent=${level.id}`);
  return (
    <Container maxWidth={settings.themeStretch ? false : "xxl"}>
      <CustomBreadcrumbs
        heading={`"${level?.name}" ангилалын дэлгэрэнгүй`}
        links={[
          {
            name: "Ангилал",
            href: paths.dashboard.level.root,
          },
          { name: "Дэлгэрэнгүй" },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
    </Container>
  );
}

UnitDetailsView.propTypes = {
  id: PropTypes.string,
};
