"use server";

import { getGoogleCloudStatus as getGoogleCloudStatusInternal, type GoogleCloudStatus } from "@/lib/google-cloud/storage";

export type { GoogleCloudStatus };

// Thin Server Action wrapper — lib/google-cloud/storage.ts has `import
// "server-only"`, which blocks it from being imported into any client
// bundle at all, even indirectly. Components.app.Topbar (the header icon)
// is a client component, so it needs an actual Server Action boundary
// (this file, "use server") rather than importing that module directly,
// unlike the Dashboard/Integrations pages which are Server Components and
// can call it straight.
export async function getGoogleCloudStatusAction(): Promise<GoogleCloudStatus> {
  return getGoogleCloudStatusInternal();
}
