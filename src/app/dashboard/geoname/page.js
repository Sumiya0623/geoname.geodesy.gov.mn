import { GeonameListView } from "src/sections/geoname/view";

// ----------------------------------------------------------------------

export const metadata = {
  title: "Дашбоард: Газар зүйн нэр",
};

export const revalidate = 0;

export default function GeonamePage() {
  return <GeonameListView />;
}
