"use client";

import { useState } from "react";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/actions/api-keys";
import type { ApiKeyRow } from "@/lib/api-keys-service";
import { ALL_API_SCOPES, type ApiScope } from "@/lib/api-scopes";
import { useToast } from "@/components/app/ToastProvider";

const SCOPE_LABELS: Record<ApiScope, string> = {
  "products:read": "Read products",
  "products:write": "Create products",
  "sales:read": "Read sales",
  "sales:write": "Create sales",
  "customers:read": "Read customers",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function ApiKeysClient({ initialKeys }: { initialKeys: ApiKeyRow[] }) {
  const flash = useToast();
  const [keys, setKeys] = useState(initialKeys);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ApiScope[]>([]);
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  function toggleScope(scope: ApiScope) {
    setScopes((s) => (s.includes(scope) ? s.filter((x) => x !== scope) : [...s, scope]));
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const result = await createApiKey(name, scopes);
      setRevealedKey(result.rawKey);
      setName("");
      setScopes([]);
      setShowForm(false);
      setKeys(await listApiKeys());
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not create the API key.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!window.confirm("Revoke this API key? Anything using it will stop working immediately.")) return;
    try {
      await revokeApiKey(id);
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k)));
      flash("API key revoked.");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not revoke this key.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {revealedKey && (
        <div className="rounded-2xl border border-accent bg-accent-weak p-4">
          <div className="mb-1.5 text-[13.5px] font-bold text-accent-text">Your new API key</div>
          <div className="mb-2 text-[12.5px] text-text-2">
            Copy this now — for your security, it won&apos;t be shown again.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-[8px] border border-border bg-surface px-3 py-2 font-mono text-[12.5px]">{revealedKey}</code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(revealedKey);
                flash("Copied to clipboard.");
              }}
              className="h-9 rounded-[8px] bg-accent px-3 text-[12.5px] font-semibold text-white"
            >
              Copy
            </button>
          </div>
          <button onClick={() => setRevealedKey(null)} className="mt-3 text-[12.5px] font-semibold text-text-2">
            Done — I&apos;ve saved it
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between border-b border-border-2 px-5 py-4">
          <div className="text-[13.5px] font-bold">API keys</div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="h-[33px] rounded-[8px] bg-accent px-3 text-[12.5px] font-semibold text-white"
          >
            + New API key
          </button>
        </div>

        {showForm && (
          <div className="flex flex-col gap-3 border-b border-border-2 px-5 py-4">
            <div>
              <label className="mb-1 block text-[11.5px] font-semibold text-muted">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Warehouse sync script"
                className="h-9 w-full rounded-[8px] border border-border bg-surface px-2.5 text-[13px] outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11.5px] font-semibold text-muted">Scopes</label>
              <div className="flex flex-wrap gap-2">
                {ALL_API_SCOPES.map((scope) => (
                  <button
                    key={scope}
                    onClick={() => toggleScope(scope)}
                    className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                      scopes.includes(scope) ? "border-accent bg-accent-weak text-accent-text" : "border-border bg-surface text-text-2"
                    }`}
                  >
                    {SCOPE_LABELS[scope]}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim() || scopes.length === 0}
              className="h-9 w-fit rounded-[8px] bg-accent px-3.5 text-[12.5px] font-semibold text-white disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create key"}
            </button>
          </div>
        )}

        {keys.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-muted">No API keys yet.</div>
        ) : (
          <div className="divide-y divide-border-2">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold">{k.name}</span>
                    {k.revokedAt && <span className="rounded-[6px] bg-red-weak px-1.5 py-px text-[10.5px] font-bold text-red">Revoked</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted">
                    <code className="font-mono">{k.keyPrefix}…</code>
                    <span>{k.scopes.map((s) => SCOPE_LABELS[s]).join(", ")}</span>
                    <span>Created {formatDate(k.createdAt)}</span>
                    <span>Last used {formatDate(k.lastUsedAt)}</span>
                  </div>
                </div>
                {!k.revokedAt && (
                  <button onClick={() => handleRevoke(k.id)} className="flex-shrink-0 text-[12.5px] font-semibold text-red">
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
