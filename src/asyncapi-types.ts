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
  payload?: unknown;
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
}

export interface AsyncApiDocument {
  servers?: Record<string, Server | Ref>;
  channels?: Record<string, Channel | Ref>;
  operations?: Record<string, Operation | Ref>;
}
