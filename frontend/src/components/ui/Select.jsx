import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

const Select = ({ children, value, onValueChange, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value || '');
  const dropdownRef = useRef(null);

  useEffect(() => {
    setSelectedValue(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (value) => {
    setSelectedValue(value);
    onValueChange(value);
    setIsOpen(false);
  };

  const selectedChild = React.Children.toArray(children).find(
    child => child.props.value === selectedValue
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className={selectedValue ? 'text-foreground' : 'text-muted-foreground'}>
          {selectedChild ? selectedChild.props.children : 'Select option...'}
        </span>
        <ChevronDownIcon className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-input rounded-md shadow-lg max-h-60 overflow-auto">
          {React.Children.map(children, child => (
            <div
              key={child.props.value}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground first:rounded-t-md last:rounded-b-md"
              onClick={() => handleSelect(child.props.value)}
            >
              {child.props.children}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SelectTrigger = ({ children, className = '', ...props }) => {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
};

const SelectContent = ({ children, className = '', ...props }) => {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
};

const SelectItem = ({ children, value, className = '', ...props }) => {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
};

const SelectValue = ({ placeholder, children }) => {
  return children || placeholder;
};

export { Select, SelectTrigger, SelectContent, SelectItem, SelectValue };
