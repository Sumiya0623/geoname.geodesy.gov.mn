"use client";

import PropTypes from "prop-types";
import { useCallback, useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Container, Tabs, Tab, tabsClasses, Card } from "@mui/material";

import Iconify from "src/components/iconify";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";

import { UserListView } from "src/sections/settings/user/view";
import { RoleListView } from "src/sections/settings/role/view";
import { MenuListView } from "src/sections/settings/menu/view";
import { ConstantListView } from "src/sections/settings/constant/view";

// ----------------------------------------------------------------------
// Тав бүр нь өөрийн SubMenu-ийн `content` түлхүүрээр харах (`list`) эрхээ шалгана.
// Зөвхөн харах эрхтэй хэсгүүд таб болж харагдана.

export default function SystemTabsView({ iconOptions }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const userPerm = useMenuPermissions({ content: "user" });
  const rolePerm = useMenuPermissions({ content: "role" });
  const menuPerm = useMenuPermissions({ content: "menus" });
  const constantPerm = useMenuPermissions({ content: "constant" });

  const TABS = useMemo(
    () => [
      {
        value: "user",
        label: "Хэрэглэгч",
        icon: <Iconify icon="solar:users-group-rounded-bold" width={24} />,
        allowed: userPerm.list,
        render: () => <UserListView embedded />,
      },
      {
        value: "role",
        label: "Эрх",
        icon: <Iconify icon="solar:shield-keyhole-bold" width={24} />,
        allowed: rolePerm.list,
        render: () => <RoleListView embedded />,
      },
      {
        value: "menu",
        label: "Цэс",
        icon: <Iconify icon="solar:list-bold" width={24} />,
        allowed: menuPerm.list,
        render: () => <MenuListView iconOptions={iconOptions} embedded />,
      },
      {
        value: "constant",
        label: "Тогтмол",
        icon: <Iconify icon="solar:settings-bold" width={24} />,
        allowed: constantPerm.list,
        render: () => <ConstantListView embedded />,
      },
    ],
    [
      userPerm.list,
      rolePerm.list,
      menuPerm.list,
      constantPerm.list,
      iconOptions,
    ],
  );

  const allowedTabs = useMemo(() => TABS.filter((t) => t.allowed), [TABS]);

  const requested = searchParams.get("tab");
  const fallback = allowedTabs[0]?.value || "";
  const [currentTab, setCurrentTab] = useState(
    allowedTabs.some((t) => t.value === requested) ? requested : fallback,
  );

  // Зөвшөөрөгдсөн таб солигдвол / deep-link ирвэл идэвхтэй табыг тааруулна.
  useEffect(() => {
    if (!allowedTabs.length) return;
    const valid = allowedTabs.some((t) => t.value === currentTab);
    if (!valid) setCurrentTab(allowedTabs[0].value);
  }, [allowedTabs, currentTab]);

  useEffect(() => {
    if (
      requested &&
      requested !== currentTab &&
      allowedTabs.some((t) => t.value === requested)
    ) {
      setCurrentTab(requested);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested]);

  const handleChangeTab = useCallback(
    (_e, next) => {
      setCurrentTab(next);
      const q = new URLSearchParams(Array.from(searchParams.entries()));
      q.set("tab", next);
      router.replace(`?${q.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const CurrentRender = useMemo(
    () => allowedTabs.find((t) => t.value === currentTab)?.render,
    [allowedTabs, currentTab],
  );

  return (
    <Container maxWidth="xxl">
      {allowedTabs.length > 0 ? (
        <>
          <Card sx={{ px: 2, mb: 2 }}>
            <Tabs
              value={currentTab}
              onChange={handleChangeTab}
              variant="scrollable"
              allowScrollButtonsMobile
              sx={{
                [`& .${tabsClasses.flexContainer}`]: {
                  pr: { md: 3 },
                  justifyContent: { sm: "center", md: "flex-start" },
                },
              }}
            >
              {allowedTabs.map((tab) => (
                <Tab
                  key={tab.value}
                  value={tab.value}
                  icon={tab.icon}
                  label={tab.label}
                />
              ))}
            </Tabs>
          </Card>
          {CurrentRender?.()}
        </>
      ) : null}
    </Container>
  );
}

SystemTabsView.propTypes = {
  iconOptions: PropTypes.array,
};
