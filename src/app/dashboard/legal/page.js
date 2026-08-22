import { LegalListView } from "src/sections/council/legal/view";

// ----------------------------------------------------------------------

export const metadata = {
  title: "Дашбоард: Тогтоол, шийдвэрийн сан",
};

export const revalidate = 0;

export default function LegalListPage() {
  return <LegalListView />;
}
