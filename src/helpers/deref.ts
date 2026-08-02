import type { AsyncApiDocument, Ref } from "../asyncapi-types.js";

const MAX_DEPTH = 10;

function isRef(value: unknown): value is Ref {
  return typeof value === "object" && value !== null && typeof (value as Ref).$ref === "string";
}

/** Resolves a local `#/a/b/c` JSON Pointer against the document root. External refs are not supported — the document is expected to already be fully bundled. */
export function resolveRef(document: AsyncApiDocument, ref: string): unknown {
  if (!ref.startsWith("#/")) {
    throw new Error(
      `Unsupported $ref "${ref}": only local refs (starting with "#/") are supported`,
    );
  }

  const segments = ref
    .slice(2)
    .split("/")
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));

  let current: unknown = document;
  for (const segment of segments) {
    if (typeof current !== "object" || current === null) {
      throw new Error(`Cannot resolve $ref "${ref}": no value at "${segment}"`);
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** Resolves `value` if it's a `$ref`, following chained refs, up to a small depth guard. */
export function deref<T>(document: AsyncApiDocument, value: T | Ref | undefined): T | undefined {
  let current: unknown = value;
  for (let depth = 0; isRef(current); depth++) {
    if (depth >= MAX_DEPTH) {
      throw new Error(
        `Exceeded max $ref depth (${MAX_DEPTH}) resolving "${current.$ref}" — possible cycle`,
      );
    }
    current = resolveRef(document, current.$ref);
  }
  return current as T | undefined;
}
