import type { AsyncApiDocument, Ref } from "../asyncapi-types.js";
import { deref } from "./deref.js";

/** Minimal, partial JSON Schema shape — only the keywords this generator
 * actually reads. Composition keywords (`oneOf`/`anyOf`/`allOf`/`not`) are
 * deliberately unhandled in v1: resolving them into a single representative
 * value requires picking a branch (or merging several), which is more schema
 * modeling than a code-sample generator should take on. A schema built
 * entirely from those keywords, with no plain `type`/`enum`/`const` either,
 * generates `null` rather than guessing. */
interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, unknown>;
  items?: unknown;
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  examples?: unknown[];
  format?: string;
}

const MAX_DEPTH = 10;

function exampleForFormat(format: string | undefined): string {
  switch (format) {
    case "date-time":
      return "2024-01-01T00:00:00Z";
    case "date":
      return "2024-01-01";
    case "time":
      return "00:00:00Z";
    case "email":
      return "user@example.com";
    case "uuid":
      return "00000000-0000-0000-0000-000000000000";
    case "uri":
    case "url":
      return "https://example.com";
    case "hostname":
      return "example.com";
    case "ipv4":
      return "192.0.2.1";
    case "ipv6":
      return "::1";
    default:
      return "string";
  }
}

/** First declared type when `type` is an array (JSON Schema allows e.g.
 * `["string", "null"]`) — picks the first non-`"null"` entry so a nullable
 * field still generates a representative value instead of `null`. */
function primaryType(type: string | string[] | undefined): string | undefined {
  if (Array.isArray(type)) {
    return type.find((t) => t !== "null") ?? type[0];
  }
  return type;
}

/**
 * Generates a representative example value from a raw JSON Schema object —
 * the fallback used when an AsyncAPI message declares no explicit
 * `examples` entry. Resolution order per node: `examples[0]`, then
 * `default`, then `const`, then `enum[0]`, then a type-driven synthesis
 * (recursing into `properties`/`items`, a format-aware string, a zero-ish
 * primitive). `$ref`s are resolved against `document` at every level, since
 * payload schemas commonly `$ref` shared component schemas (as in the
 * AsyncAPI spec's own Streetlights examples).
 *
 * Returns `undefined` for a node this generator can't produce a value for
 * (no recognized `type`, purely composition-keyword schemas, or the depth
 * guard) — callers should treat that as "couldn't generate", not `null`
 * (`null` is a legitimate generated value for `type: "null"`).
 */
export function generateExampleFromSchema(
  document: AsyncApiDocument,
  schema: unknown,
  depth = 0,
): unknown {
  if (depth > MAX_DEPTH) {
    return undefined;
  }

  const resolved = deref<JsonSchema | Ref>(document, schema as JsonSchema | Ref | undefined);
  if (!resolved || typeof resolved !== "object") {
    return undefined;
  }
  const node = resolved as JsonSchema;

  if (node.examples && node.examples.length > 0) {
    return node.examples[0];
  }
  if (node.default !== undefined) {
    return node.default;
  }
  if (node.const !== undefined) {
    return node.const;
  }
  if (node.enum && node.enum.length > 0) {
    return node.enum[0];
  }

  switch (primaryType(node.type)) {
    case "object": {
      const result: Record<string, unknown> = {};
      for (const [key, propSchema] of Object.entries(node.properties ?? {})) {
        const value = generateExampleFromSchema(document, propSchema, depth + 1);
        if (value !== undefined) {
          result[key] = value;
        }
      }
      return result;
    }
    case "array": {
      if (node.items === undefined) {
        return [];
      }
      const item = generateExampleFromSchema(document, node.items, depth + 1);
      return item !== undefined ? [item] : [];
    }
    case "string":
      return exampleForFormat(node.format);
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return false;
    case "null":
      return null;
    default:
      // No `type` (or one we don't recognize, e.g. left entirely to
      // oneOf/anyOf/allOf) — nothing to synthesize from.
      return undefined;
  }
}
