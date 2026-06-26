import { CouncilListView } from "src/sections/council/view";

// ----------------------------------------------------------------------

export const metadata = {
  title: "Дашбоард: Зөвлөлийн сан",
};

export const revalidate = 0;

export default function CouncilPage() {
  return <CouncilListView />;
}
