import type { Dispatch, SetStateAction } from "react";
type Setter<T> = Dispatch<SetStateAction<T>>;
import { Check, RefreshCw, ShieldCheck } from "lucide-react";
import type { Approval } from "../../types/api";
import { request } from "../../services/api";
import { Output, DiffPreview } from "../../components/Common";
interface Props {
  approvals: Approval[];
  selected: Approval | undefined;
  setSelected: Setter<Approval | undefined>;
  diff: unknown;
  setDiff: Setter<unknown>;
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<void>;
  loadApprovals: () => Promise<void>;
  setNotice: Setter<string>;
}
export function ApprovalsPage({
  approvals,
  selected,
  setSelected,
  diff,
  setDiff,
  busy,
  run,
  loadApprovals,
  setNotice,
}: Props) {
  return (
    <section className="tool-page">
      <div className="section-line">
        <p>Every proposed change deserves your attention.</p>
        <button onClick={() => void run(loadApprovals)} disabled={busy}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      <div className="split">
        <div className="record-list">
          {approvals.length === 0 && (
            <div className="empty">
              <ShieldCheck size={28} />
              <h3>No proposals to display</h3>
              <p>
                Proposed changes from the coding agent appear here after the
                backend returns them.
              </p>
            </div>
          )}
          {approvals.map((a) => (
            <button
              key={a.id}
              disabled={busy}
              className="record"
              onClick={() =>
                void run(async () => {
                  setSelected(undefined);
                  setDiff(undefined);
                  const d = await request<Approval>(
                    "/api/agent/approvals/" + encodeURIComponent(a.id),
                  );
                  setSelected(d);
                  try {
                    setDiff(
                      await request("/api/coding/diff", {
                        path: d.path,
                        proposed_content: d.content || "",
                      }),
                    );
                  } catch {
                    setDiff(
                      "Diff unavailable for this file type. Review the full proposed content below.",
                    );
                  }
                })
              }
            >
              <span>{a.path}</span>
              <small>{a.status}</small>
            </button>
          ))}
        </div>
        {selected && (
          <div className="proposal">
            <h3>{selected.path}</h3>
            <p>{selected.reason}</p>
            <span className="tag">{selected.status}</span>
            <h4>Change preview</h4>
            <DiffPreview value={diff} />
            <h4>Proposed content</h4>
            <Output value={selected.content} />
            {selected.status === "pending" && (
              <div className="actions">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await request(
                        "/api/agent/approvals/" +
                          encodeURIComponent(selected.id) +
                          "/approve",
                        {},
                      );
                      setSelected(undefined);
                      await loadApprovals();
                      setNotice(
                        "Backend confirmed approval and file write. Please verify the resulting file.",
                      );
                    })
                  }
                >
                  <Check size={15} /> Approve and apply
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await request(
                        "/api/agent/approvals/" +
                          encodeURIComponent(selected.id) +
                          "/reject",
                        {},
                      );
                      setSelected(undefined);
                      await loadApprovals();
                      setNotice("Proposal rejected.");
                    })
                  }
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
