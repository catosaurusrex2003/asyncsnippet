const DEFAULT_INDENTATION_CHARACTER = "";
const DEFAULT_LINE_JOIN = "\n";

export interface CodeBuilderOptions {
  /**
   * Desired indentation character for aggregated lines of code
   * @default ''
   */
  indent?: string;

  /**
   * Desired character to join each line of code
   * @default \n
   */
  join?: string;
}

/**
 * Small helper to format and aggregate lines of code. Lines are aggregated
 * in a `code` array; call `join()` to obtain the final snippet string.
 */
export class CodeBuilder {
  code: string[] = [];

  indentationCharacter: string;

  lineJoin: string;

  constructor({ indent, join }: CodeBuilderOptions = {}) {
    this.indentationCharacter = indent ?? DEFAULT_INDENTATION_CHARACTER;
    this.lineJoin = join ?? DEFAULT_LINE_JOIN;
  }

  private indentLine = (line: string, indentationLevel = 0): string => {
    return `${this.indentationCharacter.repeat(indentationLevel)}${line}`;
  };

  push = (line: string, indentationLevel = 0): void => {
    this.code.push(this.indentLine(line, indentationLevel));
  };

  blank = (): void => {
    this.code.push("");
  };

  join = (): string => {
    return this.code.join(this.lineJoin);
  };
}
