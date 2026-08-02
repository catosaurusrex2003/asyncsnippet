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

export interface ChannelBindings {
  ws?: WsChannelBinding;
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

export interface Message {
  payload?: unknown;
  examples?: MessageExample[];
}

export interface Operation {
  action: "send" | "receive";
  channel: Ref;
  messages?: Ref[];
  servers?: Ref[];
}

export interface AsyncApiDocument {
  servers?: Record<string, Server | Ref>;
  channels?: Record<string, Channel | Ref>;
  operations?: Record<string, Operation | Ref>;
}
