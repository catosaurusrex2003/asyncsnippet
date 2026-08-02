// Scratch playground for trying asyncsnippet locally without publishing/building.
// Run with: npm run dev
import fs from "node:fs";

import yaml from "js-yaml";

import type { AsyncApiDocument } from "../src/asyncapi-types.js";

import { AsyncSnippet } from "../src/index.js";

const document = yaml.load(
  fs.readFileSync("./src/fixtures/with-bindings.yaml", "utf8"),
) as AsyncApiDocument;

const snippet = new AsyncSnippet(document);
console.log(snippet.convert("sendMessage", "javascript", "ws"));
