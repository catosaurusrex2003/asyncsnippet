# Contributing

Thanks for contributing to asyncsnippet. This doc covers local setup, how to
add a target/client, and how releases work.

## Setup

Requires Node.js >= 22.

```sh
npm install
npm run lint    # oxlint + oxfmt --check + tsc
npm test        # vitest (snapshot tests against src/fixtures/)
npm run build   # tsdown -> dist/
```

Useful scripts:

- `npm run format` — auto-fix with oxlint/oxfmt
- `npm run dev` — run `scripts/dev.ts` against a local fixture
- `npm run dev:gallery` — preview every fixture × every target/client

Snapshot tests live in `src/fixtures.test.ts`. After intentionally changing
generated output, update them with `npx vitest run -u`.

## Adding a target or client

v1 does **not** yet ship an `addTarget` / `addTargetClient` registry (that is
tracked as a follow-up). Today the registry is the hardcoded `targets` object
in [`src/targets/index.ts`](./src/targets/index.ts). Adding support means
editing that file and adding a client module — same shape httpsnippet uses,
just without the runtime registration helpers yet.

### Contract

A **client** must satisfy:

```ts
interface Client {
  info: {
    key: string; // id passed as clientId to convert(), e.g. "ws"
    title: string;
    description: string;
    link: string; // docs / homepage for the underlying library
    extname: string; // e.g. ".js", ".py"
  };
  convert: (request: Request, options?: CodeBuilderOptions) => string;
}
```

A **target** groups clients by language:

```ts
interface Target {
  info: {
    key: string; // id passed as targetId to convert(), e.g. "javascript"
    title: string;
    default: string; // default clientId for this target
  };
  clientsById: Record<string, Client>;
}
```

`convert()` receives a normalized [`Request`](./src/request.ts) (URL pieces,
headers, query, payload, placeholders, send vs subscribe). Use
[`CodeBuilder`](./src/helpers/code-builder.ts) to emit indented source, matching
the existing [`javascript/ws`](./src/targets/javascript/ws/client.ts) client.

### Steps

1. Add `src/targets/<targetId>/<clientId>/client.ts` exporting a `Client`.
2. Register it on `targets` in `src/targets/index.ts` (create the target entry
   if it is a new language).
3. Add or extend a fixture under `src/fixtures/` and assert the generated
   snippet in `src/fixtures.test.ts` (prefer snapshots).
4. Run `npm test` and `npm run lint`.

When the real `addTarget` / `addTargetClient` API lands, this file will be
updated; the `Client` / `Target` shapes above are intended to stay stable.

## Releasing

Versions are **not** auto-bumped. To publish:

1. Update `"version"` in `package.json` (semver).
2. Add a matching section to [`CHANGELOG.md`](./CHANGELOG.md).
3. Merge to `main`.

The [release workflow](./.github/workflows/release.yml) publishes that version
to npm via trusted publishing if it is not already on the registry, and skips
otherwise.

## Pull requests

- Keep PRs focused; match existing style and the patterns in neighboring files.
- Include tests for behavior changes (especially anything `convert()` throws or
  emits).
- Do not commit secrets. npm publishing uses OIDC trusted publishing — no
  `NPM_TOKEN` in the repo.
