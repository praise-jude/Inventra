import "server-only";
import crypto from "node:crypto";
import { hashApiKey, type ApiScope } from "@/lib/api-auth";

export interface GeneratedApiKey {
  raw: string;
  prefix: string;
  hash: string;
}

// inv_live_<48 hex chars> — shown to the user exactly once, at creation.
// Only key_hash (one-way) and key_prefix (first 16 chars, non-secret) are
// ever persisted; there is no way to recover the raw key after this point,
// same as GitHub personal access tokens.
export function generateApiKey(): GeneratedApiKey {
  const random = crypto.randomBytes(24).toString("hex");
  const raw = `inv_live_${random}`;
  return { raw, prefix: raw.slice(0, 16), hash: hashApiKey(raw) };
}

export interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: ApiScope[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}
