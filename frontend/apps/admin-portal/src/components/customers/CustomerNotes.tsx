'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { addCustomerNote } from '@/lib/api/customers';
import { formatDateTime } from '@lynia/utils';
import { useAuthStore } from '@/lib/store/auth-store';
import type { CustomerNote } from '@/types/database';

interface CustomerNotesProps {
  customerId: string;
  notes: CustomerNote[];
}

const noteTypeColors: Record<string, 'blue' | 'yellow' | 'red' | 'gray'> = {
  general: 'blue',
  support: 'gray',
  collections: 'yellow',
  fraud_alert: 'red',
};

export function CustomerNotes({ customerId, notes }: CustomerNotesProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [noteType, setNoteType] = useState<string>('general');
  const [noteText, setNoteText] = useState('');
  const queryClient = useQueryClient();
  // HIGH-10: Use authenticated admin's ID instead of hardcoded 'current-admin'
  const adminUser = useAuthStore((s) => s.user);

  const addNoteMutation = useMutation({
    mutationFn: () =>
      addCustomerNote(customerId, noteType, noteText, adminUser?.id || 'unknown'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      setNoteText('');
      setIsAdding(false);
    },
  });

  return (
    <div className="rounded-lg bg-card p-6 shadow">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          Notes ({notes?.length || 0})
        </h2>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          {isAdding ? 'Cancel' : 'Add Note'}
        </button>
      </div>

      {isAdding && (
        <div className="mt-4 rounded-lg border border-border p-4">
          <div className="mb-3">
            <label htmlFor="note-type" className="block text-sm font-medium text-foreground">
              Note Type
            </label>
            <select
              id="note-type"
              value={noteType}
              onChange={(e) => setNoteType(e.target.value)}
              className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="general">General</option>
              <option value="support">Support</option>
              <option value="collections">Collections</option>
              <option value="fraud_alert">Fraud Alert</option>
            </select>
          </div>
          <div className="mb-3">
            <label htmlFor="note-text" className="block text-sm font-medium text-foreground">
              Note
            </label>
            <textarea
              id="note-text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              maxLength={2000}
              className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Enter your note..."
            />
          </div>
          <button
            onClick={() => addNoteMutation.mutate()}
            disabled={!noteText.trim() || addNoteMutation.isPending}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {addNoteMutation.isPending ? 'Saving...' : 'Save Note'}
          </button>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {(!notes || notes.length === 0) && !isAdding && (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-muted-foreground">No notes yet</p>
          </div>
        )}

        {notes?.map((note) => (
          <div
            key={note.note_id}
            className={`rounded-lg border p-4 ${
              note.is_important ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950' : 'border-border'
            }`}
          >
            <div className="flex items-start justify-between">
              <Badge variant={noteTypeColors[note.note_type] || 'gray'}>
                {note.note_type.replace(/_/g, ' ')}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(note.created_at)}
              </span>
            </div>
            <p className="mt-2 text-sm text-foreground">{note.note_text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
