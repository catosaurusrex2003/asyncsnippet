import type { CodeBuilderOptions } from "../helpers/code-builder.js";
import type { Request } from "../request.js";

import { ws } from "./javascript/ws/client.js";

export interface ClientInfo {
  key: string;
  title: string;
  description: string;
  link: string;
  extname: string;
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

/**
 * v1 target/client registry. Hardcoded to a single entry (see design doc's
 * "targetId/clientId validation") — not yet the extensible `addTarget`
 * registry described in the design doc's Approach B.
 */
export const targets: Record<string, Target> = {
  javascript: {
    info: {
      key: "javascript",
      title: "JavaScript",
      default: "ws",
    },
    clientsById: {
      ws,
    },
  },
};
