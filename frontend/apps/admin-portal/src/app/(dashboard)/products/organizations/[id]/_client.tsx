'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrganization, updateOrganization, getMembers, importMembers } from '@/lib/api/products';
import { OrganizationForm } from '@/components/products/organization-form';
import { MemberImportModal } from '@/components/products/member-import-modal';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { maskPhone, formatDate } from '@lynia/utils';
import { ArrowLeft, Pencil, Upload } from 'lucide-react';
import type { OrganizationMember, CreateOrganizationInput, MemberImportInput, MemberImportResult } from '@/types';

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

export default function OrganizationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [memberPage, setMemberPage] = useState(1);

  const { data: org, isLoading: loadingOrg } = useQuery({
    queryKey: ['organization', id],
    queryFn: () => getOrganization(id),
  });

  const { data: membersData, isLoading: loadingMembers } = useQuery({
    queryKey: ['org-members', id, memberPage],
    queryFn: () => getMembers(id, { page: memberPage, limit: 25 }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreateOrganizationInput>) => updateOrganization(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', id] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });

  async function handleImport(members: MemberImportInput[]): Promise<MemberImportResult> {
    const result = await importMembers(id, members, 'csv_upload');
    queryClient.invalidateQueries({ queryKey: ['org-members', id] });
    queryClient.invalidateQueries({ queryKey: ['organization', id] });
    return result;
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
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-48 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-96 animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/products/organizations')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Organizations
        </Button>
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <p className="text-gray-500">Organization not found.</p>
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
            <h1 className="text-2xl font-bold text-gray-900">{org.org_name}</h1>
            <Badge variant={ORG_TYPE_VARIANTS[org.org_type] || 'gray'}>
              {org.org_type.charAt(0).toUpperCase() + org.org_type.slice(1)}
            </Badge>
            <Badge variant={org.is_active ? 'green' : 'gray'}>
              {org.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-sm font-mono text-gray-500">{org.org_code}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
          </Button>
          <Button size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-3.5 w-3.5" /> Import CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-4 text-center">
          <p className="text-sm text-gray-500">Trust Level</p>
          <p className="text-2xl font-bold">{org.scoring_trust_level}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-sm text-gray-500">Total Members</p>
          <p className="text-2xl font-bold">{org.member_count ?? org.total_members}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-sm text-gray-500">Verification</p>
          <p className="text-lg font-semibold capitalize">{org.verification_method.replace(/_/g, ' ')}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-sm text-gray-500">Last Import</p>
          <p className="text-lg font-semibold">{org.last_data_import_at ? formatDate(org.last_data_import_at) : 'Never'}</p>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Members</h2>
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

      <OrganizationForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={async (d) => { await updateMutation.mutateAsync(d); }}
        organization={org}
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
