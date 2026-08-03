import type { AsyncApiDocument } from "./asyncapi-types.js";
import type { CodeBuilderOptions } from "./helpers/code-builder.js";

import { UnsupportedTargetError } from "./errors.js";
import { buildRequest } from "./request.js";
import { addTarget, addTargetClient, targets } from "./targets/index.js";

export type { AsyncApiDocument } from "./asyncapi-types.js";
export type { Request } from "./request.js";
export type { Client, ClientInfo, Target } from "./targets/index.js";
export * from "./errors.js";
export { addTarget, addTargetClient };

export type Options = CodeBuilderOptions;

export class AsyncSnippet {
  private readonly document: AsyncApiDocument;

  /** `document` must already be a valid, parsed AsyncAPI 3.x document (a plain object, e.g. from `js-yaml`/`JSON.parse`) — this library does not parse or validate it. */
  constructor(document: AsyncApiDocument) {
    this.document = document;
  }

  /**
   * Generates a code snippet for a single AsyncAPI operation. `targetId`/
   * `clientId` are looked up in the target/client registry — see
   * `addTarget`/`addTargetClient` for registering your own.
   */
  convert(operationId: string, targetId: string, clientId: string, options: Options = {}): string {
    const target = targets[targetId];
    const client = target?.clientsById[clientId];
    if (!client) {
      const available = Object.values(targets).flatMap((t) =>
        Object.keys(t.clientsById).map((c) => `${t.info.key}/${c}`),
      );
      throw new UnsupportedTargetError(targetId, clientId, available);
    }

    const request = buildRequest(this.document, operationId);
    return client.convert(request, options);
  }
}
