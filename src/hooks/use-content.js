// src/hooks/use-content.js
import React, { useMemo } from 'react';
import { useAuthContext } from 'src/auth/hooks';
import { usePathname } from 'next/navigation';

function toSubmenuArray(menus = []) {
  const looksFlat =
    menus.length > 0 &&
    menus.every((m) => (m.path || m.content || m.actions) && !Array.isArray(m.submenus));
  if (looksFlat) return menus;
  const out = [];
  (menus || []).forEach((m) => (m.submenus || []).forEach((sm) => out.push(sm)));
  return out;
}

function findContentByPathname(menus = [], pathname) {
  const submenus = toSubmenuArray(menus);
  
  if (!pathname) return '';
  
  const cur = String(pathname).replace(/\/+$/, '');
  let bestMatch = null;
  let bestLength = 0;
  
  submenus.forEach((sm) => {
    const p = String(sm.path || '').replace(/\/+$/, '');
    if (p && (cur === p || cur.startsWith(p + '/'))) {
      if (p.length > bestLength) {
        bestLength = p.length;
        bestMatch = sm;
      }
    }
  });
  
  return bestMatch?.content || '';
}

export function useContent() {
  const { user } = useAuthContext();
  const pathname = usePathname();
  
  const menus = useMemo(() => user?.menus || [], [user?.menus]);

  const prevUser = React.useRef(user);
  const prevPathname = React.useRef(pathname);
  const prevMenus = React.useRef(menus);
  
  if (prevUser.current !== user) {
    prevUser.current = user;
  }
  if (prevPathname.current !== pathname) {
    prevPathname.current = pathname;
  }
  if (prevMenus.current !== menus) {
    prevMenus.current = menus;
  }

  const content = useMemo(() => {
    return findContentByPathname(menus, pathname);
  }, [menus, pathname]);

  return content;
}
