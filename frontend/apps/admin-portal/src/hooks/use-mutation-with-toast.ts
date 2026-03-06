'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';

interface UseMutationWithToastOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  successMessage: string;
  errorMessage?: string;
  /** Query keys to invalidate on success */
  invalidateKeys?: string[][];
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
}

export function useMutationWithToast<TData = unknown, TVariables = void>({
  mutationFn,
  successMessage,
  errorMessage,
  invalidateKeys,
  onSuccess,
  onError,
}: UseMutationWithToastOptions<TData, TVariables>) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn,
    onSuccess: (data) => {
      toast({ variant: 'success', title: successMessage });
      if (invalidateKeys) {
        for (const key of invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      }
      onSuccess?.(data);
    },
    onError: (error) => {
      toast({
        variant: 'error',
        title: errorMessage || 'Operation failed',
        description: error.message,
      });
      onError?.(error);
    },
  });
}
