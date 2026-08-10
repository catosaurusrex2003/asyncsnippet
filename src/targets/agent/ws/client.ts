import type { Client } from "../../index.js";

import { buildAgentPromptMarkdown } from "../markdown.js";

export const ws: Client = {
  info: {
    key: "ws",
    title: "Agent Prompt (WebSocket)",
    description:
      "Self-contained Markdown prompt describing this operation — intro, server, authorization, and an example payload — for an LLM agent to act on directly, instead of a runnable code snippet.",
    link: "https://www.asyncapi.com/",
    extname: ".md",
    protocol: "ws",
  },
  convert: (request, inputOpts) => buildAgentPromptMarkdown(request, inputOpts),
};
