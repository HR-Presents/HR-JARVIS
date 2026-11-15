import type { Dispatch, SetStateAction } from "react";
type Setter<T> = Dispatch<SetStateAction<T>>;
import { ArrowRight, Globe, Search } from "lucide-react";
import type { Research } from "../../types/api";
import { request, safeUrl } from "../../services/api";
import { Markdown } from "../../components/Common";
interface Props {
  input: string;
  setInput: Setter<string>;
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<void>;
  research: Research | undefined;
  setResearch: Setter<Research | undefined>;
}
export function ResearchPage({
  input,
  setInput,
  busy,
  run,
  research,
  setResearch,
}: Props) {
  return (
    <section className="tool-page">
      <p>Explore the web with traceable sources.</p>
      <form
        className="search-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () =>
            setResearch(
              await request<Research>("/api/research/answer", {
                query: input,
                max_results: 5,
              }),
            ),
          );
        }}
      >
        <Search size={18} />
        <input
          aria-label="Research query"
          minLength={2}
          maxLength={300}
          required
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What would you like to investigate?"
        />
        <button disabled={busy} className="primary">
          {busy ? "Researching…" : "Research"} <ArrowRight size={16} />
        </button>
        <button
          type="button"
          disabled={busy || input.trim().length < 2}
          onClick={() =>
            void run(async () =>
              setResearch(
                await request<Research>("/api/research/search", {
                  query: input,
                  max_results: 5,
                }),
              ),
            )
          }
        >
          Search only
        </button>
      </form>
      <div className="evidence-note">
        <Globe size={15} /> Search snippets · Full webpages have not been
        verified
      </div>
      {research?.answer && (
        <div className="research-answer">
          <Markdown text={research.answer} />
        </div>
      )}
      {research &&
        (research.sources || research.results || []).length === 0 && (
          <p>No results returned. Try a more specific query.</p>
        )}
      {(research?.sources || research?.results || []).map((s, i) => (
        <article className="source" key={i}>
          <span className="source-number">{s.citation || `[${i + 1}]`}</span>
          <div>
            <a href={safeUrl(s.url)} target="_blank" rel="noreferrer">
              {s.title} ↗
            </a>
            <small>{s.url}</small>
            <p>{s.snippet}</p>
          </div>
        </article>
      ))}
      {!research && (
        <div className="research-empty">
          <Globe size={44} />
          <h2>Good answers start with evidence.</h2>
          <p>Search the web, compare sources, and ask for a cited synthesis.</p>
        </div>
      )}
    </section>
  );
}
