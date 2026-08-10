export class AsyncSnippetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AsyncSnippetError";
  }
}

export class UnknownOperationError extends AsyncSnippetError {
  constructor(operationId: string) {
    super(`No operation found with id "${operationId}"`);
    this.name = "UnknownOperationError";
  }
}

export class UnsupportedTargetError extends AsyncSnippetError {
  constructor(targetId: string, clientId: string, available: string[] = []) {
    const suffix =
      available.length > 0
        ? ` Registered targetId/clientId pairs: ${available.join(", ")}.`
        : " No targets are registered — did you forget to import a client module?";
    super(`Unsupported target "${targetId}/${clientId}".${suffix}`);
    this.name = "UnsupportedTargetError";
  }
}

export class MissingChannelError extends AsyncSnippetError {
  constructor(operationId: string) {
    super(`Operation "${operationId}" has no channels`);
    this.name = "MissingChannelError";
  }
}

export class MissingBindingError extends AsyncSnippetError {
  constructor(operationId: string, protocol: string) {
    super(
      `Operation "${operationId}" is not reachable over "${protocol}": no server it's associated with declares that protocol (or a secure variant of it), and its channel has no explicit "${protocol}" binding`,
    );
    this.name = "MissingBindingError";
  }
}

export class MissingExampleError extends AsyncSnippetError {
  constructor(operationId: string) {
    super(
      `Operation "${operationId}"'s message has no "examples" entry, and no "payload" schema to generate one from (or its schema has no recognizable type — composition keywords like oneOf/anyOf/allOf aren't resolved into an example).`,
    );
    this.name = "MissingExampleError";
  }
}
