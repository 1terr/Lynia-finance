'use client';

import { useIsFetching } from '@tanstack/react-query';

/**
 * Shows a thin animated progress bar at the top of the page
 * when React Query is refreshing stale cached data in the background.
 * Users see their cached data immediately while this bar indicates an update is in progress.
 */
export function StaleRefreshIndicator() {
  const isFetching = useIsFetching();

  if (!isFetching) return null;

  return (
    <div className="stale-refresh-bar" role="progressbar" aria-label="Refreshing data" />
  );
}
