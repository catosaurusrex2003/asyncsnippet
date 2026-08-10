import type { Client } from "../../index.js";
import { CodeBuilder, type CodeBuilderOptions } from "../../../helpers/code-builder.js";

/** Renders a JS value as a Go composite literal (map[string]interface{}/[]interface{}/string/float64/bool/nil), nested with `indentUnit` per level. */
function goLiteral(value: unknown, indentUnit: string, level = 0): string {
  const pad = indentUnit.repeat(level);
  const childPad = indentUnit.repeat(level + 1);

  if (value === null || value === undefined) return "nil";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]interface{}{}";
    const items = value.map((item) => `${childPad}${goLiteral(item, indentUnit, level + 1)}`);
    return `[]interface{}{\n${items.join(",\n")},\n${pad}}`;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "map[string]interface{}{}";
  const items = entries.map(
    ([key, val]) => `${childPad}${JSON.stringify(key)}: ${goLiteral(val, indentUnit, level + 1)}`,
  );
  return `map[string]interface{}{\n${items.join(",\n")},\n${pad}}`;
}

export const kafkaGo: Client = {
  info: {
    key: "kafka-go",
    title: "kafka-go",
    description:
      "Kafka producer/consumer client using the segmentio/kafka-go package — a pure Go client (no cgo, unlike confluent-kafka-go).",
    link: "https://github.com/segmentio/kafka-go",
    extname: ".go",
    protocol: "kafka",
  },
  convert: (request, inputOpts?: CodeBuilderOptions) => {
    const opts = { indent: "\t", ...inputOpts };
    const { push, blank, join } = new CodeBuilder({ indent: opts.indent });

    if (request.placeholders.length > 0) {
      push("// NOTE: some values could not be resolved from the AsyncAPI document's");
      push("// default/examples and were filled with a placeholder — replace them");
      push("// with real values before running this snippet:");
      for (const placeholder of request.placeholders) {
        push(`//   - ${placeholder}`);
      }
      blank();
    }

    const brokers = request.serverHost
      .split(",")
      .map((broker) => broker.trim())
      .filter(Boolean);

    push("package main");
    blank();
    push("import (");
    if (request.action === "send") {
      push('"context"', 1);
      push('"encoding/json"', 1);
      push('"log"', 1);
    } else {
      push('"context"', 1);
      push('"log"', 1);
    }
    blank();
    push('"github.com/segmentio/kafka-go"', 1);
    push(")");
    blank();
    push("func main() {");

    if (request.action === "send") {
      push("writer := &kafka.Writer{", 1);
      push(
        `Addr:     kafka.TCP(${brokers.map((broker) => JSON.stringify(broker)).join(", ")}),`,
        2,
      );
      push(`Topic:    ${JSON.stringify(request.channelAddress)},`, 2);
      push("Balancer: &kafka.LeastBytes{},", 2);
      push("}", 1);
      push("defer writer.Close()", 1);
      blank();

      const payloadLines = goLiteral(request.message.payload, opts.indent).split("\n");
      push(`payload := ${payloadLines[0]}`, 1);
      for (const line of payloadLines.slice(1)) {
        push(line, 1);
      }
      blank();

      push("data, err := json.Marshal(payload)", 1);
      push("if err != nil {", 1);
      push('log.Fatal("marshal:", err)', 2);
      push("}", 1);
      blank();

      push("message := kafka.Message{Value: data}", 1);
      if (request.kafka?.key !== undefined) {
        push(`message.Key = []byte(${JSON.stringify(request.kafka.key)})`, 1);
      }
      blank();

      push("if err := writer.WriteMessages(context.Background(), message); err != nil {", 1);
      push('log.Fatal("write:", err)', 2);
      push("}", 1);
    } else {
      const groupId = request.kafka?.groupId ?? "";
      push("reader := kafka.NewReader(kafka.ReaderConfig{", 1);
      push(`Brokers: []string{${brokers.map((broker) => JSON.stringify(broker)).join(", ")}},`, 2);
      push(`Topic:   ${JSON.stringify(request.channelAddress)},`, 2);
      push(`GroupID: ${JSON.stringify(groupId)},`, 2);
      push("})", 1);
      push("defer reader.Close()", 1);
      blank();

      const messageLabel = request.message.name ? ` ("${request.message.name}")` : "";
      push(`// Example message shape for this operation${messageLabel}:`, 1);
      for (const line of JSON.stringify(request.message.payload, null, 2).split("\n")) {
        push(`// ${line}`, 1);
      }
      blank();

      push("for {", 1);
      push("message, err := reader.ReadMessage(context.Background())", 2);
      push("if err != nil {", 2);
      push('log.Println("read:", err)', 3);
      push("return", 3);
      push("}", 2);
      push("log.Println(string(message.Value))", 2);
      push("}", 1);
    }

    push("}");

    return join();
  },
};
