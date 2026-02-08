'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  debounceMs?: number;
}

export function SearchBar({
  placeholder = 'Search...',
  onSearch,
  debounceMs = 300,
}: SearchBarProps) {
  const [value, setValue] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedSearch = useCallback(
    (query: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        onSearch(query);
      }, debounceMs);
    },
    [onSearch, debounceMs]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    debouncedSearch(newValue);
  };

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <svg
          className="h-5 w-5 text-gray-400"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <input
        type="text"
        className="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
      />
    </div>
  );
}
