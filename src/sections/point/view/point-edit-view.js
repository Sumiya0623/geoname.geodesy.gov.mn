"use client";

import PropTypes from "prop-types";
import Container from "@mui/material/Container";
import { paths } from "src/routes/paths";
import { useSettingsContext } from "src/components/settings";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";
import PointNewEditForm from "../point-new-edit-form";
import { useGetPoint } from "src/api/point";

// ----------------------------------------------------------------------

export default function PointEditView({ id }) {
  const settings = useSettingsContext();

  const { point: currentPoint } = useGetPoint(id);

  return (
    <Container maxWidth={settings.themeStretch ? false : "xxl"}>
      <CustomBreadcrumbs
        heading="Засах"
        links={[
          { name: "Dashboard", href: paths.dashboard.root },
          {
            name: "Цэг тэмдэгт",
            href: paths.dashboard.point.root,
          },
          { name: currentPoint?.name },
        ]}
        sx={{
          mb: { xs: 3, md: 5 },
        }}
      />

      <PointNewEditForm currentPoint={currentPoint} />
    </Container>
  );
}

PointEditView.propTypes = {
  id: PropTypes.string,
};
