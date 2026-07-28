import "server-only";

import { GoogleCloudNotConfiguredError } from "./errors";

export interface GoogleCloudConfig {
  projectId: string;
  bucketName: string;
  credentialsPath: string;
}

export function isGoogleCloudConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLOUD_PROJECT_ID &&
      process.env.GOOGLE_CLOUD_STORAGE_BUCKET &&
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
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
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!projectId || !bucketName || !credentialsPath) {
    throw new GoogleCloudNotConfiguredError();
  }

  return { projectId, bucketName, credentialsPath };
}
