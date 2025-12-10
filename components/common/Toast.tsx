import React, { useEffect } from 'react';
import { Notification } from '../../store/useNotificationStore';

interface ToastProps {
  notification: Notification;
  onDismiss: (id: number) => void;
}

const Toast: React.FC<ToastProps> = ({ notification, onDismiss }) => {
  const { id, message, type } = notification;

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(id);
    }, 5000);

    return () => {
      clearTimeout(timer);
    };
  }, [id, onDismiss]);
  
  const typeClasses = {
    success: 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/50 dark:border-green-700 dark:text-green-300',
    error: 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/50 dark:border-red-700 dark:text-red-300',
    info: 'bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900/50 dark:border-blue-700 dark:text-blue-300',
  }

  // Success icon
  const SuccessIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
  );

  // Error icon
  const ErrorIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
  );

  const Icon = type === 'success' ? <SuccessIcon /> : type === 'error' ? <ErrorIcon /> : null;

  return (
    <div className={`w-full max-w-sm p-4 border-l-4 rounded-md shadow-lg ${typeClasses[type]} animate-slide-in-up`} role="alert">
      <div className="flex items-center">
        {Icon && <div className="flex-shrink-0 mr-3 h-6 w-6">{Icon}</div>}
        <div className="flex-1">
          <p className="font-semibold">{message}</p>
        </div>
        <button onClick={() => onDismiss(id)} className="ml-4 text-xl font-bold">&times;</button>
      </div>
    </div>
  );
};

export default Toast;
