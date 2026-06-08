import PropTypes from "prop-types";


import { PointDetailsView } from "src/sections/point/view";

// ----------------------------------------------------------------------

export const metadata = {
  title: "Цэг тэмдэгт: Дэлгэрэнгүй",
};

export default function PointDetailsPage({ params }) {
  const { id } = params;
  return <PointDetailsView id={id} />;
}

PointDetailsPage.propTypes = {
  id: PropTypes.string,
};
