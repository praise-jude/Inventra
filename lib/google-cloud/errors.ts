// Mirrors lib/entitlements.ts's UpgradeRequiredError pattern — a distinct
// error class per failure mode so callers can tell "not configured yet"
// (expected during rollout) apart from "configured but the call failed"
// (a real runtime problem worth logging/alerting on).
export class GoogleCloudNotConfiguredError extends Error {
  constructor(
    message = "Google Cloud Storage is not configured. Set GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_STORAGE_BUCKET, and either GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_CLOUD_CREDENTIALS_JSON.",
  ) {
    super(message);
    this.name = "GoogleCloudNotConfiguredError";
  }
}

export class GoogleCloudStorageError extends Error {
  constructor(message = "Could not complete the file storage operation. Please try again.") {
    super(message);
    this.name = "GoogleCloudStorageError";
  }
}
