'use client';

import { OrganizationWizard } from '@/components/products/organization-wizard';

export default function NewOrganizationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Create Organization</h1>
        <p className="text-sm text-muted-foreground">
          Set up a new partner organization for digital loan verification.
        </p>
      </div>
      <OrganizationWizard />
    </div>
  );
}
