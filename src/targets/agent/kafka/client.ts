import type { Client } from "../../index.js";

import { buildAgentPromptMarkdown } from "../markdown.js";

export const kafka: Client = {
  info: {
    key: "kafka",
    title: "Agent Prompt (Kafka)",
    description:
      "Self-contained Markdown prompt describing this operation — intro, broker, authorization, and an example payload — for an LLM agent to act on directly, instead of a runnable code snippet.",
    link: "https://www.asyncapi.com/",
    extname: ".md",
    protocol: "kafka",
  },
  convert: (request, inputOpts) => buildAgentPromptMarkdown(request, inputOpts),
};
