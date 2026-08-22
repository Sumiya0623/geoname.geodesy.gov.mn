import { RequestListView } from "src/sections/dashboard/request/view";

// ----------------------------------------------------------------------

export const metadata = {
  title: "Дашбоард: Иргэний хүсэлт",
};

export const revalidate = 0;

export default function RequestListPage() {
  return <RequestListView />;
}
