// One-off connectivity check for the Google Cloud Storage setup used by
// lib/google-cloud/storage.ts. Talks to @google-cloud/storage directly
// (rather than importing the lib/google-cloud/* modules, which are
// guarded with `server-only` and can only run inside Next's server
// runtime) — writes a tiny object, reads it back via a signed URL, then
// deletes it. Run with `npm run gcs:health` once GOOGLE_CLOUD_PROJECT_ID /
// GOOGLE_CLOUD_STORAGE_BUCKET / GOOGLE_APPLICATION_CREDENTIALS are set in
// .env.local, to confirm the bucket + service account are wired up
// correctly before any real feature depends on it.
import "dotenv/config";

import { Storage } from "@google-cloud/storage";

async function main() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!projectId || !bucketName || !credentialsPath) {
    console.error(
      "Not configured. Set GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_STORAGE_BUCKET, and GOOGLE_APPLICATION_CREDENTIALS in .env.local first.",
    );
    process.exit(1);
  }

  const storage = new Storage({ projectId, keyFilename: credentialsPath });
  const bucket = storage.bucket(bucketName);
  const path = `_health-check/${Date.now()}.txt`;

  console.log(`Uploading ${path} to gs://${bucketName}...`);
  await bucket.file(path).save(Buffer.from("inventra gcs health check"), { contentType: "text/plain", resumable: false });

  console.log("Requesting a signed read URL...");
  const [url] = await bucket.file(path).getSignedUrl({ action: "read", expires: Date.now() + 60 * 1000 });
  console.log(`Signed URL: ${url}`);

  console.log("Cleaning up...");
  await bucket.file(path).delete({ ignoreNotFound: true });

  console.log("OK — bucket and credentials are working.");
}

main().catch((err) => {
  console.error("Health check failed:", err);
  process.exit(1);
});
