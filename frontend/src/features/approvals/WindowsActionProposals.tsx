import { useEffect, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { request } from "../../services/api";

type WindowsProposal = {
  id: string;
  action: { type: string; target: string };
  status: string;
  created_at: string;
};

export function WindowsActionProposals() {
  const [items, setItems] = useState<WindowsProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const data = await request<{ proposals: WindowsProposal[] }>(
        "/api/agent/windows/proposals",
      );
      setItems(data.proposals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load proposals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section className="tool-page" aria-label="Windows action proposals">
      <div className="section-line">
        <div>
          <h3>Windows Actions</h3>
          <p>Review AI-proposed desktop actions. Execution is not enabled here.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={15} />
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && <p role="alert">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <div className="empty">
          <ShieldCheck size={28} />
          <h3>No Windows proposals</h3>
          <p>Proposed applications and websites will appear here.</p>
        </div>
      )}

      <div className="record-list" style={{ width: "100%", maxWidth: "none" }}>
        {items.map((item) => (
          <div className="record" key={item.id}>
            <span>
              {item.action.type === "open_app" ? "Open application" : "Open website"}
              {" — "}
              {item.action.target}
            </span>
            <small>
              {item.status} · {new Date(item.created_at).toLocaleString()}
            </small>
            <small>Read-only proposal. No action has been executed.</small>
          </div>
        ))}
      </div>
    </section>
  );
}
