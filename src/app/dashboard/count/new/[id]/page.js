import React from "react";
import NewCount from "src/sections/count/new";

function page({ params }) {
  return <NewCount pointId={params?.id} />;
}

export default page;
