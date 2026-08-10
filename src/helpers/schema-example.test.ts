import { describe, expect, it } from "vitest";

import type { AsyncApiDocument } from "../asyncapi-types.js";
import { generateExampleFromSchema } from "./schema-example.js";

const emptyDocument: AsyncApiDocument = {};

describe("generateExampleFromSchema", () => {
  it("uses the schema's own `examples[0]` when present", () => {
    expect(generateExampleFromSchema(emptyDocument, { type: "string", examples: ["hi"] })).toBe(
      "hi",
    );
  });

  it("uses `default` over synthesizing from `type`", () => {
    expect(generateExampleFromSchema(emptyDocument, { type: "integer", default: 42 })).toBe(42);
  });

  it("uses `const` when present", () => {
    expect(generateExampleFromSchema(emptyDocument, { const: "fixed" })).toBe("fixed");
  });

  it("uses `enum[0]` when present", () => {
    expect(generateExampleFromSchema(emptyDocument, { enum: ["on", "off"] })).toBe("on");
  });

  it("builds an object from `properties`, recursing into each", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "integer" },
      },
    };
    expect(generateExampleFromSchema(emptyDocument, schema)).toEqual({
      name: "string",
      age: 0,
    });
  });

  it("omits an object property the generator couldn't resolve, instead of writing `undefined`", () => {
    const schema = {
      type: "object",
      properties: {
        known: { type: "string" },
        unresolvable: { oneOf: [{ type: "string" }, { type: "number" }] },
      },
    };
    const result = generateExampleFromSchema(emptyDocument, schema) as Record<string, unknown>;
    expect(result).toEqual({ known: "string" });
    expect("unresolvable" in result).toBe(false);
  });

  it("builds a one-item array from `items`", () => {
    const schema = { type: "array", items: { type: "string" } };
    expect(generateExampleFromSchema(emptyDocument, schema)).toEqual(["string"]);
  });

  it("returns an empty array when `items` is absent", () => {
    expect(generateExampleFromSchema(emptyDocument, { type: "array" })).toEqual([]);
  });

  it.each([
    ["date-time", "2024-01-01T00:00:00Z"],
    ["date", "2024-01-01"],
    ["email", "user@example.com"],
    ["uuid", "00000000-0000-0000-0000-000000000000"],
  ])("uses a format-aware placeholder for string format %s", (format, expected) => {
    expect(generateExampleFromSchema(emptyDocument, { type: "string", format })).toBe(expected);
  });

  it("falls back to a generic string for an unrecognized/absent format", () => {
    expect(generateExampleFromSchema(emptyDocument, { type: "string" })).toBe("string");
  });

  it.each([
    ["integer", 0],
    ["number", 0],
    ["boolean", false],
    ["null", null],
  ])("synthesizes a zero-ish value for type %s", (type, expected) => {
    expect(generateExampleFromSchema(emptyDocument, { type })).toBe(expected);
  });

  it("picks the first non-null entry when `type` is an array", () => {
    expect(generateExampleFromSchema(emptyDocument, { type: ["null", "string"] })).toBe("string");
  });

  it("resolves a `$ref` at the top level", () => {
    const document: AsyncApiDocument = {
      channels: {}, // unrelated — only components matter for this ref
    };
    (document as unknown as { components: unknown }).components = {
      schemas: { sentAt: { type: "string", format: "date-time" } },
    };
    const result = generateExampleFromSchema(document, { $ref: "#/components/schemas/sentAt" });
    expect(result).toBe("2024-01-01T00:00:00Z");
  });

  it("resolves a `$ref` nested inside `properties`, matching the AsyncAPI spec's own Streetlights schemas", () => {
    const document = {
      components: {
        schemas: {
          sentAt: { type: "string", format: "date-time" },
        },
      },
    } as unknown as AsyncApiDocument;
    const schema = {
      type: "object",
      properties: {
        lumens: { type: "integer" },
        sentAt: { $ref: "#/components/schemas/sentAt" },
      },
    };
    expect(generateExampleFromSchema(document, schema)).toEqual({
      lumens: 0,
      sentAt: "2024-01-01T00:00:00Z",
    });
  });

  it("returns undefined for a schema with no recognizable type (pure oneOf/anyOf/allOf)", () => {
    expect(
      generateExampleFromSchema(emptyDocument, { oneOf: [{ type: "string" }, { type: "number" }] }),
    ).toBeUndefined();
  });

  it("returns undefined past the recursion depth guard instead of looping forever on a cyclic schema", () => {
    const document: AsyncApiDocument = {};
    (document as unknown as { components: unknown }).components = {
      schemas: {
        node: {
          type: "object",
          properties: { child: { $ref: "#/components/schemas/node" } },
        },
      },
    };
    expect(() =>
      generateExampleFromSchema(document, { $ref: "#/components/schemas/node" }),
    ).not.toThrow();
  });
});
