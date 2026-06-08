"use client";

import PropTypes from "prop-types";
import { LayerListView } from "../layer/view";

// ----------------------------------------------------------------------

export default function GeoServerDetailsView({ id }) {
  return <LayerListView stId={id} />;
}

GeoServerDetailsView.propTypes = {
  id: PropTypes.string,
};
