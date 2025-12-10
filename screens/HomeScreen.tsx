
import React from 'react';
import Card from '../components/common/Card';
import { ShoppingCart, Package, Users, BarChart2, Settings, FileText, LogOut, Wallet, Archive } from '../components/icons';
import ThemeToggle from '../components/ThemeToggle';
import Logo from '../components/Logo';
import useGlobalStore from '../store/useGlobalStore';
import { Screen } from '../types';
import { NavigateFunction } from '../App';

interface HomeScreenProps {
  navigate: NavigateFunction;
}

interface MenuItem {
  title: string;
  icon: React.ElementType;
  screen: Screen;
  color: string;
}

const menuItems: MenuItem[] = [
  { title: 'نقطة بيع سريعة', icon: ShoppingCart, screen: Screen.Pos, color: 'text-sky-500' },
  { title: 'الفواتير', icon: FileText, screen: Screen.Invoices, color: 'text-green-500' },
  { title: 'المخزون', icon: Package, screen: Screen.Inventory, color: 'text-orange-500' },
  { title: 'العملاء والموردون', icon: Users, screen: Screen.Clients, color: 'text-purple-500' },
  { title: 'المصاريف', icon: Wallet, screen: Screen.Expenses, color: 'text-yellow-500' },
  { title: 'الصناديق', icon: Archive, screen: Screen.CashRegisters, color: 'text-indigo-500' },
  { title: 'التقارير', icon: BarChart2, screen: Screen.Reports, color: 'text-red-500' },
  { title: 'الإعدادات', icon: Settings, screen: Screen.Settings, color: 'text-gray-500' },
];

const MenuItemCard: React.FC<{ item: MenuItem; onClick: () => void }> = ({ item, onClick }) => (
    <Card onClick={onClick} className="p-4 flex flex-col items-center justify-center text-center aspect-square animate-slide-in-up hover:scale-105 transition-transform duration-200 border-2 border-transparent hover:border-primary/20">
        <div className={`p-4 rounded-full bg-gray-50 dark:bg-gray-800 mb-4 ${item.color}`}>
            <item.icon className="w-8 h-8" />
        </div>
        <h2 className="font-bold text-lg text-foreground dark:text-dark-foreground">{item.title}</h2>
    </Card>
);

const HomeScreen: React.FC<HomeScreenProps> = ({ navigate }) => {
  const { logout, companyInfo } = useGlobalStore();

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 bg-gray-50 dark:bg-gray-900">
      <header className="flex justify-between items-center mb-10 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-4">
            <Logo className="w-12 h-12" showText={false} />
            <div>
                <h1 className="text-2xl font-bold text-primary">{companyInfo.name}</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">نظام إدارة الأعمال المتكامل</p>
            </div>
        </div>
        <div className="flex items-center space-x-4 gap-2">
          <ThemeToggle />
          <div className="h-8 w-px bg-gray-200 dark:bg-gray-700"></div>
          <button onClick={logout} className="flex items-center gap-2 px-4 py-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <span className="font-bold text-sm hidden sm:block">تسجيل خروج</span>
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>
      
      <main>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {menuItems.map((item, index) => (
            <div key={item.title} style={{ animationDelay: `${index * 50}ms` }}>
                 <MenuItemCard item={item} onClick={() => navigate(item.screen)} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default HomeScreen;
