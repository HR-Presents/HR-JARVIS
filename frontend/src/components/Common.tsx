import { Component } from "react";
import type { ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="fatal">
        <h1>Workspace interrupted</h1>
        <p>Reload to restore the interface.</p>
        <button onClick={() => location.reload()}>Reload</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export function Output({ value }: { value: unknown }) {
  return (
    <pre className="output">
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}
export { Markdown } from "./Markdown";
export function DiffPreview({ value }: { value: unknown }) {
  const data = value as
    | { diff?: string; valid_proposed_syntax?: boolean; syntax_error?: unknown }
    | undefined;
  if (!data || typeof data.diff !== "string") return <Output value={value} />;
  return (
    <div>
      <p className="muted">
        Preview only ·{" "}
        {data.valid_proposed_syntax
          ? "Proposed Python syntax is valid"
          : "Proposed Python syntax has errors"}
      </p>
      {Boolean(data.syntax_error) && <Output value={data.syntax_error} />}
      <pre className="diff">
        {data.diff
          ? data.diff.split("\n").map((line, i) => (
              <span
                key={i}
                className={
                  line.startsWith("+")
                    ? "added"
                    : line.startsWith("-")
                      ? "removed"
                      : line.startsWith("@@")
                        ? "hunk"
                        : ""
                }
              >
                {line || " "}
                <br />
              </span>
            ))
          : "No changes."}
      </pre>
    </div>
  );
}
