import getNavbarIconOptions from "src/server/navbar-icon-options";

import { SystemTabsView } from "src/sections/settings/view";

// ----------------------------------------------------------------------

export const metadata = {
  title: "Дашбоард: Системийн тохиргоо",
};

export const revalidate = 0;

export default function SystemSettingsPage() {
  const iconOptions = getNavbarIconOptions();

  return <SystemTabsView iconOptions={iconOptions} />;
}
