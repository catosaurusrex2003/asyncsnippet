/**
 * Minimal, partial AsyncAPI 3.x document types — only the fields this
 * library actually reads. Not a full spec implementation.
 */

import type { RawObjectSchema } from "./helpers/schema-value.js";

export interface Ref {
  $ref: string;
}

export interface Server {
  host: string;
  protocol: string;
  pathname?: string;
  description?: string;
  security?: Array<SecurityScheme | Ref>;
}

export interface Info {
  title?: string;
  version?: string;
  description?: string;
  license?: {
    name?: string;
    url?: string;
  };
}

/** AsyncAPI 3.x security scheme `type` values this library recognizes. */
export type SecuritySchemeType =
  | "userPassword"
  | "apiKey"
  | "X509"
  | "symmetricEncryption"
  | "asymmetricEncryption"
  | "httpApiKey"
  | "http"
  | "oauth2"
  | "openIdConnect"
  | "plain"
  | "scramSha256"
  | "scramSha512"
  | "gssapi";

export interface OAuth2Flow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes?: Record<string, string>;
}

/** Partial AsyncAPI 3.x Security Scheme Object — only the fields needed to describe auth in a human/agent-facing summary, not to actually perform authentication. */
export interface SecurityScheme {
  type: SecuritySchemeType;
  description?: string;
  /** `apiKey`/`httpApiKey`: the header/query/cookie parameter name. */
  name?: string;
  /** `apiKey`/`httpApiKey`: where the key is sent (`user`, `password`, `query`, `header`, `cookie`). */
  in?: string;
  /** `http`: `"basic"` | `"bearer"`, etc. */
  scheme?: string;
  bearerFormat?: string;
  openIdConnectUrl?: string;
  flows?: Record<string, OAuth2Flow>;
}

export interface Parameter {
  description?: string;
  default?: unknown;
  examples?: unknown[];
}

export interface WsChannelBinding {
  query?: RawObjectSchema;
  headers?: RawObjectSchema;
}

/** AsyncAPI 3.x Kafka channel binding — v1 models only the topic override. */
export interface KafkaChannelBinding {
  topic?: string;
}

export interface ChannelBindings {
  ws?: WsChannelBinding;
  kafka?: KafkaChannelBinding;
}

export interface Channel {
  address?: string;
  messages?: Record<string, Message | Ref>;
  parameters?: Record<string, Parameter>;
  bindings?: ChannelBindings;
  servers?: Ref[];
}

export interface MessageExample {
  name?: string;
  payload?: unknown;
}

/** AsyncAPI 3.x Kafka message binding — v1 models only the message key. */
export interface KafkaMessageBinding {
  key?: Parameter;
}

export interface MessageBindings {
  kafka?: KafkaMessageBinding;
}

export interface Message {
  /** Machine-readable message name, e.g. `"lightMeasured"` — falls back for display when `title` isn't declared. */
  name?: string;
  title?: string;
  summary?: string;
  description?: string;
  contentType?: string;
  payload?: unknown;
  /** Raw JSON Schema for message headers (e.g. Kafka message headers) — separate from the `ws` binding's `headers`, which only covers WebSocket handshake headers. */
  headers?: unknown;
  examples?: MessageExample[];
  bindings?: MessageBindings;
}

/** AsyncAPI 3.x Kafka operation binding — consumer/producer client identity. */
export interface KafkaOperationBinding {
  groupId?: Parameter;
  clientId?: Parameter;
}

export interface OperationBindings {
  kafka?: KafkaOperationBinding;
}

export interface Operation {
  action: "send" | "receive";
  channel: Ref;
  messages?: Ref[];
  servers?: Ref[];
  bindings?: OperationBindings;
  summary?: string;
  description?: string;
}

export interface AsyncApiDocument {
  info?: Info;
  servers?: Record<string, Server | Ref>;
  channels?: Record<string, Channel | Ref>;
  operations?: Record<string, Operation | Ref>;
  components?: {
    schemas?: Record<string, unknown>;
    securitySchemes?: Record<string, SecurityScheme | Ref>;
  };
}
