
import React from 'react';

interface FormatOption {
  value: string;
  label: string;
}

interface FormatSelectorProps {
  options: FormatOption[];
  value: string;
  onChange: (value: string) => void;
}

const FormatSelector: React.FC<FormatSelectorProps> = ({ options, value, onChange }) => {
  return (
    <div>
      <label id="format-group-label" className="block text-sm font-medium text-slate-400 mb-2">Output Format</label>
      <div className="flex flex-wrap sm:flex-nowrap gap-1 bg-slate-900/70 p-1 rounded-lg border border-slate-700" role="group" aria-labelledby="format-group-label">
        {options.map((option) => {
          const isSelected = value === option.value;
          const baseClasses = "flex-grow px-3 py-2 text-sm font-semibold rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 transition-all duration-200 text-center";
          const variantClasses = isSelected
            ? "bg-cyan-500 text-slate-900 shadow-lg"
            : "bg-transparent text-slate-300 hover:bg-slate-700";
          
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`${baseClasses} ${variantClasses}`}
              aria-pressed={isSelected}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FormatSelector;
