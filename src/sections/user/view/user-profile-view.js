"use client";

import { useState, useCallback } from "react";

import Tab from "@mui/material/Tab";
import Card from "@mui/material/Card";
import Container from "@mui/material/Container";
import Tabs, { tabsClasses } from "@mui/material/Tabs";

import { paths } from "src/routes/paths";

import { _userAbout } from "src/_mock";

import Iconify from "src/components/iconify";
import { useSettingsContext } from "src/components/settings";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";

import ProfileCover from "../profile-cover";
// import { MonposDeviceListView } from 'src/sections/monpos-device/view';
// import { MonposJobListView } from 'src/sections/monpos-job/view';
// import { MonposPointListView } from 'src/sections/monpos-point/view';
import { useAuthContext } from "src/auth/hooks";

// ----------------------------------------------------------------------

const TABS = [
  {
    value: "profile",
    label: "GNSS Receiver",
    icon: <Iconify icon="solar:user-id-bold" width={24} />,
  },
  {
    value: "followers",
    label: "Тэгштгэн бодолт",
    icon: <Iconify icon="solar:heart-bold" width={24} />,
  },
  {
    value: "friends",
    label: "Цэг, Тэмдэгт",
    icon: <Iconify icon="solar:users-group-rounded-bold" width={24} />,
  },
  // {
  //   value: 'gallery',
  //   label: 'Gallery',
  //   icon: <Iconify icon="solar:gallery-wide-bold" width={24} />,
  // },
];

// ----------------------------------------------------------------------

export default function UserProfileView() {
  const settings = useSettingsContext();

  // const { user } = useMockedUser();
  const { user, logout } = useAuthContext();

  const [searchFriends, setSearchFriends] = useState("");

  const [currentTab, setCurrentTab] = useState("profile");

  const handleChangeTab = useCallback((event, newValue) => {
    setCurrentTab(newValue);
  }, []);

  const handleSearchFriends = useCallback((event) => {
    setSearchFriends(event.target.value);
  }, []);

  return (
    <Container maxWidth={settings.themeStretch ? false : "xxl"}>
      <CustomBreadcrumbs
        heading="Profile"
        links={[
          { name: "Dashboard", href: paths.dashboard.root },
          { name: "User", href: paths.dashboard.user.root },
          { name: user?.displayName },
        ]}
        sx={{
          mb: { xs: 3, md: 5 },
        }}
      />

      <Card
        sx={{
          mb: 3,
          height: 290,
        }}
      >
        <ProfileCover
          roles={user?.roles}
          name={user?.full_name}
          avatarUrl={user?.photo}
          coverUrl={_userAbout.coverUrl}
          email={user?.email}
        />

        <Tabs
          value={currentTab}
          onChange={handleChangeTab}
          sx={{
            width: 1,
            bottom: 0,
            zIndex: 9,
            position: "absolute",
            bgcolor: "background.paper",
            [`& .${tabsClasses.flexContainer}`]: {
              pr: { md: 3 },
              justifyContent: {
                sm: "center",
                md: "flex-end",
              },
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
      </Card>

      {/* {currentTab === 'profile' && <MonposDeviceListView userId={user?.id} />}

      {currentTab === 'followers' && <MonposJobListView userId={user?.id} />}

      {currentTab === 'friends' && <MonposPointListView userId={user?.id} />} */}
    </Container>
  );
}
