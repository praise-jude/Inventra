// Manually maintained release manifest for the public /download page.
// Update this (newest entry first) whenever a new preview-profile EAS
// build is cut for public distribution — see royal-inventra/eas.json's
// "preview" profile (internal distribution, outputs a directly-installable
// .apk, unlike "production" which builds a Play-Store-only .aab).
export interface AppRelease {
  version: string;
  versionCode: number;
  apkUrl: string;
  releasedAt: string; // ISO date
  fileSizeMb: number;
  minAndroidVersion: string;
  releaseNotes: string[];
}

export const APP_RELEASES: AppRelease[] = [
  {
    version: "1.0.0",
    versionCode: 8,
    apkUrl: "https://expo.dev/artifacts/eas/ONEF8rlyLkxcAM4NPpDqRagFkQYCNHz1TIpHOGSYOw0.apk",
    releasedAt: "2026-08-01",
    fileSizeMb: 138,
    minAndroidVersion: "7.0",
    releaseNotes: ["Supply Records: record supplier deliveries with automatic stock updates", "Manager approval workflow scoped to the invitee's branch", "Faster dashboard loading"],
  },
];

export function getLatestRelease(): AppRelease {
  return APP_RELEASES[0];
}
