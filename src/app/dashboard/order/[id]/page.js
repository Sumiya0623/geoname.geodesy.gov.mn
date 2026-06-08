import PropTypes from "prop-types";


import { OrderDetailsView } from "src/sections/order/view";

// ----------------------------------------------------------------------

export const metadata = {
  title: "Dashboard: Order Details",
};

export default function OrderDetailsPage({ params }) {
  const { id } = params;

  return <OrderDetailsView id={id} />;
}

OrderDetailsPage.propTypes = {
  id: PropTypes.string,
};
