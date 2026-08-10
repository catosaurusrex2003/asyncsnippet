import type { AsyncApiDocument, Ref, SecurityScheme } from "../asyncapi-types.js";

import { deref } from "./deref.js";

/**
 * Resolves a server's `security` list into fully-dereffed `SecurityScheme`
 * objects (following `$ref`s into `document.components.securitySchemes`).
 * Entries that don't resolve, or resolve to something without a `type`, are
 * dropped rather than thrown — a dangling security ref shouldn't block
 * generation, matching `resolveServers`' recover-not-throw posture in
 * `request.ts`.
 */
export function resolveServerSecurity(
  document: AsyncApiDocument,
  security: Array<SecurityScheme | Ref> | undefined,
): SecurityScheme[] {
  if (!security?.length) {
    return [];
  }
  return security
    .map((entry) => deref<SecurityScheme>(document, entry))
    .filter((scheme): scheme is SecurityScheme => Boolean(scheme?.type));
}
