import { useParams } from 'react-router-dom';
import { NotificationList } from '../components/notifications/NotificationList';

export function NotificationsPage() {
  useParams();
  return <NotificationList />;
}
