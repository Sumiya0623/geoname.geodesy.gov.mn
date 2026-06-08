import PropTypes from "prop-types";
import { useState, useEffect, useCallback, useMemo } from "react";

import { usePathname, useRouter } from "src/routes/hooks";

import { SplashScreen } from "src/components/loading-screen";
import { paths } from "src/routes/paths";

import { useAuthContext } from "../hooks";
import { publicPaths } from "./public-path";

// ----------------------------------------------------------------------

const normalizePath = (path) => {
  if (typeof path !== "string") {
    return "";
  }

  let normalizedPath = path.trim();

  if (!normalizedPath) {
    return "";
  }

  if (!normalizedPath.startsWith("/")) {
    normalizedPath = `/${normalizedPath}`;
  }

  normalizedPath = normalizedPath.replace(/\/{2,}/g, "/");

  if (normalizedPath.length > 1 && normalizedPath.endsWith("/")) {
    normalizedPath = normalizedPath.replace(/\/+$/, "");
  }

  return normalizedPath;
};

const matchNormalizedPath = (
  currentPath,
  candidatePath,
  allowChildren = false
) => {
  if (!candidatePath) {
    return false;
  }

  if (currentPath === candidatePath) {
    return true;
  }

  if (!allowChildren) {
    if (
      candidatePath !== "/dashboard" &&
      currentPath.startsWith(`${candidatePath}/`)
    ) {
      return true;
    }
    return false;
  }

  if (candidatePath === "/") {
    return true;
  }

  return currentPath.startsWith(`${candidatePath}/`);
};

const parseOrder = (value) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
};

const createPathEntry = (pathValue, options = {}) => {
  if (typeof pathValue !== "string") {
    return null;
  }

  const trimmedPath = pathValue.trim();
  const normalizedPath = normalizePath(trimmedPath);

  if (!normalizedPath) {
    return null;
  }

  const allowChildren =
    typeof options.allowChildren === "boolean"
      ? options.allowChildren
      : trimmedPath.endsWith("/") || normalizedPath === "/";

  return {
    path: trimmedPath.startsWith("/") ? trimmedPath : normalizedPath,
    normalizedPath,
    allowChildren,
  };
};

const flattenMenuEntries = (menus = []) => {
  if (!Array.isArray(menus)) {
    return [];
  }

  return menus
    .slice()
    .sort((a, b) => parseOrder(a?.order) - parseOrder(b?.order))
    .flatMap((menu) => {
      const submenus = Array.isArray(menu?.submenus)
        ? menu.submenus.slice()
        : [];

      submenus.sort((a, b) => parseOrder(a?.order) - parseOrder(b?.order));

      return submenus
        .map((submenu) => {
          const entry = createPathEntry(submenu?.path);
          if (!entry) {
            return null;
          }
          return {
            ...entry,
            actions: submenu?.actions || [],
          };
        })
        .filter(Boolean);
    });
};

const hasAccessToPath = (menuEntries, pathname) => {
  const normalizedPathname = normalizePath(pathname);
  if (!normalizedPathname) {
    return false;
  }
  return menuEntries.some((entry) =>
    matchNormalizedPath(
      normalizedPathname,
      entry.normalizedPath,
      entry.allowChildren
    )
  );
};

const ALWAYS_PUBLIC_PATHS = [
  paths.page403,
  paths.page404,
  paths.page500,
  paths.maintenance,
  paths.auth?.jwt?.login,
  "/login",
];

const ALWAYS_PUBLIC_ENTRIES = ALWAYS_PUBLIC_PATHS.map((publicPath) =>
  createPathEntry(publicPath, { allowChildren: false })
).filter(Boolean);

const CONFIG_PUBLIC_ENTRIES = publicPaths
  .map((publicPath) => createPathEntry(publicPath, { allowChildren: false }))
  .filter(Boolean);

const NORMALIZED_LOGIN_PATH = normalizePath("/login");

const NORMALIZED_MAINTENANCE_PATH = normalizePath(paths.maintenance);

const isPublicPath = (pathname) => {
  const normalizedPathname = normalizePath(pathname);

  if (!normalizedPathname) {
    return false;
  }

  if (
    ALWAYS_PUBLIC_ENTRIES.some((entry) =>
      matchNormalizedPath(
        normalizedPathname,
        entry.normalizedPath,
        entry.allowChildren
      )
    )
  ) {
    return true;
  }

  return CONFIG_PUBLIC_ENTRIES.some((entry) =>
    matchNormalizedPath(
      normalizedPathname,
      entry.normalizedPath,
      entry.allowChildren
    )
  );
};

// ----------------------------------------------------------------------

export default function AuthGuard({ children }) {
  const { loading } = useAuthContext();
  return <>{loading ? <SplashScreen /> : <Container> {children}</Container>}</>;
}

AuthGuard.propTypes = {
  children: PropTypes.node,
};

// ----------------------------------------------------------------------

function Container({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { authenticated, user } = useAuthContext();
  const menuEntries = useMemo(() => flattenMenuEntries(user?.menus), [user]);
  const [checked, setChecked] = useState(false);

  const check = useCallback(() => {
    if (!pathname) {
      setChecked(true);
      return;
    }

    const normalizedPathname = normalizePath(pathname);

    if (isPublicPath(normalizedPathname)) {
      setChecked(true);
      return;
    }

    if (!authenticated) {
      if (!matchNormalizedPath(normalizedPathname, NORMALIZED_LOGIN_PATH)) {
        router.replace("/login");
      }
      return;
    }

    if (!hasAccessToPath(menuEntries, pathname)) {
      if (
        !matchNormalizedPath(normalizedPathname, NORMALIZED_MAINTENANCE_PATH)
      ) {
        router.replace(paths.maintenance);
        return;
      }

      setChecked(true);
      return;
    }

    setChecked(true);
  }, [authenticated, menuEntries, pathname, router]);

  useEffect(() => {
    setChecked(false);
    check();
  }, [check]);

  if (!checked) {
    return null;
  }

  return <>{children}</>;
}

Container.propTypes = {
  children: PropTypes.node,
};
