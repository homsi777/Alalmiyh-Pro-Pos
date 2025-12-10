import React, { useState } from 'react';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Logo from '../components/Logo';
import { AuthRepository } from '../services/repositories/AuthRepository';
import useNotificationStore from '../store/useNotificationStore';

interface LoginScreenProps {
  onLogin: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const notify = useNotificationStore((state) => state.notify);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
        const result = await AuthRepository.login(username, password);
        if (result.success) {
            onLogin();
        } else {
            notify('اسم المستخدم أو كلمة المرور غير صحيحة', 'error');
        }
    } catch (error) {
        console.error("Login failed", error);
        notify('حدث خطأ أثناء تسجيل الدخول', 'error');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex justify-center mb-8">
            <Logo className="w-24 h-24" showText={true} />
        </div>
        <Card className="p-8 shadow-2xl border-t-4 border-primary">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">تسجيل الدخول</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">نظام العالمية برو لإدارة الأعمال</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              id="username"
              label="اسم المستخدم"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
              autoComplete="username"
            />
            <Input
              id="password"
              label="كلمة المرور"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
            <Button type="submit" className="w-full py-3 text-lg" size="lg" disabled={isLoading}>
              {isLoading ? 'جار التحقق...' : 'دخول للنظام'}
            </Button>
          </form>
        </Card>
        <p className="text-center mt-6 text-xs text-gray-400">Alalmiyh Pro Pos System v1.0</p>
      </div>
    </div>
  );
};

export default LoginScreen;