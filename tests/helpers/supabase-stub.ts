/**
 * Stub for @supabase/supabase-js used only for Jest module resolution.
 *
 * All test files that reference @supabase/supabase-js mock it completely
 * via jest.mock(), so this stub is never actually called.  It exists solely
 * so Jest can resolve the import path without the real npm package being
 * installed (the codebase has migrated to services/shared/clients/database.ts).
 *
 * TODO: Remove this once all test files are migrated to mock database.ts
 *       instead of @supabase/supabase-js.
 */
export const createClient = () => {
  throw new Error('supabase-stub: createClient should be mocked in tests');
};
