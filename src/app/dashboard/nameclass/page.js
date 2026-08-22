import { NameClassListView } from "src/sections/geoname/nameclass/view";

// ----------------------------------------------------------------------

export const metadata = {
  title: "Дашбоард: Дэвсгэр нэр",
};

export const revalidate = 0;

export default function NameClassListPage() {
  return <NameClassListView />;
}
