
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Input: React.FC<InputProps> = ({ label, id, type, step, value, ...props }) => {
  // Default step to 'any' for number inputs to allow decimals unless explicitly overridden
  const defaultStep = type === 'number' && step === undefined ? 'any' : step;

  // Prevent "Received NaN" warning by converting NaN/null/undefined to empty string
  const safeValue = (value === null || value === undefined || Number.isNaN(value)) ? '' : value;

  return (
    <div className="w-full">
      {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
      <input
        id={id}
        type={type}
        step={defaultStep}
        value={safeValue}
        className="block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm transition text-gray-900 dark:text-white font-semibold"
        {...props}
      />
    </div>
  );
};

export default Input;
