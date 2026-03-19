'use client';

import { useParams, usePathname } from 'next/navigation';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Extract the real route ID from the browser URL.
 *
 * In static export mode, CloudFront rewrites UUID path segments to '_'
 * before serving from S3, so the RSC payload always contains { id: '_' }.
 * This hook recovers the real UUID from the browser pathname.
 */
export function useRouteId(): string {
  const params = useParams();
  const pathname = usePathname();
  const paramId = (params.id ?? '') as string;

  if (paramId && paramId !== '_') return paramId;

  const match = pathname.match(UUID_RE);
  return match ? match[0] : paramId;
}
