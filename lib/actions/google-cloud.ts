"use server";

import { getGoogleCloudStatus as getGoogleCloudStatusInternal, type GoogleCloudStatus } from "@/lib/google-cloud/storage";

// Thin Server Action wrapper — lib/google-cloud/storage.ts has `import
// "server-only"`, which blocks it from being imported into any client
// bundle at all, even indirectly. Components.app.Topbar (the header icon)
// is a client component, so it needs an actual Server Action boundary
// (this file, "use server") rather than importing that module directly,
// unlike the Dashboard/Integrations pages which are Server Components and
// can call it straight.
//
// Deliberately no `export type { GoogleCloudStatus }` here — a "use server"
// file's compiler transform treats every export as a server action
// reference, including type-only ones, which crashed every page importing
// this with "ReferenceError: GoogleCloudStatus is not defined" at module
// evaluation. Import the type directly from lib/google-cloud/storage.ts
// instead (a bare `import type` is erased at compile time, so it's exempt
// from that module's `server-only` guard).
export async function getGoogleCloudStatusAction(): Promise<GoogleCloudStatus> {
  return getGoogleCloudStatusInternal();
}
