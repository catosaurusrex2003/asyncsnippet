import type { SecurityScheme } from "../../asyncapi-types.js";
import type { Request, ResolvedServer } from "../../request.js";

import { CodeBuilder, type CodeBuilderOptions } from "../../helpers/code-builder.js";

/** Human-readable label for a security scheme, mirroring apiuikit's `securitySchemeLabel` — a single switch on `scheme.type` shared across every mechanism this library recognizes. */
function securitySchemeLabel(scheme: SecurityScheme): string {
  switch (scheme.type) {
    case "apiKey":
    case "httpApiKey":
      return `API key${scheme.in ? ` (in ${scheme.in}${scheme.name ? `: \`${scheme.name}\`` : ""})` : ""}`;
    case "http":
      return scheme.scheme ? `HTTP ${scheme.scheme}` : "HTTP authentication";
    case "oauth2":
      return "OAuth2";
    case "openIdConnect":
      return "OpenID Connect";
    case "userPassword":
      return "Username/password";
    case "X509":
      return "X.509 certificate";
    case "symmetricEncryption":
      return "Symmetric encryption";
    case "asymmetricEncryption":
      return "Asymmetric encryption";
    case "plain":
      return "SASL/PLAIN";
    case "scramSha256":
      return "SASL/SCRAM-SHA-256";
    case "scramSha512":
      return "SASL/SCRAM-SHA-512";
    case "gssapi":
      return "SASL/GSSAPI (Kerberos)";
    default:
      return scheme.type;
  }
}

