import type { ReactNode } from "react";
import { safeUrl } from "../services/api";
function inline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/g)
    .map((part, i) => {
      if (part.startsWith("**"))
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
      if (link)
        return (
          <a key={i} href={safeUrl(link[2])} target="_blank" rel="noreferrer">
            {link[1]}
          </a>
        );
      return part;
    });
}
export function Markdown({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  text.split(/(```[\s\S]*?```)/g).forEach((part, i) => {
    if (part.startsWith("```")) {
      nodes.push(
        <pre key={i}>
          <code>{part.replace(/^```[^\n]*\n?/, "").replace(/```$/, "")}</code>
        </pre>,
      );
      return;
    }
    const lines = part.split("\n");
    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      if (!line.trim()) continue;
      if (/^[-*] /.test(line) || /^\d+\. /.test(line)) {
        const ordered = /^\d+\. /.test(line);
        const items: ReactNode[] = [];
        while (
          j < lines.length &&
          (ordered ? /^\d+\. / : /^[-*] /).test(lines[j])
        ) {
          items.push(
            <li key={j}>{inline(lines[j].replace(/^(?:[-*]|\d+\.) /, ""))}</li>,
          );
          j++;
        }
        j--;
        nodes.push(
          ordered ? (
            <ol key={`${i}-${j}`}>{items}</ol>
          ) : (
            <ul key={`${i}-${j}`}>{items}</ul>
          ),
        );
      } else if (/^#{1,6} /.test(line))
        nodes.push(
          <h3 key={`${i}-${j}`}>{inline(line.replace(/^#+ /, ""))}</h3>,
        );
      else if (line.startsWith("> "))
        nodes.push(
          <blockquote key={`${i}-${j}`}>{inline(line.slice(2))}</blockquote>,
        );
      else nodes.push(<p key={`${i}-${j}`}>{inline(line)}</p>);
    }
  });
  return <div className="markdown">{nodes}</div>;
}
