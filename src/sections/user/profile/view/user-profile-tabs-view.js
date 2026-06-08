"use client";

import { useState } from "react";

import { Box, Tab, Tabs, Card, Container } from "@mui/material";

import { paths } from "src/routes/paths";

import Iconify from "src/components/iconify";
import { useSettingsContext } from "src/components/settings";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";
import { useAuthContext } from "src/auth/hooks";

import ProfileCover from "src/sections/dashboard/profile/profile-cover";

import ProfileRequests from "../profile-requests";
import ProfileNames from "../profile-names";
import ProfileReferences from "../profile-references";
import ProfileNotifications from "../profile-notifications";

// ----------------------------------------------------------------------

const TABS = [
  {
    value: "request",
    label: "Хүсэлт",
    icon: <Iconify icon="solar:document-add-bold" width={24} />,
  },
  {
    value: "notification",
    label: "Мэдэгдэл",
    icon: <Iconify icon="solar:bell-bing-bold" width={24} />,
  },
  {
    value: "name",
    label: "Нэр",
    icon: <Iconify icon="solar:map-point-bold" width={24} />,
  },
  {
    value: "reference",
    label: "Лавлагаа",
    icon: <Iconify icon="solar:file-text-bold" width={24} />,
  },
];

// ----------------------------------------------------------------------

export default function UserProfileTabsView() {
  const settings = useSettingsContext();
  const { user } = useAuthContext();
  const [currentTab, setCurrentTab] = useState("request");

  return (
    <Container maxWidth={settings.themeStretch ? false : "xxl"}>
      <CustomBreadcrumbs
        heading="Миний булан"
        links={[
          { name: "Дашбоард", href: paths.dashboard.root },
          { name: `${user?.full_name || "Профайл"}` },
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
            value={currentTab}
            onChange={(event, value) => setCurrentTab(value)}
            sx={{
              flexGrow: 1,
              [`& .MuiTabs-flexContainer`]: {
                justifyContent: { xs: "center", md: "flex-end" },
              },
            }}
          >
            {TABS.map((tab) => (
              <Tab
                key={tab.value}
                value={tab.value}
                icon={tab.icon}
                label={tab.label}
              />
            ))}
          </Tabs>
        </Box>
      </Card>

      <Box sx={{ mt: 3 }}>
        {currentTab === "request" && <ProfileRequests />}
        {currentTab === "notification" && <ProfileNotifications />}
        {currentTab === "name" && <ProfileNames />}
        {currentTab === "reference" && <ProfileReferences />}
      </Box>
    </Container>
  );
}
