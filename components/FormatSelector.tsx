
import React from 'react';
import { cn } from '../lib/utils';

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
    <div className="space-y-3">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ml-2 mr-2">
        Output Format
      </label>
      <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-full sm:w-auto">
        {options.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 flex-1 sm:flex-none",
                isSelected 
                  ? "bg-background text-foreground shadow-sm" 
                  : "hover:bg-background/50 hover:text-foreground"
              )}
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