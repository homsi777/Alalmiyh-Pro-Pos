
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  const baseClasses = "bg-white dark:bg-gray-800/50 rounded-xl shadow-lg transition-all duration-300 ease-in-out backdrop-blur-sm";
  const interactiveClasses = onClick ? "cursor-pointer hover:shadow-2xl hover:-translate-y-1" : "";

  return (
    <div className={`${baseClasses} ${interactiveClasses} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
};

export default Card;
