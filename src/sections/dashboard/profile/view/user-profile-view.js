"use client";
import { useState } from "react";
import { Box, Tab, Tabs, Menu, Card, Container } from "@mui/material";
import { paths } from "src/routes/paths";

import Iconify from "src/components/iconify";
import { useSettingsContext } from "src/components/settings";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";
import { useAuthContext } from "src/auth/hooks";
import ProfileCover from "../profile-cover";
import { OrderListView } from "src/sections/order/view";
import { ChampaignListView } from "src/sections/champaign/view";

// --------------------------- Main Component ---------------------------

export default function UserProfileView() {
  const settings = useSettingsContext();
  const { user } = useAuthContext();
  const [currentTab, setCurrentTab] = useState("cart");
  const [anchorEl, setAnchorEl] = useState(null);
  const isMenuOpen = Boolean(anchorEl);

  const MAIN_TABS = [
    {
      value: "cart",
      label: "Худалдан авалт",
      icon: <Iconify icon="solar:user-id-bold" width={24} />,
    },
    {
      value: "agreement",
      label: "Гэрээт ажлууд",
      icon: <Iconify icon="solar:user-id-bold" width={24} />,
    },
  ];

  const handleTabsChange = (event, value) => {
    if (value !== "more") {
      setCurrentTab(value);
      setAnchorEl(null);
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : "xxl"}>
      <CustomBreadcrumbs
        heading="Профайл"
        links={[
          { name: "Дашбоард" },
          { name: "Хэрэглэгч", href: paths.dashboard.user.root },
          { name: `${user?.full_name}` },
        ]}
        sx={{ mb: { xs: 3, md: 1 } }}
      />
      <Card sx={{ mb: 3, minHeight: 200 }}>
        <ProfileCover user={user} />
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            px: 2,
            bgcolor: "background.paper",
            position: "absolute",
            bottom: 0,
            width: "100%",
            zIndex: 9,
          }}
        >
          <Tabs
            value={
              MAIN_TABS.some((tab) => tab.value === currentTab)
                ? currentTab
                : DROPDOWN_TABS.some((tab) => tab.value === currentTab)
                  ? "more"
                  : false
            }
            onChange={handleTabsChange}
            sx={{
              flexGrow: 1,
              [`& .MuiTabs-flexContainer`]: {
                justifyContent: { xs: "center", md: "flex-end" },
              },
            }}
          >
            {MAIN_TABS.map((tab) => (
              <Tab
                key={tab.value}
                value={tab.value}
                icon={tab.icon}
                label={tab.label}
              />
            ))}
          </Tabs>

          <Menu
            anchorEl={anchorEl}
            open={isMenuOpen}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: "top", horizontal: "left" }}
            transformOrigin={{ vertical: "bottom", horizontal: "left" }}
          ></Menu>
        </Box>
      </Card>
      <Box sx={{ mt: 3 }}>
        {currentTab === "agreement" && <ChampaignListView user={user} />}
        {currentTab === "cart" && user && <OrderListView user={user} />}
      </Box>
    </Container>
  );
}
