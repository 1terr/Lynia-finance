/**
 * Sanitize search input to prevent PostgREST filter injection.
 *
 * Strips characters that have special meaning in PostgREST filter syntax:
 * - . (dot) - field path navigation
 * - , (comma) - array elements
 * - ( ) (parentheses) - function calls
 * - \ (backslash) - escape character
 *
 * @example
 * sanitizeSearchInput('test,value') // 'test value'
 */
export function sanitizeSearchInput(search: string): string {
  return search.replace(/[.,()\\]/g, '').trim();
}
