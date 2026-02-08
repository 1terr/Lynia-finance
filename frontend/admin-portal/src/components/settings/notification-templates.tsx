'use client';

import { useEffect, useState } from 'react';
import type { NotificationTemplate } from '@/types/settings';
import { fetchNotificationTemplates, updateNotificationTemplate } from '@/lib/api/settings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MessageSquare, Mail, Smartphone, X, Eye, Edit2, Save } from 'lucide-react';

const CHANNEL_ICON: Record<string, React.ElementType> = {
  whatsapp: MessageSquare,
  sms: Smartphone,
  email: Mail,
};

const CHANNEL_COLOR: Record<string, 'success' | 'info' | 'warning'> = {
  whatsapp: 'success',
  sms: 'info',
  email: 'warning',
};

export function NotificationTemplates() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchNotificationTemplates().then((t) => { setTemplates(t); setLoading(false); });
  }, []);

  const startEdit = (tpl: NotificationTemplate) => {
    setEditingId(tpl.id);
    setEditBody(tpl.body);
    setPreviewId(null);
  };

  const handleSave = async (tpl: NotificationTemplate) => {
    setSaving(true);
    const updated = await updateNotificationTemplate(tpl.id, editBody, tpl.is_active);
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setEditingId(null);
    setSaving(false);
  };

  const handleToggleActive = async (tpl: NotificationTemplate) => {
    const updated = await updateNotificationTemplate(tpl.id, tpl.body, !tpl.is_active);
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const renderPreview = (body: string, variables: string[]) => {
    let preview = body;
    const sampleValues: Record<string, string> = {
      customer_name: 'Tinashe Dhliwayo',
      max_loan_amount: '350',
      rejection_reason: 'Blurry ID photo',
      loan_amount: '350',
      weekly_payment: '16.04',
      term_weeks: '24',
      payment_amount: '16.04',
      due_date: '2026-02-10',
      paybill_number: '123456',
      loan_ref: 'LYN-2026-089',
      amount: '16.04',
      remaining_balance: '288.00',
      days_overdue: '5',
      lock_in_hours: '48',
    };
    variables.forEach((v) => {
      preview = preview.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), sampleValues[v] ?? `[${v}]`);
    });
    return preview;
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Notification Templates</h3>
        <p className="text-sm text-muted-foreground">{templates.length} templates across WhatsApp, SMS, and Email</p>
      </div>

      <div className="space-y-4">
        {templates.map((tpl) => {
          const ChannelIcon = CHANNEL_ICON[tpl.channel] ?? MessageSquare;
          const isEditing = editingId === tpl.id;
          const isPreviewing = previewId === tpl.id;

          return (
            <div key={tpl.id} className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <ChannelIcon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{tpl.name}</p>
                      <Badge variant={CHANNEL_COLOR[tpl.channel]}>{tpl.channel}</Badge>
                      <Badge variant={tpl.is_active ? 'success' : 'secondary'}>{tpl.is_active ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Event: {tpl.event}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setPreviewId(isPreviewing ? null : tpl.id)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => isEditing ? setEditingId(null) : startEdit(tpl)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(tpl)}
                    className={tpl.is_active ? 'text-red-600' : 'text-green-600'}
                  >
                    {tpl.is_active ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              </div>

              {tpl.subject && (
                <p className="text-sm mb-2"><span className="font-medium">Subject:</span> {tpl.subject}</p>
              )}

              {isEditing ? (
                <div className="space-y-3">
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {tpl.variables.map((v) => (
                        <button
                          key={v}
                          onClick={() => setEditBody((prev) => prev + `{{${v}}}`)}
                          className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground hover:bg-muted/80"
                        >
                          {`{{${v}}}`}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button size="sm" onClick={() => handleSave(tpl)} disabled={saving}>
                        <Save className="h-4 w-4 mr-1" />{saving ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : isPreviewing ? (
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Preview (sample data):</p>
                  <p className="text-sm whitespace-pre-wrap">{renderPreview(tpl.body, tpl.variables)}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground font-mono whitespace-pre-wrap">{tpl.body}</p>
              )}

              <div className="mt-2 flex flex-wrap gap-1">
                {tpl.variables.map((v) => (
                  <span key={v} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{`{{${v}}}`}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
