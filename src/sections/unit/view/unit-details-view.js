"use client";

import PropTypes from "prop-types";

import Container from "@mui/material/Container";

import { paths } from "src/routes/paths";
import { useSettingsContext } from "src/components/settings";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";

import { useGetUnit, useGetUnitsFordropdown } from "src/api/unit";

// ----------------------------------------------------------------------

export default function UnitDetailsView({ id }) {
  const settings = useSettingsContext();
  const { unit } = useGetUnit(id);
  const { menus } = useGetUnitsFordropdown(`parent=${unit.id}`);
  return (
    <Container maxWidth={settings.themeStretch ? false : "xxl"}>
      <CustomBreadcrumbs
        heading={`"${unit?.name}" ангилалын дэлгэрэнгүй`}
        links={[
          {
            name: "Ангилал",
            href: paths.dashboard.unit.root,
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
