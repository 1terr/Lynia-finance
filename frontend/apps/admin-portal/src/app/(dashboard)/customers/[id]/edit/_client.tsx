'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import { fetchCustomerById, updateCustomer } from '@/lib/api/customers';
import { useMutationWithToast } from '@/hooks/use-mutation-with-toast';
import { emailSchema, phoneSchema } from '@/lib/validation/schemas';
import type { Customer } from '@/types/database';

const editCustomerSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  phone_number: phoneSchema,
  email: z.union([z.literal(''), emailSchema]).transform((v) => v || ''),
  whatsapp_number: z.union([z.literal(''), phoneSchema]).transform((v) => v || ''),
  national_id: z.string(),
  date_of_birth: z.string(),
  gender: z.string(),
  province: z.string(),
  city: z.string(),
  address_line_1: z.string(),
  address_line_2: z.string(),
  postal_code: z.string(),
  employment_status: z.string(),
  employment_type: z.string(),
  monthly_income_usd: z.number().nullable(),
});

type EditCustomerForm = z.infer<typeof editCustomerSchema>;

export default function EditCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => fetchCustomerById(customerId),
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<EditCustomerForm>();

  useEffect(() => {
    if (customer) {
      reset({
        first_name: customer.first_name,
        last_name: customer.last_name,
        phone_number: customer.phone_number,
        email: customer.email || '',
        whatsapp_number: customer.whatsapp_number || '',
        national_id: customer.national_id,
        date_of_birth: customer.date_of_birth || '',
        gender: customer.gender || '',
        province: customer.province || '',
        city: customer.city || '',
        address_line_1: customer.address_line_1 || '',
        address_line_2: customer.address_line_2 || '',
        postal_code: customer.postal_code || '',
        employment_status: customer.employment_status || '',
        employment_type: customer.employment_type || '',
        monthly_income_usd: customer.monthly_income_usd,
      });
    }
  }, [customer, reset]);

  const updateMutation = useMutationWithToast({
    mutationFn: (data: EditCustomerForm) => {
      const updates: Partial<Customer> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== '' && value !== null) {
          (updates as any)[key] = value;
        }
      }
      return updateCustomer(customerId, updates);
    },
    successMessage: 'Customer updated successfully',
    errorMessage: 'Failed to update customer',
    invalidateKeys: [['customer', customerId], ['customers']],
    onSuccess: () => router.push(`/dashboard/customers/${customerId}`),
  });

  function onSubmit(data: EditCustomerForm) {
    const result = editCustomerSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof EditCustomerForm;
        setError(field, { message: issue.message });
      }
      return;
    }
    updateMutation.mutate(result.data);
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-500">Loading customer...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-red-500">Customer not found</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/dashboard/customers/${customerId}`}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <svg
            className="mr-1 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Customer
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">
          Edit Customer
        </h1>
        <p className="mt-1 text-gray-600">
          {customer.first_name} {customer.last_name}
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6"
      >
        {/* Personal Information */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Personal Information
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="First Name"
              error={errors.first_name?.message}
            >
              <input
                {...register('first_name')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </FormField>
            <FormField label="Last Name" error={errors.last_name?.message}>
              <input
                {...register('last_name')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </FormField>
            <FormField label="Date of Birth">
              <input
                type="date"
                {...register('date_of_birth')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </FormField>
            <FormField label="Gender">
              <select
                {...register('gender')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </FormField>
            <FormField label="National ID">
              <input
                {...register('national_id')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </FormField>
          </div>
        </div>

        {/* Contact */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Contact Information
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Phone Number" error={errors.phone_number?.message}>
              <input
                {...register('phone_number')}
                placeholder="+263XXXXXXXXX"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </FormField>
            <FormField label="WhatsApp Number" error={errors.whatsapp_number?.message}>
              <input
                {...register('whatsapp_number')}
                placeholder="+263XXXXXXXXX"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </FormField>
            <FormField label="Email" className="col-span-2" error={errors.email?.message}>
              <input
                type="email"
                {...register('email')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </FormField>
          </div>
        </div>

        {/* Address */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Address
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Address Line 1" className="col-span-2">
              <input
                {...register('address_line_1')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </FormField>
            <FormField label="Address Line 2" className="col-span-2">
              <input
                {...register('address_line_2')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </FormField>
            <FormField label="City">
              <input
                {...register('city')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </FormField>
            <FormField label="Province">
              <input
                {...register('province')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </FormField>
            <FormField label="Postal Code">
              <input
                {...register('postal_code')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </FormField>
          </div>
        </div>

        {/* Employment */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Employment
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Employment Status">
              <select
                {...register('employment_status')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">Select</option>
                <option value="employed">Employed</option>
                <option value="self_employed">Self Employed</option>
                <option value="unemployed">Unemployed</option>
                <option value="student">Student</option>
              </select>
            </FormField>
            <FormField label="Employment Type">
              <input
                {...register('employment_type')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </FormField>
            <FormField label="Monthly Income (USD)">
              <input
                type="number"
                step="0.01"
                {...register('monthly_income_usd', { valueAsNumber: true })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </FormField>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link
            href={`/dashboard/customers/${customerId}`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!isDirty || updateMutation.isPending}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {updateMutation.isError && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            Failed to save changes. Please try again.
          </div>
        )}
      </form>
    </div>
  );
}

function FormField({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
