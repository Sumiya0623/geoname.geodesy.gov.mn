import React from "react";
import InquirePaymentView from "src/sections/inquire/payment/inquire-payment-view";

function Inquire({ params: { id } }) {
  return <InquirePaymentView id={id} />;
}

export default Inquire;
