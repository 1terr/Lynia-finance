'use client';

import { useState, useRef } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { maskPhone, maskId } from '@lynia/utils';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';
import type { MemberImportInput, MemberImportResult } from '@/types';

interface MemberImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (members: MemberImportInput[]) => Promise<MemberImportResult>;
  organizationName: string;
}

const REQUIRED_COLUMNS = ['national_id', 'phone_number', 'employee_number', 'employment_status'];
const ALL_COLUMNS = [...REQUIRED_COLUMNS, 'department', 'grade_level', 'monthly_salary_usd', 'employment_start_date'];

interface ParsedRow {
  [key: string]: string;
}

export function MemberImportModal({ open, onClose, onImport, organizationName }: MemberImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<MemberImportResult | null>(null);

  function resetState() {
    setParsedRows([]);
    setHeaders([]);
    setMissingColumns([]);
    setParseError('');
    setImporting(false);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setResult(null);
    setParseError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setParseError('Only CSV files are supported.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) {
          setParseError('CSV must have a header row and at least one data row.');
          return;
        }

        const headerLine = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
        setHeaders(headerLine);

        const missing = REQUIRED_COLUMNS.filter((col) => !headerLine.includes(col));
        setMissingColumns(missing);

        if (missing.length > 0) {
          setParsedRows([]);
          return;
        }

        const rows: ParsedRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          if (values.length !== headerLine.length) continue;
          const row: ParsedRow = {};
          headerLine.forEach((h, idx) => {
            row[h] = values[idx];
          });
          rows.push(row);
        }
        setParsedRows(rows);
      } catch {
        setParseError('Failed to parse CSV file.');
      }
    };
    reader.readAsText(file);
  }

  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  async function handleImport() {
    if (parsedRows.length === 0) return;
    setImporting(true);
    try {
      const members: MemberImportInput[] = parsedRows.map((row) => ({
        national_id: row.national_id || undefined,
        phone_number: row.phone_number || undefined,
        employee_number: row.employee_number || undefined,
        employment_status: (row.employment_status as MemberImportInput['employment_status']) || undefined,
        employment_start_date: row.employment_start_date || undefined,
        department: row.department || undefined,
        grade_level: row.grade_level || undefined,
        monthly_salary_usd: row.monthly_salary_usd ? parseFloat(row.monthly_salary_usd) : undefined,
        salary_verified: row.salary_verified === 'true',
      }));
      const importResult = await onImport(members);
      setResult(importResult);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  function handleClose() {
    resetState();
    onClose();
  }

  const previewRows = parsedRows.slice(0, 5);

  return (
    <Modal open={open} onClose={handleClose} title={`Import Members - ${organizationName}`} size="xl">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Import Complete</span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950 p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{result.inserted}</p>
                <p className="text-xs text-muted-foreground">Inserted</p>
              </div>
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950 p-3 text-center">
                <p className="text-2xl font-bold text-yellow-700">{result.skipped}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{result.errors}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Upload CSV File</label>
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-gray-400 hover:bg-accent">
                  <Upload className="h-4 w-4" />
                  <span>Choose CSV file</span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                {parsedRows.length > 0 && (
                  <span className="text-sm text-muted-foreground">{parsedRows.length} rows found</span>
                )}
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Required columns:</p>
              <div className="flex flex-wrap gap-1">
                {ALL_COLUMNS.map((col) => (
                  <Badge key={col} variant={REQUIRED_COLUMNS.includes(col) ? 'blue' : 'gray'}>
                    {col}{REQUIRED_COLUMNS.includes(col) ? ' *' : ''}
                  </Badge>
                ))}
              </div>
            </div>

            {parseError && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {parseError}
              </div>
            )}

            {missingColumns.length > 0 && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Missing required columns: {missingColumns.join(', ')}
              </div>
            )}

            {previewRows.length > 0 && missingColumns.length === 0 && (
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Preview (first {previewRows.length} rows)</p>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="min-w-full divide-y divide-border text-xs">
                    <thead className="bg-muted">
                      <tr>
                        {headers.filter((h) => ALL_COLUMNS.includes(h)).map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-medium uppercase text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {previewRows.map((row, i) => (
                        <tr key={i}>
                          {headers.filter((h) => ALL_COLUMNS.includes(h)).map((h) => (
                            <td key={h} className="px-3 py-2 text-foreground">
                              {h === 'phone_number' ? maskPhone(row[h] || '') :
                               h === 'national_id' ? maskId(row[h] || '') :
                               row[h] || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <Button variant="secondary" type="button" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={handleImport}
                disabled={parsedRows.length === 0 || missingColumns.length > 0}
                isLoading={importing}
              >
                Import {parsedRows.length} rows
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
