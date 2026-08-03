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

  /** AsyncAPI channel binding this request was normalized for, e.g. `"ws"` or `"kafka"`. */
  protocol: string;

  /** Resolved server URL, e.g. `wss://chat.example.com`. First entry in the document's `servers` map — see design doc's default server-selection rule. */
  serverUrl: string;

  /** Raw `server.host`, with no protocol scheme prefix — e.g. a Kafka broker list (`broker1:9092,broker2:9092`). Clients that need a broker list (rather than a URL) should split this, not `serverUrl`. */
  serverHost: string;

  /** Channel address with `{param}` placeholders substituted using the literal-value resolution rule. For `ws`, this is a URL path; for `kafka`, this is the topic name (after any `bindings.kafka.topic` override). */
  channelAddress: string;

  query: Record<string, string>;
  headers: Record<string, string>;

  message: {
    name?: string;
    payload: unknown;
  };

  /** Fields that couldn't be resolved from `default`/`examples` and were filled with a `<placeholder>` — surfaced as a comment in generated snippets. */
  placeholders: string[];

  /** Present only when `protocol === "kafka"`. `key` is omitted (stays `undefined`) if the message declares no `kafka.key` binding at all — unkeyed messages are normal in Kafka. `clientId` is always resolved (placeholder if undeclared). `groupId` is only resolved for `action === "receive"` (consumer-only concept). */
  kafka?: {
    key?: string;
    groupId?: string;
    clientId?: string;
  };
}

/**
 * Normalizes an AsyncAPI 3.x operation into the internal `Request` shape —
 * the AsyncAPI equivalent of httpsnippet's HAR-derived `Request`. `protocol`
 * selects which channel binding (`channel.bindings[protocol]`) is read —
 * pass the target client's `info.protocol`.
 */
export function buildRequest(
  document: AsyncApiDocument,
  operationId: string,
  protocol: string,
): Request {
  const operationOrRef = document.operations?.[operationId];
  const operation = operationOrRef && deref(document, operationOrRef);
  if (!operation) {
    throw new UnknownOperationError(operationId);
  }

  const channel = deref<Channel>(document, operation.channel);
  if (!channel) {
    throw new MissingChannelError(operationId);
  }

  const placeholders: string[] = [];

  let query: Record<string, string> = {};
  let headers: Record<string, string> = {};
  let kafkaTopicOverride: string | undefined;

  if (protocol === "ws") {
    const wsBinding = channel.bindings?.ws;
    if (!wsBinding) {
      throw new MissingBindingError(operationId, protocol);
    }

    const resolvedQuery = resolveRawObjectSchema(wsBinding.query);
    const resolvedHeaders = resolveRawObjectSchema(wsBinding.headers);
    query = resolvedQuery.values;
    headers = resolvedHeaders.values;
    placeholders.push(...resolvedQuery.placeholders.map((name) => `query param "${name}"`));
    placeholders.push(...resolvedHeaders.placeholders.map((name) => `header "${name}"`));
  } else if (protocol === "kafka") {
    const kafkaBinding = channel.bindings?.kafka;
    if (!kafkaBinding) {
      throw new MissingBindingError(operationId, protocol);
    }

    kafkaTopicOverride = kafkaBinding.topic;
  } else {
    throw new MissingBindingError(operationId, protocol);
  }

  let channelAddress = channel.address ?? "";
  for (const [paramId, param] of Object.entries(channel.parameters ?? {})) {
    const resolved = resolveSchemaField(param, paramId);
    channelAddress = channelAddress.replace(`{${paramId}}`, resolved.value);
    if (resolved.isPlaceholder) {
      placeholders.push(`channel parameter "${paramId}"`);
    }
  }

  if (protocol === "kafka" && kafkaTopicOverride) {
    channelAddress = kafkaTopicOverride;
  }

  const serverRefs = operation.servers ?? channel.servers;
  const server = serverRefs
    ? deref<Server>(document, serverRefs[0])
    : deref<Server>(document, Object.values(document.servers ?? {})[0]);
  const serverUrl = server ? `${server.protocol}://${server.host}${server.pathname ?? ""}` : "";
  const serverHost = server?.host ?? "";

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

  const action = operation.action === "send" ? "send" : "receive";

  let kafka: Request["kafka"];
  if (protocol === "kafka") {
    const keyBinding = message?.bindings?.kafka?.key;
    const key = keyBinding ? resolveSchemaField(keyBinding, "kafka message key") : undefined;
    if (key?.isPlaceholder) {
      placeholders.push("kafka message key");
    }

    const clientId = resolveSchemaField(operation.bindings?.kafka?.clientId, "kafka clientId");
    if (clientId.isPlaceholder) {
      placeholders.push("kafka clientId");
    }

    let groupId: { value: string; isPlaceholder: boolean } | undefined;
    if (action === "receive") {
      groupId = resolveSchemaField(operation.bindings?.kafka?.groupId, "kafka consumer group id");
      if (groupId.isPlaceholder) {
        placeholders.push("kafka consumer group id");
      }
    }

    kafka = {
      key: key?.value,
      groupId: groupId?.value,
      clientId: clientId.value,
    };
  }

  return {
    operationId,
    action,
    protocol,
    serverUrl,
    serverHost,
    channelAddress,
    query,
    headers,
    message: {
      name: example.name,
      payload: example.payload,
    },
    placeholders,
    ...(kafka ? { kafka } : {}),
  };
}
