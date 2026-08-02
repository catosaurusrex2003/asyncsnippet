import type { AsyncApiDocument } from "./asyncapi-types.js";
import type { CodeBuilderOptions } from "./helpers/code-builder.js";

import { UnsupportedTargetError } from "./errors.js";
import { buildRequest } from "./request.js";
import { targets } from "./targets/index.js";

export type { AsyncApiDocument } from "./asyncapi-types.js";
export type { Request } from "./request.js";
export * from "./errors.js";

export type Options = CodeBuilderOptions;

export class AsyncSnippet {
  private readonly document: AsyncApiDocument;

  /** `document` must already be a valid, parsed AsyncAPI 3.x document (a plain object, e.g. from `js-yaml`/`JSON.parse`) — this library does not parse or validate it. */
  constructor(document: AsyncApiDocument) {
    this.document = document;
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
