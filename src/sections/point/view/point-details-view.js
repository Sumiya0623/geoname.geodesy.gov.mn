"use client";

import PropTypes from "prop-types";
import Container from "@mui/material/Container";
import PointDetailsGeneral from "../point-details-general";

// ----------------------------------------------------------------------
export default function PointDetailsView({ id }) {
  return (
    <Container maxWidth="xxl">
      <PointDetailsGeneral id={id} />
    </Container>
  );
}

PointDetailsView.propTypes = {
  id: PropTypes.string,
};
