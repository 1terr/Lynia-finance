'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDevices } from '@/lib/api/devices';
import { Search } from 'lucide-react';

interface DeviceSearchProps {
  value?: string;
  onSelect: (device: { id: string; imei: string; model_name: string }) => void;
  placeholder?: string;
}

export function DeviceSearch({ value, onSelect, placeholder = 'Search by IMEI...' }: DeviceSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['device-search', query],
    queryFn: () => getDevices({ search: query, limit: 10 }),
    enabled: query.length >= 3,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={selectedLabel || query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedLabel('');
            setOpen(true);
          }}
          onFocus={() => query.length >= 3 && setOpen(true)}
          placeholder={placeholder}
          className="block w-full rounded-md border border-border py-2 pl-10 pr-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      {open && data?.data && data.data.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-card shadow-lg max-h-48 overflow-auto">
          {data.data.map((d) => (
            <button
              key={d.id}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent border-b border-border last:border-0"
              onClick={() => {
                onSelect({ id: d.id, imei: d.imei || '', model_name: `${d.manufacturer} ${d.model}` });
                setSelectedLabel(`${d.imei} — ${d.manufacturer} ${d.model}`);
                setQuery('');
                setOpen(false);
              }}
            >
              <span className="font-mono text-foreground">{d.imei}</span>
              <span className="ml-2 text-muted-foreground">{d.manufacturer} {d.model}</span>
            </button>
          ))}
        </div>
      )}
      {value && <input type="hidden" value={value} />}
    </div>
  );
}
