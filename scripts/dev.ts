// Scratch playground for trying asyncsnippet locally without publishing/building.
// Run with: npm run dev
import { AsyncSnippet } from "../src/index.js";

const snippet = await AsyncSnippet.fromFile("./src/fixtures/with-bindings.yaml");
console.log(snippet.convert("sendMessage", "javascript", "ws"));
