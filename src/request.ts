import type {
  AsyncApiDocument,
  Channel,
  Message,
  Operation,
  Ref,
  Server,
} from "./asyncapi-types.js";

import {
  MissingBindingError,
  MissingChannelError,
  MissingExampleError,
  UnknownOperationError,
} from "./errors.js";
import { deref } from "./helpers/deref.js";
import { generateExampleFromSchema } from "./helpers/schema-example.js";
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

/** Maps a document-declared `server.protocol` to the base protocol family a
 * client is registered under (`client.info.protocol`) — secure-transport
 * variants collapse to their base, since they carry the same channel
 * semantics (`kafka-secure` is still Kafka, just over TLS). A protocol this
 * library doesn't recognize passes through unchanged, so it simply fails to
 * match any registered client's protocol rather than aliasing to the wrong
 * one. */
const PROTOCOL_ALIASES: Record<string, string> = {
  "kafka-secure": "kafka",
  wss: "ws",
};

function normalizeProtocol(protocol: string): string {
  return PROTOCOL_ALIASES[protocol] ?? protocol;
}

/** Resolves every server a channel/operation is reachable through: the
 * explicit `operation.servers`/`channel.servers` ref list when either is
 * given, otherwise every server in the document — per AsyncAPI 3.x, omitting
 * `servers` means "reachable through all of them". Refs that don't resolve
 * are dropped rather than thrown; a dangling ref here shouldn't block
 * generation when another server already tells us the protocol. */
function resolveServers(
  document: AsyncApiDocument,
  serverRefs: Array<Server | Ref> | undefined,
): Server[] {
  const refs =
    serverRefs && serverRefs.length > 0 ? serverRefs : Object.values(document.servers ?? {});
  return refs
    .map((ref) => deref<Server>(document, ref))
    .filter((server): server is Server => Boolean(server));
}

/** Resolves an operationId to its operation and channel, throwing the same
 * errors `buildRequest` has always thrown for an unknown operation or an
 * unresolvable channel ref. Shared by `buildRequest` and
 * `isProtocolCompatible` so the two can never drift on what counts as a
 * resolvable operation. */
function resolveOperationAndChannel(
  document: AsyncApiDocument,
  operationId: string,
): { operation: Operation; channel: Channel } {
  const operationOrRef = document.operations?.[operationId];
  const operation = operationOrRef && deref(document, operationOrRef);
  if (!operation) {
    throw new UnknownOperationError(operationId);
  }

  const channel = deref<Channel>(document, operation.channel);
  if (!channel) {
    throw new MissingChannelError(operationId);
  }

  return { operation, channel };
}

interface Eligibility {
  servers: Server[];
  matchedServer: Server | undefined;
  eligible: boolean;
}

/** The protocol-eligibility rule itself — see `isProtocolCompatible`'s
 * doc comment for what "eligible" means. Shared by `buildRequest` (which
 * also needs `servers`/`matchedServer` downstream, for the generated server
 * URL) and `isProtocolCompatible` (which only needs the boolean). */
function computeEligibility(
  document: AsyncApiDocument,
  channel: Channel,
  operation: Operation,
  protocol: string,
): Eligibility {
  const servers = resolveServers(document, operation.servers ?? channel.servers);
  const matchedServer = servers.find(
    (candidate) => normalizeProtocol(candidate.protocol) === protocol,
  );
  const explicitBinding = (channel.bindings as Record<string, unknown> | undefined)?.[protocol];

  return { servers, matchedServer, eligible: Boolean(matchedServer || explicitBinding) };
}

/**
 * Checks whether `operationId`'s channel is reachable over `protocol` (a
 * client's `info.protocol`, e.g. `"ws"`/`"kafka"`) — the same eligibility
 * rule `buildRequest`/`convert()` use internally (see "Protocol eligibility"
 * in the README) — without generating a snippet. Meant for filtering UI
 * (e.g. a target/client dropdown) down to only the protocols an operation
 * actually supports, before the user picks one; see `getCompatibleTargets`
 * for a ready-made version of exactly that.
 *
 * Never throws: an unknown `operationId`, a channel that can't be resolved,
 * or any other resolution failure (e.g. a malformed `$ref`) all resolve to
 * `false` rather than propagating an error, since this is meant to be safe
 * to call speculatively for every candidate protocol.
 */
