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
  constructor(targetId: string, clientId: string) {
    super(
      `Unsupported target "${targetId}/${clientId}". asyncsnippet v1 only supports targetId: "javascript", clientId: "ws".`,
    );
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
  constructor(operationId: string) {
    super(`Operation "${operationId}" has no "ws" channel binding`);
    this.name = "MissingBindingError";
  }
}

export class MissingExampleError extends AsyncSnippetError {
  constructor(operationId: string) {
    super(
      `Operation "${operationId}"'s message has no "examples" entry. asyncsnippet v1 requires an explicit example — it does not synthesize payloads from a JSON Schema.`,
    );
    this.name = "MissingExampleError";
  }
}
