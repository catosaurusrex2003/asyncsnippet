import type { AsyncApiDocument, Ref } from "../asyncapi-types.js";

import { deref } from "./deref.js";

const MAX_DEPTH = 10;

function isRef(value: unknown): value is Ref {
  return typeof value === "object" && value !== null && typeof (value as Ref).$ref === "string";
}

/**
 * Recursively walks a JSON Schema (or any nested value) resolving every
 * `$ref` node against `document`, so the result is safe to serialize
 * directly — no dangling pointers — for embedding a schema in full inside
 * generated documentation (as opposed to `generateExampleFromSchema`, which
 * walks the same kind of tree to synthesize a single example value instead).
 * Guards against cycles with the same depth limit as `deref`.
 */
export function resolveSchemaDeep(document: AsyncApiDocument, value: unknown, depth = 0): unknown {
  if (depth >= MAX_DEPTH || value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveSchemaDeep(document, item, depth + 1));
  }
  if (isRef(value)) {
    return resolveSchemaDeep(document, deref(document, value), depth + 1);
  }
  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    result[key] = resolveSchemaDeep(document, nested, depth + 1);
  }
  return result;
}
