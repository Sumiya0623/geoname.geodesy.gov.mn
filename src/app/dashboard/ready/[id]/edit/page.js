import PropTypes from "prop-types";


import { PointEditView } from "src/sections/point/view";

// ----------------------------------------------------------------------

export const metadata = {
  title: "Цэг тэмдэгт: Засах",
};

export default function PointEditPage({ params }) {
  const { id } = params;

  return <PointEditView id={id} />;
}

PointEditPage.propTypes = {
  id: PropTypes.string,
};
