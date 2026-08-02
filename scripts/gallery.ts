// Live preview of every fixture x every registered target/client.
// Run once:  npx tsx scripts/gallery.ts
// Watch:     npx tsx watch scripts/gallery.ts   (reruns on any src/ or fixture change)
import { AsyncSnippet } from "../src/index.js";
import { targets } from "../src/targets/index.js";

const cases: { file: string; operationId: string }[] = [
  { file: "simple.yaml", operationId: "sendPing" },
  { file: "with-bindings.yaml", operationId: "sendMessage" },
  { file: "pubsub.yaml", operationId: "sendHeartbeat" },
  { file: "pubsub.yaml", operationId: "subscribeToAlerts" },
  { file: "multi-message.yaml", operationId: "sendOrderCommand" },
];

for (const { file, operationId } of cases) {
  const snippet = await AsyncSnippet.fromFile(`./src/fixtures/${file}`);

  for (const [targetId, target] of Object.entries(targets)) {
    for (const clientId of Object.keys(target.clientsById)) {
      const heading = `${file} :: ${operationId} :: ${targetId}/${clientId}`;
      console.log(`\n${"=".repeat(heading.length)}\n${heading}\n${"=".repeat(heading.length)}\n`);
      console.log(snippet.convert(operationId, targetId, clientId));
    }
  }
}
