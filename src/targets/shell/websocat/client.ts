import type { Client } from "../../index.js";
import { CodeBuilder, type CodeBuilderOptions } from "../../../helpers/code-builder.js";
import { buildWsUrl } from "../../../helpers/ws-url.js";

/** Wraps a value in single quotes for safe use as one POSIX shell argument, escaping any embedded single quotes. */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Pushes `head` followed by `args`, one per line with `\` continuations — or just `head` when there are no args. */
function pushCommand(
  push: (line: string, indentationLevel?: number) => void,
  head: string,
  args: string[],
): void {
  if (args.length === 0) {
    push(head);
    return;
  }
  push(`${head} \\`);
  args.forEach((arg, i) => {
    push(i < args.length - 1 ? `${arg} \\` : arg, 1);
  });
}

export const websocat: Client = {
  info: {
    key: "websocat",
    title: "websocat",
    description:
      'Command-line WebSocket client ("curl for WebSockets") — connects from a terminal or shell script, no code required.',
    link: "https://github.com/vi/websocat",
    extname: ".sh",
    protocol: "ws",
  },
  convert: (request, inputOpts?: CodeBuilderOptions) => {
    const opts = { indent: "  ", ...inputOpts };
    const { push, blank, join } = new CodeBuilder({ indent: opts.indent });

    if (request.placeholders.length > 0) {
      push("# NOTE: some values could not be resolved from the AsyncAPI document's");
      push("# default/examples and were filled with a placeholder — replace them");
      push("# with real values before running this snippet:");
      for (const placeholder of request.placeholders) {
        push(`#   - ${placeholder}`);
      }
      blank();
    }

    const url = buildWsUrl(request.serverUrl, request.channelAddress, request.query);
    const headerArgs = Object.entries(request.headers).map(
      ([name, value]) => `-H=${shellQuote(`${name}: ${value}`)}`,
    );

    if (request.action === "send") {
      const payload = shellQuote(JSON.stringify(request.message.payload));
      pushCommand(push, `echo ${payload} | websocat -n1 ${shellQuote(url)}`, headerArgs);
    } else {
      const messageLabel = request.message.name ? ` ("${request.message.name}")` : "";
      push(`# Example message shape for this operation${messageLabel}:`);
      for (const line of JSON.stringify(request.message.payload, null, 2).split("\n")) {
        push(`# ${line}`);
      }
      blank();
      pushCommand(push, `websocat ${shellQuote(url)}`, headerArgs);
    }

    return join();
  },
};
