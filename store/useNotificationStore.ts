import { create } from 'zustand';

export interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface NotificationState {
  notifications: Notification[];
  notify: (message: string, type?: Notification['type']) => void;
  dismiss: (id: number) => void;
}

const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  notify: (message, type = 'info') => {
    const newNotification = { id: Date.now(), message, type };
    set((state) => ({ notifications: [...state.notifications, newNotification] }));
  },
  dismiss: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },
}));

export default useNotificationStore;
