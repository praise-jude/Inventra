import "server-only";

import { Storage } from "@google-cloud/storage";

import { getGoogleCloudConfig } from "./config";
import { GoogleCloudStorageError } from "./errors";
import { withRetry } from "./retry";

// New, additive file-storage layer — nothing existing (e.g.
// lib/actions/products.ts's uploadProductImage, which still uses Supabase
// Storage) has been changed to call this. It's available for new call
// sites to opt into once the bucket/credentials are live and this has
// been validated end-to-end.
let cachedClient: Storage | null = null;

function getClient(): Storage {
  if (cachedClient) return cachedClient;
  const config = getGoogleCloudConfig();
  cachedClient = new Storage({ projectId: config.projectId, keyFilename: config.credentialsPath });
  return cachedClient;
}

export interface UploadFileInput {
  /** Object path within the bucket, e.g. `${orgId}/products/${uuid}.jpg`. */
  path: string;
  data: Buffer | Uint8Array;
  contentType: string;
}

export async function uploadFile({ path, data, contentType }: UploadFileInput): Promise<void> {
  const config = getGoogleCloudConfig();
  try {
    const bucket = getClient().bucket(config.bucketName);
    await withRetry(() =>
      bucket.file(path).save(Buffer.from(data), {
        contentType,
        // Bucket is private (uniform access, no public reads) — every
        // read goes through getSignedReadUrl below.
        resumable: false,
      }),
    );
  } catch (err) {
    console.error("[Inventra] uploadFile (Google Cloud Storage) failed:", err);
    throw new GoogleCloudStorageError("Could not upload the file.");
  }
}

// A signed PUT URL the browser can upload directly to — the client sees
// real upload progress via its own XHR progress events, and the payload
// never has to pass through our server at all.
export async function getSignedUploadUrl(
  path: string,
  contentType: string,
  expiresInMinutes = 15,
): Promise<string> {
  const config = getGoogleCloudConfig();
  try {
    const bucket = getClient().bucket(config.bucketName);
    const [url] = await withRetry(() =>
      bucket.file(path).getSignedUrl({
        action: "write",
        expires: Date.now() + expiresInMinutes * 60 * 1000,
        contentType,
      }),
    );
    return url;
  } catch (err) {
    console.error("[Inventra] getSignedUploadUrl (Google Cloud Storage) failed:", err);
    throw new GoogleCloudStorageError("Could not prepare the upload.");
  }
}

export async function getSignedReadUrl(path: string, expiresInMinutes = 15): Promise<string> {
  const config = getGoogleCloudConfig();
  try {
    const bucket = getClient().bucket(config.bucketName);
    const [url] = await withRetry(() =>
      bucket.file(path).getSignedUrl({ action: "read", expires: Date.now() + expiresInMinutes * 60 * 1000 }),
    );
    return url;
  } catch (err) {
    console.error("[Inventra] getSignedReadUrl (Google Cloud Storage) failed:", err);
    throw new GoogleCloudStorageError("Could not access the file.");
  }
}

export async function deleteFile(path: string): Promise<void> {
  const config = getGoogleCloudConfig();
  try {
    const bucket = getClient().bucket(config.bucketName);
    await withRetry(() => bucket.file(path).delete({ ignoreNotFound: true }));
  } catch (err) {
    console.error("[Inventra] deleteFile (Google Cloud Storage) failed:", err);
    throw new GoogleCloudStorageError("Could not delete the file.");
  }
}
