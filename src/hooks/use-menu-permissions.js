// src/hooks/use-menu-permissions.js
import { useMemo } from "react";
import { useAuthContext } from "src/auth/hooks";

function toSubmenuArray(menus = []) {
  const looksFlat =
    menus.length > 0 &&
    menus.every(
      (m) => (m.path || m.content || m.actions) && !Array.isArray(m.submenus),
    );
  if (looksFlat) return menus;
  const out = [];
  (menus || []).forEach((m) =>
    (m.submenus || []).forEach((sm) => out.push(sm)),
  );
  return out;
}

function buildIndex(menus = []) {
  const byPath = {},
    byContent = {};
  const submenus = toSubmenuArray(menus);

  submenus.forEach((sm) => {
    const p = String(sm.path || "").replace(/\/+$/, "");
    const c = String(sm.content || "")
      .trim()
      .toLowerCase();
    // Backend `key` талбарт action-ы машины нэрийг (`update`, `toggle_active` ...)
    // илгээдэг. Бүх ирсэн эрхийг динамикаар авна — hardcode/шүүлт хийхгүй.
    const actions = (sm.actions || [])
      .map((a) =>
        String(a?.key || "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);

    if (p) byPath[p] = new Set([...(byPath[p] || []), ...actions]);
    if (c) byContent[c] = new Set([...(byContent[c] || []), ...actions]);
  });

  return { byPath, byContent };
}

function resolve(index, { pathname, content }) {
  const c = String(content || "")
    .trim()
    .toLowerCase();
  if (c && index.byContent[c]) return index.byContent[c];

  if (pathname) {
    const cur = String(pathname).replace(/\/+$/, "");
    let best = "";
    Object.keys(index.byPath).forEach((p) => {
      if (cur === p || cur.startsWith(p + "/"))
        if (p.length > best.length) best = p;
    });
    if (best) return index.byPath[best] || new Set();
  }
  return new Set();
}

// ✅ requiredActions байхгүй – таван түлхүүрийг автоматаар буцаана
export function useMenuPermissions(opts = {}) {
  const { user } = useAuthContext();
  const menus = useMemo(() => user?.menus || [], [user?.menus]);
  const index = useMemo(() => buildIndex(menus), [menus]);
  const set = useMemo(
    () => resolve(index, { pathname: opts.pathname, content: opts.content }),
    [index, opts.pathname, opts.content],
  );
  // Backend-ээс ирсэн бүх эрхийг динамикаар тугласан байдлаар буцаана.
  // Суурь түлхүүрүүд эрхгүй үед ч false-аар тодорхой байхаар анхдагчтай.
  const perms = {
    list: false,
    detail: false,
    create: false,
    update: false,
    delete: false,
    copy: false,
  };
  set.forEach((k) => {
    perms[k] = true;
  });
  return {
    ...perms,
    can: (k) =>
      set.has(
        String(k || "")
          .trim()
          .toLowerCase(),
      ),
  };
}
