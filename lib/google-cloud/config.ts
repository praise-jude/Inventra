import "server-only";

import { GoogleCloudNotConfiguredError } from "./errors";

export interface GoogleCloudConfig {
  projectId: string;
  bucketName: string;
  // Exactly one of these — a file path for local dev (GOOGLE_APPLICATION_CREDENTIALS,
  // the SDK's own convention) or an inline JSON blob for serverless prod
  // (GOOGLE_CLOUD_CREDENTIALS_JSON), where Vercel's read-only/ephemeral
  // filesystem means there's no committed file to point a path at.
  auth: { keyFilename: string } | { credentials: object };
}

export function isGoogleCloudConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLOUD_PROJECT_ID &&
      process.env.GOOGLE_CLOUD_STORAGE_BUCKET &&
      (process.env.GOOGLE_CLOUD_CREDENTIALS_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS),
  );
}

// Validated lazily, on first real use, rather than at app boot — mirrors
// how RESEND_API_KEY/PAYSTACK keys are optional elsewhere in lib/, so an
// unconfigured Google Cloud integration can never crash startup or any
// existing feature. Callers that want to fail fast should call
// isGoogleCloudConfigured() themselves before entering a code path that
// depends on it.
export function getGoogleCloudConfig(): GoogleCloudConfig {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
  const credentialsJson = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!projectId || !bucketName || !(credentialsJson || credentialsPath)) {
    throw new GoogleCloudNotConfiguredError();
  }

  // JSON blob takes priority — that's the prod/Vercel path, and prod
  // shouldn't silently fall back to a dev-only file path if both happen to
  // be set.
  if (credentialsJson) {
    let credentials: object;
    try {
      credentials = JSON.parse(credentialsJson);
    } catch {
      throw new GoogleCloudNotConfiguredError(
        "GOOGLE_CLOUD_CREDENTIALS_JSON is not valid JSON — paste the full service account key file contents as a single-line value.",
      );
    }
    return { projectId, bucketName, auth: { credentials } };
  }

  return { projectId, bucketName, auth: { keyFilename: credentialsPath! } };
}
