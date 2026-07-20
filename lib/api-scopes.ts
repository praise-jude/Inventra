// Split out from lib/api-auth.ts (which is `server-only`) so client
// components — e.g. components/settings/ApiKeysClient.tsx's scope
// checkboxes — can import these plain constants without pulling in a
// server-only module, which breaks the build entirely rather than just
// warning (Next.js throws on any client-reachable import of a
// "server-only" file, even for just a type/const).
export type ApiScope = "products:read" | "products:write" | "sales:read" | "sales:write" | "customers:read";
export const ALL_API_SCOPES: ApiScope[] = ["products:read", "products:write", "sales:read", "sales:write", "customers:read"];
