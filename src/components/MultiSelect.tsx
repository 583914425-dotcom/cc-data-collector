import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export const MultiSelect = ({ options, value: rawValue = [], onChange, placeholder = "请选择" }: { options: string[], value: string[], onChange: (val: string[]) => void, placeholder?: string }) => {
  const value = Array.isArray(rawValue) ? rawValue : (typeof rawValue === 'string' && rawValue ? [rawValue] : []);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter(v => v !== option));
    } else {
      onChange([...value, option]);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-left text-sm flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <span className="truncate text-gray-700">
          {Array.isArray(value) && value.length > 0 ? value.join(', ') : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.map(option => (
            <label key={option} className="flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={value.includes(option)}
                onChange={() => toggleOption(option)}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-gray-700">{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};
