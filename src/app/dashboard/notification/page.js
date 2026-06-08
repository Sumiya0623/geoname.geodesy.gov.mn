import { NotificationListView } from 'src/sections/dashboard/notification/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Дашбоард: Мэдэгдэл',
};

export const revalidate = 0;

export default function NotificationListPage() {
  return <NotificationListView />;
}
