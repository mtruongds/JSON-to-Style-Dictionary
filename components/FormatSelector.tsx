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
  excludeParentKeys: boolean;
  onExcludeParentKeysChange: (value: boolean) => void;
  prefix: string;
  onPrefixChange: (value: string) => void;
}

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id: string;
  label: string;
}

const Switch: React.FC<SwitchProps> = ({ checked, onCheckedChange, id, label }) => (
  <div className="flex items-center space-x-2">
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-input"
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
    <label
      htmlFor={id}
      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
      onClick={() => onCheckedChange(!checked)}
    >
      {label}
    </label>
  </div>
);


const FormatSelector: React.FC<FormatSelectorProps> = ({ 
  options, 
  value, 
  onChange,
  excludeParentKeys,
  onExcludeParentKeysChange,
  prefix,
  onPrefixChange
}) => {
  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ml-1">
          Output Format
        </label>
      </div>
      
      <div className="flex flex-col gap-4">
        <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-full sm:w-auto self-start">
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

        <div className="flex flex-row flex-wrap items-center gap-6 pl-1">
            <Switch
              id="excludeParentKeys"
              label="Exclude Parent Keys"
              checked={excludeParentKeys}
              onCheckedChange={onExcludeParentKeysChange}
            />

            <div className="flex items-center gap-2">
                <label htmlFor="prefixInput" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Prefix
                </label>
                <input 
                    id="prefixInput"
                    type="text" 
                    value={prefix}
                    onChange={(e) => onPrefixChange(e.target.value)}
                    placeholder="e.g. ds"
                    className="flex h-8 w-24 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
            </div>
        </div>
      </div>
    </div>
  );
};

export default FormatSelector;