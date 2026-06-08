import { useMemo } from "react";

import { useAuthContext } from "src/auth/hooks";

// ----------------------------------------------------------------------

export function useNavData() {
  const { user } = useAuthContext();
  // list эрхтэй бол меню хэсэгт харагдана.
  const data = useMemo(
    () =>
      user?.menus
        ?.map((menu) => ({
          ...menu,
          submenus:
            menu?.submenus?.filter(
              (submenu) =>
                submenu?.path !== "" &&
                Array.isArray(submenu?.actions) &&
                // submenu.actions.some((action) => action.key === "menu")
                submenu.actions.some((action) => action.key === "list")
            ) || [],
        }))
        .filter((menu) => menu?.submenus?.length > 0) || [],
    [user]
  );

  if (data && data.length > 0) {
    return data;
  } else return [];
}
