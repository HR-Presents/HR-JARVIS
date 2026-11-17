import type { Dispatch, SetStateAction } from "react";
type Setter<T> = Dispatch<SetStateAction<T>>;
import { ArrowRight } from "lucide-react";
interface Props {
  agentMode: boolean;
  setAgentMode: (value: boolean) => void;
  base: string;
  setBase: Setter<string>;
  setNotice: Setter<string>;
  setError: Setter<string>;
  refresh: () => Promise<void>;
  streaming: boolean;
  setStreaming: Setter<boolean>;
}
export function SettingsPage({
  agentMode,
  setAgentMode,
  base,
  setBase,
  setNotice,
  setError,
  refresh,
  streaming,
  setStreaming,
}: Props) {
  return (
    <section className="tool-page">
      <h2>Backend connection</h2>
      <p>Connect this interface to your J.A.R.V.I.S. FastAPI server.</p>
      <label>
        API base URL
        <input
          value={base}
          onChange={(e) => setBase(e.target.value)}
          placeholder="http://127.0.0.1:8100"
        />
      </label>
      <button
        className="primary"
        onClick={() => {
          try {
            const url = new URL(base);
            if (
              !["http:", "https:"].includes(url.protocol) ||
              url.username ||
              url.password
            )
              throw new Error();
            localStorage.setItem("jarvis-api-base", base.replace(/\/$/, ""));
            setNotice("Connection saved. Checking services…");
            void refresh();
          } catch {
            setError(
              "Enter a valid HTTP or HTTPS server URL without credentials.",
            );
          }
        }}
      >
        Save connection <ArrowRight size={15} />
      </button>
      <div className="info-block">
        <label className="check-label">
          <input
            type="checkbox"
            checked={agentMode}
            onChange={(e) => setAgentMode(e.target.checked)}
          />{" "}
          Enable the supervised agent and its tools
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={streaming}
            onChange={(e) => setStreaming(e.target.checked)}
          />{" "}
          Stream ordinary chat responses (when tools are off)
        </label>
        <h3>Connect from your machine</h3>
        <p>
          A hosted HTTPS interface may be blocked from reaching an HTTP
          localhost backend. For reliable local use, run the frontend locally
          with the Vite proxy. The backend must allow the frontend origin
          through CORS when connecting directly.
        </p>
        <p>
          Windows wake-word listening and desktop automation belong to the
          separate native client. They are not enabled here.
        </p>
      </div>
    </section>
  );
}
