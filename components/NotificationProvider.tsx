import React from 'react';
import useNotificationStore from '../store/useNotificationStore';
import Toast from './common/Toast';

const NotificationProvider: React.FC = () => {
  const notifications = useNotificationStore((state) => state.notifications);
  const dismiss = useNotificationStore((state) => state.dismiss);

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 w-auto max-w-sm">
      {notifications.map((n) => (
        <Toast key={n.id} notification={n} onDismiss={dismiss} />
      ))}
    </div>
  );
};

export default NotificationProvider;
