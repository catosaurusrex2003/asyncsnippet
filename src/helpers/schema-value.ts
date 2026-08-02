export interface ResolvedField {
  value: string;
  isPlaceholder: boolean;
}

/**
 * Literal-value resolution rule (see design doc "Success Criteria"): use the
 * schema's `default` if present, else its first `examples` entry, else mark
 * the field as an unresolved placeholder so callers can surface a warning
 * instead of fabricating a value.
 */
function resolveValue(
  defaultValue: unknown,
  examples: unknown[] | undefined,
  placeholderLabel: string,
): ResolvedField {
  if (defaultValue !== undefined) {
    return { value: String(defaultValue), isPlaceholder: false };
  }
  if (examples && examples.length > 0) {
    return { value: String(examples[0]), isPlaceholder: false };
  }
  return { value: `<${placeholderLabel}>`, isPlaceholder: true };
}

/** Resolves a channel parameter's `default`/`examples` (raw AsyncAPI 3.x Parameter Object fields). */
export function resolveSchemaField(
  schema: { default?: unknown; examples?: unknown[] } | undefined,
  label: string,
): ResolvedField {
  if (!schema) {
    return { value: `<${label}>`, isPlaceholder: true };
  }
  return resolveValue(schema.default, schema.examples, label);
}

/** Raw JSON Schema shape as it appears in a binding's `query`/`headers` object (not a parsed model). */
export interface RawObjectSchema {
  properties?: Record<string, { default?: unknown; examples?: unknown[] }>;
}

export interface ResolvedObjectSchema {
  values: Record<string, string>;
  placeholders: string[];
}

/** Resolves every property of a raw `{ type: object, properties: {...} }` binding schema (query/headers). */
export function resolveRawObjectSchema(schema: RawObjectSchema | undefined): ResolvedObjectSchema {
  const values: Record<string, string> = {};
  const placeholders: string[] = [];

  for (const [name, propSchema] of Object.entries(schema?.properties ?? {})) {
    const resolved = resolveValue(propSchema.default, propSchema.examples, name);
    values[name] = resolved.value;
    if (resolved.isPlaceholder) {
      placeholders.push(name);
    }
  }

  return { values, placeholders };
}
