import GeonameDetailView from "src/sections/geoname/view/geoname-detail-view";

// ----------------------------------------------------------------------

export const metadata = {
  title: "Дашбоард: Газар зүйн нэр",
};

export default function GeonameDetailPage({ params }) {
  return <GeonameDetailView id={params.id} />;
}
