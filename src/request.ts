import type { AsyncAPIDocumentInterface } from "@asyncapi/parser";

import {
  MissingBindingError,
  MissingChannelError,
  MissingExampleError,
  UnknownOperationError,
} from "./errors.js";
import {
  resolveRawObjectSchema,
  resolveSchemaField,
  type RawObjectSchema,
} from "./helpers/schema-value.js";

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
export function buildRequest(document: AsyncAPIDocumentInterface, operationId: string): Request {
  const operation = document.operations().get(operationId);
  if (!operation) {
    throw new UnknownOperationError(operationId);
  }

  const channels = [...operation.channels()];
  const channel = channels[0];
  if (!channel) {
    throw new MissingChannelError(operationId);
  }

  const wsBinding = channel.bindings().get("ws");
  if (!wsBinding) {
    throw new MissingBindingError(operationId);
  }
  const bindingValue = wsBinding.value() as { query?: RawObjectSchema; headers?: RawObjectSchema };

  const placeholders: string[] = [];

  const query = resolveRawObjectSchema(bindingValue.query);
  const headers = resolveRawObjectSchema(bindingValue.headers);
  placeholders.push(...query.placeholders.map((name) => `query param "${name}"`));
  placeholders.push(...headers.placeholders.map((name) => `header "${name}"`));

  let channelAddress = channel.address() ?? "";
  for (const param of channel.parameters()) {
    const resolved = resolveSchemaField(param.schema(), param.id());
    channelAddress = channelAddress.replace(`{${param.id()}}`, resolved.value);
    if (resolved.isPlaceholder) {
      placeholders.push(`channel parameter "${param.id()}"`);
    }
  }

  const servers = [...operation.servers()];
  const server = servers[0];
  const serverUrl = server ? server.url() : "";

  const messages = [...operation.messages()];
  const message = messages[0];
  const examples = message ? [...message.examples()] : [];
  const example = examples[0];

  if (!example) {
    throw new MissingExampleError(operationId);
  }

  return {
    operationId,
    action: operation.isSend() ? "send" : "receive",
    serverUrl,
    channelAddress,
    query: query.values,
    headers: headers.values,
    message: {
      name: example.name(),
      payload: example.payload(),
    },
    placeholders,
  };
}
