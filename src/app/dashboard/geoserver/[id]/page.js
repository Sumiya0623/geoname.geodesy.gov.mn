import PropTypes from "prop-types";


import { GeoServerDetailsView } from "src/sections/geoserver/view";

// ----------------------------------------------------------------------

export const metadata = {
  title: "Dashboard: Сервисийн дэлгэрэнгүй",
};

export default function GeoServerDetailsPage({ params }) {
  const { id } = params;

  return <GeoServerDetailsView id={id} />;
}

GeoServerDetailsPage.propTypes = {
  id: PropTypes.string,
};
