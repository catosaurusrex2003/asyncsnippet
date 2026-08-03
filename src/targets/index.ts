import type { CodeBuilderOptions } from "../helpers/code-builder.js";
import type { Request } from "../request.js";

import { tokioTungstenite } from "./rust/tokio-tungstenite/client.js";
import { websockets as pythonWebsockets } from "./python/websockets/client.js";
import { websocket } from "./javascript/websocket/client.js";
import { gorilla } from "./go/gorilla/client.js";
import { ws } from "./javascript/ws/client.js";

export interface ClientInfo {
  key: string;
  title: string;
  description: string;
  link: string;
  extname: string;
  /** AsyncAPI channel binding this client generates code for, e.g. `"ws"`. */
  protocol: string;
}

export interface Client {
  info: ClientInfo;
  convert: (request: Request, options?: CodeBuilderOptions) => string;
}

export interface Target {
  info: {
    key: string;
    title: string;
    default: string;
  };
  clientsById: Record<string, Client>;
}

const targets: Record<string, Target> = {};

/**
 * Registers a new target (language/platform), mirroring httpsnippet's
 * `addTarget`. Throws if `target.info.key` is already registered — use
 * {@link addTargetClient} to add clients to an existing target instead.
 */
export function addTarget(target: Target): void {
  if (targets[target.info.key]) {
    throw new Error(`Target "${target.info.key}" is already registered`);
  }
  targets[target.info.key] = { ...target, clientsById: { ...target.clientsById } };
}

/**
 * Registers a new client under an already-registered target, mirroring
 * httpsnippet's `addTargetClient`. Throws if the target hasn't been
 * registered yet, or if a client with the same key already exists on it.
 */
export function addTargetClient(targetId: string, client: Client): void {
  const target = targets[targetId];
  if (!target) {
    throw new Error(
      `Cannot register client "${client.info.key}": target "${targetId}" is not registered. Call addTarget() first.`,
    );
  }
  if (target.clientsById[client.info.key]) {
    throw new Error(`Client "${client.info.key}" is already registered for target "${targetId}"`);
  }
  target.clientsById[client.info.key] = client;
}

export { targets };

export interface SupportedTarget {
  key: string;
  title: string;
  /** Client key used when `clientId` is omitted from `convert()`. */
  default: string;
  clients: ClientInfo[];
}

/**
 * Read-only snapshot of every registered target/client/protocol combination —
 * lets consumers (e.g. a UI picker) discover what this version of the
 * library supports without reaching into the internal `targets` registry.
 */
export function getSupportedTargets(): SupportedTarget[] {
  return Object.values(targets).map((target) => ({
    key: target.info.key,
    title: target.info.title,
    default: target.info.default,
    clients: Object.values(target.clientsById).map((client) => client.info),
  }));
}

addTarget({ info: { key: "javascript", title: "JavaScript", default: "ws" }, clientsById: {} });
addTargetClient("javascript", ws);
addTargetClient("javascript", websocket);

addTarget({ info: { key: "python", title: "Python", default: "websockets" }, clientsById: {} });
addTargetClient("python", pythonWebsockets);

addTarget({ info: { key: "rust", title: "Rust", default: "tokio-tungstenite" }, clientsById: {} });
addTargetClient("rust", tokioTungstenite);

addTarget({ info: { key: "go", title: "Go", default: "gorilla" }, clientsById: {} });
addTargetClient("go", gorilla);
