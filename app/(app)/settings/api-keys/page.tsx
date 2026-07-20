import { listApiKeys } from "@/lib/actions/api-keys";
import { ApiKeysClient } from "@/components/settings/ApiKeysClient";

export default async function ApiKeysSettingsPage() {
  const keys = await listApiKeys();

  return (
    <div>
      <div className="mb-4 text-[13px] text-text-2">
        Generate keys to let your own scripts or third-party tools read and write your organization&apos;s data through the{" "}
        <a href="/api/v1/openapi.json" className="font-semibold text-accent-text" target="_blank" rel="noreferrer">
          Inventra Public API
        </a>
        . Each key is shown only once — store it somewhere safe.
      </div>
      <ApiKeysClient initialKeys={keys} />
    </div>
  );
}
