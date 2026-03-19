'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getOrganization } from '@/lib/api/products';
import { OrganizationWizard } from '@/components/products/organization-wizard';

export default function EditOrganizationClient() {
  const { id } = useParams();

  const { data: org, isLoading } = useQuery({
    queryKey: ['organization', id],
    queryFn: () => getOrganization(id as string),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="rounded-lg border border-dashed border-border py-12 text-center">
        <p className="text-muted-foreground">Organization not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Edit Organization</h1>
        <p className="text-sm text-muted-foreground">
          Update {org.org_name} configuration.
        </p>
      </div>
      <OrganizationWizard organization={org} />
    </div>
  );
}
