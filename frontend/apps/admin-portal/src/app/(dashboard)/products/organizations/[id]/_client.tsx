'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getOrganization, updateOrganization, getMembers, importMembers } from '@/lib/api/products';
import { MemberImportModal } from '@/components/products/member-import-modal';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { useMutationWithToast } from '@/hooks/use-mutation-with-toast';
import { maskPhone, formatDate } from '@lynia/utils';
import { ArrowLeft, Pencil, Upload, Search, Power } from 'lucide-react';
import type { OrganizationMember, MemberImportInput, MemberImportResult } from '@/types';

const ORG_TYPE_VARIANTS: Record<string, 'blue' | 'purple' | 'green' | 'yellow'> = {
  government: 'blue',
  corporate: 'purple',
  cooperative: 'green',
  ngo: 'yellow',
};

const EMPLOYMENT_VARIANTS: Record<string, 'green' | 'yellow' | 'red'> = {
  active: 'green',
  retired: 'yellow',
  suspended: 'red',
};

const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'retired', label: 'Retired' },
  { value: 'suspended', label: 'Suspended' },
];

export default function OrganizationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [importOpen, setImportOpen] = useState(false);
  const [confirmToggleOpen, setConfirmToggleOpen] = useState(false);
  const [memberPage, setMemberPage] = useState(1);
  const [memberSearchInput, setMemberSearchInput] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState('');

  const { data: org, isLoading: loadingOrg } = useQuery({
    queryKey: ['organization', id],
    queryFn: () => getOrganization(id),
  });

  const { data: membersData, isLoading: loadingMembers } = useQuery({
    queryKey: ['org-members', id, memberPage, memberSearch, employmentStatus],
    queryFn: () => getMembers(id, {
      page: memberPage,
      limit: 25,
      search: memberSearch || undefined,
      employment_status: employmentStatus || undefined,
    }),
  });

  const toggleActiveMutation = useMutationWithToast({
    mutationFn: (data: { is_active: boolean }) => updateOrganization(id, data),
    successMessage: org?.is_active ? 'Organization deactivated' : 'Organization activated',
    invalidateKeys: [['organization', id], ['organizations']],
    onSuccess: () => setConfirmToggleOpen(false),
  });

  const importMutation = useMutationWithToast<MemberImportResult, { members: MemberImportInput[]; source: string }>({
    mutationFn: ({ members, source }) => importMembers(id, members, source),
    successMessage: 'Members imported successfully',
    invalidateKeys: [['org-members', id], ['organization', id]],
    onSuccess: () => setImportOpen(false),
  });

  async function handleImport(members: MemberImportInput[]): Promise<MemberImportResult> {
    return importMutation.mutateAsync({ members, source: 'csv_upload' });
  }

  function handleMemberSearch(e: React.FormEvent) {
    e.preventDefault();
    setMemberSearch(memberSearchInput);
    setMemberPage(1);
  }

  const memberColumns: Column<OrganizationMember>[] = [
    {
      key: 'employee_number',
      header: 'Emp #',
      render: (row) => <span className="font-mono text-sm">{row.employee_number || '-'}</span>,
    },
    {
      key: 'phone_number',
      header: 'Phone',
      render: (row) => <span className="text-sm">{row.phone_number ? maskPhone(row.phone_number) : '-'}</span>,
    },
    {
      key: 'department',
      header: 'Department',
      render: (row) => row.department || '-',
    },
    {
      key: 'grade_level',
      header: 'Grade',
      render: (row) => row.grade_level || '-',
    },
    {
      key: 'employment_status',
      header: 'Status',
      render: (row) => (
        <Badge variant={EMPLOYMENT_VARIANTS[row.employment_status] || 'gray'}>
          {row.employment_status}
        </Badge>
      ),
    },
    {
      key: 'salary_verified',
      header: 'Salary Verified',
      render: (row) => (
        <Badge variant={row.salary_verified ? 'green' : 'gray'}>
          {row.salary_verified ? 'Yes' : 'No'}
        </Badge>
      ),
    },
  ];

  if (loadingOrg) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/products/organizations')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Organizations
        </Button>
        <div className="rounded-lg border border-dashed border-border py-12 text-center">
          <p className="text-muted-foreground">Organization not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/products/organizations')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{org.org_name}</h1>
            <Badge variant={ORG_TYPE_VARIANTS[org.org_type] || 'gray'}>
              {org.org_type.charAt(0).toUpperCase() + org.org_type.slice(1)}
            </Badge>
            <Badge variant={org.is_active ? 'green' : 'gray'}>
              {org.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-sm font-mono text-muted-foreground">{org.org_code}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={org.is_active ? 'danger' : 'success'}
            size="sm"
            onClick={() => setConfirmToggleOpen(true)}
          >
            <Power className="mr-1 h-3.5 w-3.5" />
            {org.is_active ? 'Deactivate' : 'Activate'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => router.push(`/products/organizations/${id}/edit`)}>
            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
          </Button>
          <Button size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-3.5 w-3.5" /> Import CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-4 text-center">
          <p className="text-sm text-muted-foreground">Trust Level</p>
          <p className="text-2xl font-bold">{org.scoring_trust_level}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-sm text-muted-foreground">Total Members</p>
          <p className="text-2xl font-bold">{org.member_count ?? org.total_members}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-sm text-muted-foreground">Verification</p>
          <p className="text-lg font-semibold capitalize">{org.verification_method.replace(/_/g, ' ')}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-sm text-muted-foreground">Last Import</p>
          <p className="text-lg font-semibold">{org.last_data_import_at ? formatDate(org.last_data_import_at) : 'Never'}</p>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="text-lg font-semibold text-foreground mb-3">Contact Information</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Contact Name</p>
            <p className="text-sm font-medium text-foreground">{org.contact_name || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Contact Phone</p>
            <p className="text-sm font-medium text-foreground">{org.contact_phone || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Contact Email</p>
            <p className="text-sm font-medium text-foreground">{org.contact_email || '-'}</p>
          </div>
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Members</h2>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end mb-4">
          <form onSubmit={handleMemberSearch} className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={memberSearchInput}
              onChange={(e) => setMemberSearchInput(e.target.value)}
              placeholder="Search by employee # or phone..."
              className="block w-full rounded-md border border-border py-2 pl-10 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </form>
          <Select
            options={EMPLOYMENT_STATUS_OPTIONS}
            placeholder="All"
            value={employmentStatus}
            onChange={(e) => { setEmploymentStatus(e.target.value); setMemberPage(1); }}
            className="w-36"
          />
        </div>

        <DataTable
          columns={memberColumns}
          data={membersData?.data || []}
          keyExtractor={(row) => row.id}
          loading={loadingMembers}
          emptyMessage="No members found. Import a CSV file to add members."
        />
        {membersData && membersData.total_pages > 1 && (
          <Pagination
            page={membersData.page}
            totalPages={membersData.total_pages}
            total={membersData.total}
            limit={membersData.limit}
            onPageChange={setMemberPage}
          />
        )}
      </div>

      <ConfirmationDialog
        open={confirmToggleOpen}
        onClose={() => setConfirmToggleOpen(false)}
        onConfirm={() => toggleActiveMutation.mutate({ is_active: !org.is_active })}
        title={org.is_active ? 'Deactivate Organization' : 'Activate Organization'}
        description={
          org.is_active
            ? `Are you sure you want to deactivate "${org.org_name}"? Members will no longer be eligible for loan verification through this organization.`
            : `Are you sure you want to activate "${org.org_name}"? Members will become eligible for loan verification through this organization.`
        }
        confirmLabel={org.is_active ? 'Deactivate' : 'Activate'}
        variant={org.is_active ? 'destructive' : 'info'}
        isLoading={toggleActiveMutation.isPending}
      />

      <MemberImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
        organizationName={org.org_name}
      />
    </div>
  );
}
