// Live preview of every fixture x every registered target/client.
// Run once:  npx tsx scripts/gallery.ts
// Watch:     npx tsx watch scripts/gallery.ts   (reruns on any src/ or fixture change)
import fs from "node:fs";

import yaml from "js-yaml";

import type { AsyncApiDocument } from "../src/asyncapi-types.js";

import { AsyncSnippet } from "../src/index.js";
import { targets } from "../src/targets/index.js";

const cases: { file: string; operationId: string; protocol?: string }[] = [
  { file: "simple.yaml", operationId: "sendPing" },
  { file: "with-bindings.yaml", operationId: "sendMessage" },
  { file: "pubsub.yaml", operationId: "sendHeartbeat" },
  { file: "pubsub.yaml", operationId: "subscribeToAlerts" },
  { file: "multi-message.yaml", operationId: "sendOrderCommand" },
  { file: "kafka.yaml", operationId: "publishOrderCreated", protocol: "kafka" },
  { file: "kafka.yaml", operationId: "consumeOrderCreated", protocol: "kafka" },
];

for (const { file, operationId, protocol } of cases) {
  const document = yaml.load(fs.readFileSync(`./src/fixtures/${file}`, "utf8")) as AsyncApiDocument;
  const snippet = new AsyncSnippet(document);
  const wantedProtocol = protocol ?? "ws";

  for (const [targetId, target] of Object.entries(targets)) {
    for (const clientId of Object.keys(target.clientsById)) {
      if (target.clientsById[clientId]!.info.protocol !== wantedProtocol) continue;

      const heading = `${file} :: ${operationId} :: ${targetId}/${clientId}`;
      console.log(`\n${"=".repeat(heading.length)}\n${heading}\n${"=".repeat(heading.length)}\n`);
      console.log(snippet.convert(operationId, targetId, clientId));
    }
  }
}
