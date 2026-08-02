import type { AsyncAPIDocumentInterface } from "@asyncapi/parser";
import type { CodeBuilderOptions } from "./helpers/code-builder.js";

import { Parser, fromFile, fromURL } from "@asyncapi/parser";

import { InvalidDocumentError, UnsupportedTargetError } from "./errors.js";
import { buildRequest } from "./request.js";
import { targets } from "./targets/index.js";

export type { Request } from "./request.js";
export * from "./errors.js";

export type Options = CodeBuilderOptions;

const parser = new Parser();

async function assertParsed(result: {
  document: AsyncAPIDocumentInterface | undefined;
  diagnostics: { message: string }[];
}) {
  if (!result.document) {
    throw new InvalidDocumentError(result.diagnostics.map((d) => d.message));
  }
  return result.document;
}

export class AsyncSnippet {
  private readonly document: AsyncAPIDocumentInterface;

  constructor(document: AsyncAPIDocumentInterface) {
    this.document = document;
  }

  static async fromFile(path: string): Promise<AsyncSnippet> {
    const result = await fromFile(parser, path).parse();
    return new AsyncSnippet(await assertParsed(result));
  }

  static async fromURL(url: string): Promise<AsyncSnippet> {
    const result = await fromURL(parser, url).parse();
    return new AsyncSnippet(await assertParsed(result));
  }

  static async fromString(source: string): Promise<AsyncSnippet> {
    const result = await parser.parse(source);
    return new AsyncSnippet(await assertParsed(result));
  }

  /**
   * Generates a code snippet for a single AsyncAPI operation.
   *
   * v1 only supports `targetId: "javascript"`, `clientId: "ws"` (see design
   * doc's "targetId/clientId validation" — the four-argument signature is
   * forward-compatible with a future target/client plugin registry, but v1
   * is a hardcoded single path, not an extensible registry).
   */
  convert(operationId: string, targetId: string, clientId: string, options: Options = {}): string {
    const target = targets[targetId];
    const client = target?.clientsById[clientId];
    if (!client) {
      throw new UnsupportedTargetError(targetId, clientId);
    }

    const request = buildRequest(this.document, operationId);
    return client.convert(request, options);
  }
}
