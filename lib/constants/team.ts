// Split out of lib/actions/team.ts — a "use server" file may only export
// async functions (Next.js enforces this), so a plain data constant like
// this can't live there even though it's conceptually part of that module.
// Importing it as a value from a "use server" file (as RejectMemberModal.tsx
// needs to, to populate the reject-reason dropdown) crashes at runtime with
// "A 'use server' file can only export async functions, found object."
export const REJECT_REASONS = ["Wrong branch", "Duplicate account", "Invalid invitation", "Other"] as const;
