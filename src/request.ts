import type {
  AsyncApiDocument,
  Channel,
  Info,
  Message,
  Operation,
  Ref,
  SecurityScheme,
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
import { resolveSchemaDeep } from "./helpers/schema-deref.js";
import { resolveRawObjectSchema, resolveSchemaField } from "./helpers/schema-value.js";
import { resolveServerSecurity } from "./helpers/security.js";

/** A single server the operation is reachable through, resolved with its
 * name (its key in `document.servers`, or the trailing `$ref` segment for an
 * operation/channel-scoped override) and its own `security`, fully dereffed —
 * for a human/agent-facing summary that (unlike `serverUrl`/`serverHost`)
 * doesn't collapse to just the one server this client's protocol matched. */
export interface ResolvedServer {
  name: string;
  host: string;
  protocol: string;
  pathname?: string;
  url: string;
  description?: string;
  security: SecurityScheme[];
}

export interface Request {
  operationId: string;
  action: "send" | "receive";

  /** AsyncAPI channel binding this request was normalized for, e.g. `"ws"` or `"kafka"`. */
  protocol: string;

  /** Resolved server URL, e.g. `wss://chat.example.com`. First entry in the document's `servers` map — see design doc's default server-selection rule. */
  serverUrl: string;

  /** Raw `server.host`, with no protocol scheme prefix — e.g. a Kafka broker list (`broker1:9092,broker2:9092`). Clients that need a broker list (rather than a URL) should split this, not `serverUrl`. */
  serverHost: string;

  /** Every server the operation is reachable through (same set used for protocol eligibility), each with its own resolved `security` — unlike `serverUrl`/`serverHost`, not collapsed to just the one server matching this client's protocol. */
  servers: ResolvedServer[];

  /** Channel address with `{param}` placeholders substituted using the literal-value resolution rule. For `ws`, this is a URL path; for `kafka`, this is the topic name (after any `bindings.kafka.topic` override). */
  channelAddress: string;

  /** Channel address exactly as declared (`{param}` placeholders left in), for display purposes — `channelAddress` is the one to actually connect to/publish on. */
  channelTemplate: string;

  query: Record<string, string>;
  headers: Record<string, string>;

  /** The operation's own `summary`/`description`, when the document declares them. */
  operationSummary?: string;
  operationDescription?: string;

  message: {
    /** Explicit example's `name`, when the message has one. */
    name?: string;
    /** Resolved/generated example payload — see `placeholders` for whether it came from an explicit example or was synthesized from `payloadSchema`. */
    payload: unknown;
    /** The message's own `title`/`summary`/`description`/`contentType`, when the document declares them. */
    title?: string;
    summary?: string;
    description?: string;
    contentType?: string;
    /** Raw payload JSON Schema, fully dereffed — the schema `payload` above was generated from (if it was), for callers that want to describe constraints/types rather than show a single example. */
    payloadSchema?: unknown;
    /** Raw headers JSON Schema (e.g. Kafka message headers), fully dereffed, when the message declares one. */
    headersSchema?: unknown;
  };

  /** Fields that couldn't be resolved from `default`/`examples` and were filled with a `<placeholder>` — surfaced as a comment in generated snippets. */
  placeholders: string[];

  /** The document's `info` object (title/version/description/license), when the document declares one — mainly useful for a human/agent-facing summary rather than a runnable snippet. */
  info?: Info;

  /** The resolved (matched) server's `security` list, fully dereffed against `document.components.securitySchemes`. Empty when the server declares no security (or none of it resolves) — this library has no notion of "no auth required" vs. "auth info unavailable", same as every other unresolved field. See `servers` for every reachable server's own security, not just this one. */
  security: SecurityScheme[];

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

function isRef(value: unknown): value is Ref {
  return typeof value === "object" && value !== null && typeof (value as Ref).$ref === "string";
}

/** Last path segment of a `$ref`, e.g. `"#/servers/production"` → `"production"` — used as a display name when a server/message is only reachable via an operation/channel-scoped ref rather than by iterating the document's own name-keyed map. */
function refSegment(ref: string): string {
  return ref.slice(ref.lastIndexOf("/") + 1);
}

interface NamedServer {
  name: string;
  server: Server;
}

/** Resolves every server a channel/operation is reachable through: the
 * explicit `operation.servers`/`channel.servers` ref list when either is
 * given, otherwise every server in the document — per AsyncAPI 3.x, omitting
 * `servers` means "reachable through all of them". Refs that don't resolve
 * are dropped rather than thrown; a dangling ref here shouldn't block
 * generation when another server already tells us the protocol. Each
 * resolved server keeps its name (its key in `document.servers`, or the
 * trailing `$ref` segment for an operation/channel-scoped override) for
 * display purposes. */
function resolveServers(
  document: AsyncApiDocument,
  serverRefs: Array<Server | Ref> | undefined,
): NamedServer[] {
  if (serverRefs && serverRefs.length > 0) {
    return serverRefs
      .map((ref) => {
        const server = deref<Server>(document, ref);
        if (!server) {
          return undefined;
        }
        return { name: isRef(ref) ? refSegment(ref.$ref) : "", server };
      })
      .filter((entry): entry is NamedServer => Boolean(entry));
  }
  return Object.entries(document.servers ?? {})
    .map(([name, ref]) => {
      const server = deref<Server>(document, ref);
      return server ? { name, server } : undefined;
    })
    .filter((entry): entry is NamedServer => Boolean(entry));
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
  servers: NamedServer[];
  matchedServer: NamedServer | undefined;
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
    (candidate) => normalizeProtocol(candidate.server.protocol) === protocol,
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

  const channelTemplate = channel.address ?? "";
  let channelAddress = channelTemplate;
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
  const server = (matchedServer ?? servers[0])?.server;
  const serverUrl = server ? `${server.protocol}://${server.host}${server.pathname ?? ""}` : "";
  const serverHost = server?.host ?? "";
  const security = resolveServerSecurity(document, server?.security);
  const resolvedServers: ResolvedServer[] = servers.map(({ name, server: candidate }) => ({
    name,
    host: candidate.host,
    protocol: candidate.protocol,
    pathname: candidate.pathname,
    url: `${candidate.protocol}://${candidate.host}${candidate.pathname ?? ""}`,
    description: candidate.description,
    security: resolveServerSecurity(document, candidate.security),
  }));

  // Operation.messages is optional: omitting it means all channel messages apply
  // (AsyncAPI 3.x). An explicit `[]` means no messages.
  const message =
    operation.messages !== undefined
      ? deref<Message>(document, operation.messages[0])
      : deref<Message>(document, Object.values(channel.messages ?? {})[0]);
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

  const payloadSchema =
    message?.payload !== undefined ? resolveSchemaDeep(document, message.payload) : undefined;
  const headersSchema =
    message?.headers !== undefined ? resolveSchemaDeep(document, message.headers) : undefined;

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
    servers: resolvedServers,
    channelAddress,
    channelTemplate,
    query,
    headers,
    operationSummary: operation.summary,
    operationDescription: operation.description,
    message: {
      name: exampleName,
      payload: examplePayload,
      title: message?.title ?? message?.name,
      summary: message?.summary,
      description: message?.description,
      contentType: message?.contentType,
      payloadSchema,
      headersSchema,
    },
    placeholders,
    info: document.info,
    security,
    ...(kafka ? { kafka } : {}),
  };
}
