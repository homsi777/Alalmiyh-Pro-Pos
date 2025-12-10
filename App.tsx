
import React, { useState, useEffect } from 'react';
import useGlobalStore from './store/useGlobalStore';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import PosScreen from './screens/PosScreen';
import InventoryScreen from './screens/InventoryScreen';
import SettingsScreen from './screens/SettingsScreen';
import InvoicesScreen from './screens/InvoicesScreen';
import InvoiceFormScreen from './screens/InvoiceFormScreen';
import ClientsScreen from './screens/ClientsScreen';
import ReportsScreen from './screens/ReportsScreen';
import AccountStatementScreen from './screens/AccountStatementScreen';
import ExpensesScreen from './screens/ExpensesScreen';
import CashRegistersScreen from './screens/CashRegistersScreen';
import SetupWizard from './screens/SetupWizard'; // Import SetupWizard
import { DatabaseService } from './services/database';
import { Screen } from './types';
import NotificationProvider from './components/NotificationProvider';

export type NavigateFunction = (screen: Screen, props?: any) => void;

const App: React.FC = () => {
  const { theme, isAuthenticated, login, loadInitialSettings, isDbLoaded, isSetupCompleted, completeSetup } = useGlobalStore();
  const [screenState, setScreenState] = useState<{screen: Screen, props?: any}>({ screen: Screen.Home });

  useEffect(() => {
    const initializeApp = async () => {
      await DatabaseService.initialize();
      await loadInitialSettings();
    };
    initializeApp();
  }, [loadInitialSettings]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleLogin = () => {
    login();
  };
  
  const navigate: NavigateFunction = (screen: Screen, props = {}) => {
    setScreenState({ screen, props });
  };
  
  const renderScreen = () => {
    switch(screenState.screen) {
      case Screen.Home:
        return <HomeScreen navigate={navigate} />;
      case Screen.Pos:
        return <PosScreen navigate={navigate} />;
      case Screen.Inventory:
        return <InventoryScreen navigate={navigate} />;
      case Screen.Invoices:
        return <InvoicesScreen navigate={navigate} />;
      case Screen.Settings:
        return <SettingsScreen navigate={navigate} />;
      case Screen.InvoiceForm:
        return <InvoiceFormScreen navigate={navigate} {...screenState.props} />;
      case Screen.Clients:
        return <ClientsScreen navigate={navigate} />;
      case Screen.Reports:
        return <ReportsScreen navigate={navigate} />;
      case Screen.AccountStatement:
        return <AccountStatementScreen navigate={navigate} {...screenState.props} />;
      case Screen.Expenses:
        return <ExpensesScreen navigate={navigate} />;
      case Screen.CashRegisters:
        return <CashRegistersScreen navigate={navigate} />;
      default:
        return <HomeScreen navigate={navigate} />;
    }
  }

  if (!isDbLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-xl">جار تهيئة قاعدة البيانات...</p>
      </div>
    );
  }

  // New Check: If setup is not completed, show SetupWizard
  if (!isSetupCompleted) {
      return (
        <div className="min-h-screen w-full transition-colors duration-300">
            <NotificationProvider />
            <SetupWizard onComplete={completeSetup} />
        </div>
      );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen w-full transition-colors duration-300">
      <NotificationProvider />
      {renderScreen()}
    </div>
  );
};

export default App;