export function isProtocolCompatible(
  document: AsyncApiDocument,
  operationId: string,
  protocol: string,
): boolean {
  try {
    const { operation, channel } = resolveOperationAndChannel(document, operationId);
    return computeEligibility(document, channel, operation, protocol).eligible;
  } catch {
    return false;
  }
}

/**
 * Normalizes an AsyncAPI 3.x operation into the internal `Request` shape —
 * the AsyncAPI equivalent of httpsnippet's HAR-derived `Request`. `protocol`
 * is the target client's `info.protocol` (e.g. `"ws"`, `"kafka"`).
 *
 * A channel is eligible for `protocol` when either: a server it's reachable
 * through declares that protocol, normalizing secure variants
 * (`kafka-secure`/`wss` → their base protocol); or the channel declares an
 * explicit `channel.bindings[protocol]` object, even with no server telling
 * us the protocol at all. Either signal alone is sufficient — most real
 * AsyncAPI documents only declare `channel.bindings[protocol]` when they
 * need the extra data it carries (ws query/headers, a kafka topic override),
 * not as a way of saying "this channel speaks this protocol".
 */
export function buildRequest(
  document: AsyncApiDocument,
  operationId: string,
  protocol: string,
): Request {
  const { operation, channel } = resolveOperationAndChannel(document, operationId);
  const { servers, matchedServer, eligible } = computeEligibility(
    document,
    channel,
    operation,
    protocol,
  );

  if (!eligible) {
    throw new MissingBindingError(operationId, protocol);
  }

  const placeholders: string[] = [];

  let query: Record<string, string> = {};
  let headers: Record<string, string> = {};
  let kafkaTopicOverride: string | undefined;

  if (protocol === "ws") {
    const resolvedQuery = resolveRawObjectSchema(channel.bindings?.ws?.query);
    const resolvedHeaders = resolveRawObjectSchema(channel.bindings?.ws?.headers);
    query = resolvedQuery.values;
    headers = resolvedHeaders.values;
    placeholders.push(...resolvedQuery.placeholders.map((name) => `query param "${name}"`));
    placeholders.push(...resolvedHeaders.placeholders.map((name) => `header "${name}"`));
  } else if (protocol === "kafka") {
    kafkaTopicOverride = channel.bindings?.kafka?.topic;
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

  // Prefer the server that actually matches `protocol` — relevant when a
  // channel is reachable through several servers of different protocols.
  // Falls back to the first resolved server for the binding-only eligibility
  // case (no server matched at all), matching the previous single-server
  // behavior.
  const server = matchedServer ?? servers[0];
  const serverUrl = server ? `${server.protocol}://${server.host}${server.pathname ?? ""}` : "";
  const serverHost = server?.host ?? "";

  // Operation.messages is optional: omitting it means all channel messages apply
  // (AsyncAPI 3.x). An explicit `[]` means no messages.
  const messages =
    operation.messages !== undefined
      ? operation.messages.map((ref) => deref<Message>(document, ref))
      : Object.values(channel.messages ?? {}).map((msg) => deref<Message>(document, msg));
  const message = messages[0];
  const explicitExample = message?.examples?.[0];

  let exampleName: string | undefined;
  let examplePayload: unknown;

  if (explicitExample) {
    exampleName = explicitExample.name;
    examplePayload = explicitExample.payload;
  } else if (message?.payload !== undefined) {
    examplePayload = generateExampleFromSchema(document, message.payload);
    if (examplePayload === undefined) {
      throw new MissingExampleError(operationId);
    }
    placeholders.push("message payload (no explicit example — generated from its schema)");
  } else {
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
      name: exampleName,
      payload: examplePayload,
    },
    placeholders,
    ...(kafka ? { kafka } : {}),
  };
}
