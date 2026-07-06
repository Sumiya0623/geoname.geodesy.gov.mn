import { GisTabsView } from "src/sections/settings/view";

// ----------------------------------------------------------------------

export const metadata = {
  title: "Дашбоард: GIS",
};

export const revalidate = 0;

export default function GisSettingsPage() {
  return <GisTabsView />;
}
