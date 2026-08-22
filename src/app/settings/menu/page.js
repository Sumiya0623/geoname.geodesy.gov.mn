import { MenuListView } from "src/sections/settings/menu/view";

import getNavbarIconOptions from "src/server/navbar-icon-options";

// ----------------------------------------------------------------------

export const metadata = {
  title: "Дашбоард: Цэсний группийн жагсаалт",
};

export const revalidate = 0;

export default function MenuListPage() {
  const iconOptions = getNavbarIconOptions();

  return <MenuListView iconOptions={iconOptions} />;
}
