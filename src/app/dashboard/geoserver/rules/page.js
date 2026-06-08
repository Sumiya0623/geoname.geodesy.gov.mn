// ----------------------------------------------------------------------

import { RuleListView } from "src/sections/geoserver/rule";

export const metadata = {
  title: "Дашбоард: Style rules",
};

export default function RuleListPage({ params }) {
  const styleId = Number(params.id);
  return <RuleListView selectedStyleId={styleId} />;
}
