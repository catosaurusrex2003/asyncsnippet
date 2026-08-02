import type { AsyncApiDocument, Channel, Message, Server } from "./asyncapi-types.js";

import {
  MissingBindingError,
  MissingChannelError,
  MissingExampleError,
  UnknownOperationError,
} from "./errors.js";
import { deref } from "./helpers/deref.js";
import { resolveRawObjectSchema, resolveSchemaField } from "./helpers/schema-value.js";

export interface Request {
  operationId: string;
  action: "send" | "receive";

  /** Resolved server URL, e.g. `wss://chat.example.com`. First entry in the document's `servers` map — see design doc's default server-selection rule. */
  serverUrl: string;

  /** Channel address with `{param}` placeholders substituted using the literal-value resolution rule. */
  channelAddress: string;

  query: Record<string, string>;
  headers: Record<string, string>;

  message: {
    name?: string;
    payload: unknown;
  };

  /** Fields that couldn't be resolved from `default`/`examples` and were filled with a `<placeholder>` — surfaced as a comment in generated snippets. */
  placeholders: string[];
}

/**
 * Normalizes an AsyncAPI 3.x operation into the internal `Request` shape —
 * the AsyncAPI equivalent of httpsnippet's HAR-derived `Request`.
 */
export function buildRequest(document: AsyncApiDocument, operationId: string): Request {
  const operationOrRef = document.operations?.[operationId];
  const operation = operationOrRef && deref(document, operationOrRef);
  if (!operation) {
    throw new UnknownOperationError(operationId);
  }

  const channel = deref<Channel>(document, operation.channel);
  if (!channel) {
    throw new MissingChannelError(operationId);
  }

  const wsBinding = channel.bindings?.ws;
  if (!wsBinding) {
    throw new MissingBindingError(operationId);
  }

  const placeholders: string[] = [];

  const query = resolveRawObjectSchema(wsBinding.query);
  const headers = resolveRawObjectSchema(wsBinding.headers);
  placeholders.push(...query.placeholders.map((name) => `query param "${name}"`));
  placeholders.push(...headers.placeholders.map((name) => `header "${name}"`));

  let channelAddress = channel.address ?? "";
  for (const [paramId, param] of Object.entries(channel.parameters ?? {})) {
    const resolved = resolveSchemaField(param, paramId);
    channelAddress = channelAddress.replace(`{${paramId}}`, resolved.value);
    if (resolved.isPlaceholder) {
      placeholders.push(`channel parameter "${paramId}"`);
    }
  }

  const serverRefs = operation.servers ?? channel.servers;
  const server = serverRefs
    ? deref<Server>(document, serverRefs[0])
    : deref<Server>(document, Object.values(document.servers ?? {})[0]);
  const serverUrl = server ? `${server.protocol}://${server.host}${server.pathname ?? ""}` : "";

  // Operation.messages is optional: omitting it means all channel messages apply
  // (AsyncAPI 3.x). An explicit `[]` means no messages.
  const messages =
    operation.messages !== undefined
      ? operation.messages.map((ref) => deref<Message>(document, ref))
      : Object.values(channel.messages ?? {}).map((msg) => deref<Message>(document, msg));
  const message = messages[0];
  const examples = message?.examples ?? [];
  const example = examples[0];

  if (!example) {
    throw new MissingExampleError(operationId);
  }

  return {
    operationId,
    action: operation.action === "send" ? "send" : "receive",
    serverUrl,
    channelAddress,
    query: query.values,
    headers: headers.values,
    message: {
      name: example.name,
      payload: example.payload,
    },
    placeholders,
  };
}
