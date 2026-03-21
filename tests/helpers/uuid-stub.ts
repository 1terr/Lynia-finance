/**
 * UUID stub for Jest — avoids ESM parse errors from uuid@13.
 * Provides a deterministic v4() for test reproducibility.
 */

let counter = 0;

export function v4(): string {
  counter++;
  const hex = counter.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
}

export function validate(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
}

export default { v4, validate };
