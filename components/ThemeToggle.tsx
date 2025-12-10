
import React from 'react';
import useGlobalStore from '../store/useGlobalStore';
import { Sun, Moon } from './icons';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useGlobalStore();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-dark-background transition-all duration-300"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
    </button>
  );
};

export default ThemeToggle;
