import { UserProfileTabsView } from "src/sections/user/profile/view";

// ----------------------------------------------------------------------

export const metadata = {
  title: "Дашбоард: Миний булан",
};

export const revalidate = 0;

export default function UserProfilePage() {
  return <UserProfileTabsView />;
}