/** Renders a `**Authorization:**` block for one server's resolved security schemes — shared between every server in `## Servers`, since each gets its own independent auth requirements. */
function pushSecurity(
  push: (line: string, level?: number) => void,
  security: SecurityScheme[],
): void {
  if (security.length === 0) {
    return;
  }
  push("**Authorization:**");
  for (const scheme of security) {
    push(`- **${securitySchemeLabel(scheme)}**`);
    if (scheme.description) {
      push(scheme.description, 1);
    }
    if (scheme.type === "openIdConnect" && scheme.openIdConnectUrl) {
      push(`- OpenID Connect URL: \`${scheme.openIdConnectUrl}\``, 1);
    }
    if (scheme.type === "oauth2") {
      for (const [flowName, flow] of Object.entries(scheme.flows ?? {})) {
        push(`- Flow \`${flowName}\`:`, 1);
        if (flow.authorizationUrl) push(`- Authorization URL: \`${flow.authorizationUrl}\``, 2);
        if (flow.tokenUrl) push(`- Token URL: \`${flow.tokenUrl}\``, 2);
        if (flow.refreshUrl) push(`- Refresh URL: \`${flow.refreshUrl}\``, 2);
        const scopes = Object.keys(flow.scopes ?? {});
        if (scopes.length > 0) {
          push(`- Scopes: ${scopes.map((scope) => `\`${scope}\``).join(", ")}`, 2);
        }
      }
    }
  }
}

function pushServer(
  push: (line: string, level?: number) => void,
  blank: () => void,
  server: ResolvedServer,
): void {
  push(`### ${server.name || server.host}`);
  blank();
  push(`**Host:** \`${server.host}${server.pathname ?? ""}\``);
  push(`**Protocol:** ${server.protocol}`);
  if (server.description) {
    push(server.description);
  }
  blank();
  if (server.security.length > 0) {
    pushSecurity(push, server.security);
    blank();
  }
}

function pushSchema(
  push: (line: string, level?: number) => void,
  blank: () => void,
  label: string,
  schema: unknown,
): void {
  push(`#### \`${label}\``);
  blank();
  push("```json");
  for (const line of JSON.stringify(schema, null, 2).split("\n")) {
    push(line);
  }
  push("```");
  blank();
}

/**
 * Builds a self-contained Markdown document describing a single AsyncAPI
 * operation for an LLM agent to consume — modeled on apiuikit's
 * `asyncApiOperationToMarkdown` (intro, every reachable server with its own
 * authorization, the operation and its message with the raw payload/headers
 * JSON Schema), plus an explicit agent-facing intro sentence and step-by-step
 * instructions apiuikit's version doesn't have. Shared by every `agent/*`
 * client (one per protocol, same as the `javascript`/`python`/etc. targets)
 * so the template itself stays protocol-agnostic.
 */
export function buildAgentPromptMarkdown(request: Request, inputOpts?: CodeBuilderOptions): string {
  const opts = { indent: "  ", ...inputOpts };
  const { push, blank, join } = new CodeBuilder({ indent: opts.indent });

  const title = request.info?.title ?? request.operationId;
  push(`# ${title}`);
  blank();

  const license = request.info?.license;
  push(`**Version:** ${request.info?.version ?? "unknown"}${license ? "  " : ""}`);
  if (license) {
    push(`**License:** ${license.name ?? ""}${license.url ? ` (${license.url})` : ""}`);
  }
  blank();

  if (request.info?.description) {
    push(request.info.description);
    blank();
  }

  const verb = request.action === "send" ? "send a message to" : "receive messages from";
  push(
    `You are an AI agent that needs to ${verb} an asynchronous (${request.protocol}) API operation ("${request.operationId}"). Use only the details below — do not invent field names, URLs, topics, or values that aren't given here.`,
  );
  blank();

  if (request.servers.length > 0) {
    push("## Servers");
    blank();
    for (const server of request.servers) {
      pushServer(push, blank, server);
    }
  }

  push(`### ${request.action.toUpperCase()} \`${request.operationId}\``);
  blank();
  push(`**Channel:** \`${request.channelTemplate}\``);
  const queryNames = Object.keys(request.query);
  const headerNames = Object.keys(request.headers);
  if (queryNames.length > 0) {
    push(
      `**Query parameters:** ${queryNames.map((name) => `\`${name}=${request.query[name]}\``).join(", ")}`,
    );
  }
  if (headerNames.length > 0) {
    push(
      `**Headers:** ${headerNames.map((name) => `\`${name}: ${request.headers[name]}\``).join(", ")}`,
    );
  }
  if (request.kafka?.clientId !== undefined) {
    push(`**Kafka client ID:** \`${request.kafka.clientId}\``);
  }
  if (request.action === "receive" && request.kafka?.groupId !== undefined) {
    push(`**Kafka consumer group ID:** \`${request.kafka.groupId}\``);
  }
  if (request.kafka?.key !== undefined) {
    push(`**Kafka message key:** \`${request.kafka.key}\``);
  }
  blank();
  if (request.operationSummary) {
    push(request.operationSummary);
    blank();
  }
  if (request.operationDescription) {
    push(request.operationDescription);
    blank();
  }

  push(`#### ${request.message.title ?? request.operationId}`);
  blank();
  if (request.message.summary) {
    push(request.message.summary);
    blank();
  }
  if (request.message.description) {
    push(request.message.description);
    blank();
  }
  if (request.message.contentType) {
    push(`**Content-Type:** \`${request.message.contentType}\``);
    blank();
  }

  if (request.message.payloadSchema !== undefined) {
    pushSchema(push, blank, "payload", request.message.payloadSchema);
  }
  if (request.message.headersSchema !== undefined) {
    pushSchema(push, blank, "headers", request.message.headersSchema);
  }

  push("## Instructions");
  blank();
  if (request.action === "send") {
    push("1. Construct a JSON payload that conforms to the `payload` schema above.");
    push(
      `2. Send it to the channel/topic \`${request.channelAddress}\` on the server described above, using the authorization details given (if any).`,
    );
  } else {
    push(
      `1. Subscribe/listen on the channel/topic \`${request.channelAddress}\` on the server described above, using the authorization details given (if any).`,
    );
    push("2. Expect incoming messages conforming to the `payload` schema above.");
  }
  if (request.placeholders.length > 0) {
    push(
      "3. Some values above could not be resolved from the AsyncAPI document's `default`/`examples` and are placeholders — replace them with real values before acting:",
    );
    for (const placeholder of request.placeholders) {
      push(`- ${placeholder}`, 1);
    }
  }

  return join();
}
