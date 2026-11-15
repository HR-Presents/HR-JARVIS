import type { Status } from "../../types/api";
import { Output } from "../../components/Common";
const services = ["health", "voice", "memory", "coding", "research", "agent"];
interface Props {
  statuses: Record<string, Status | null>;
  checked: boolean;
}
export function StatusPage({ statuses, checked }: Props) {
  return (
    <section className="tool-page">
      <p>A live view of your local intelligence stack.</p>
      <div className="status-table">
        {services.map((s) => (
          <div className="service-row" key={s}>
            <span className={"dot " + (statuses[s] ? "green" : "")} />
            <strong>
              {s === "health"
                ? "Backend / local model"
                : s.charAt(0).toUpperCase() + s.slice(1) + " service"}
            </strong>
            <span>
              {!checked
                ? "Checking"
                : statuses[s]
                  ? "Endpoint reachable"
                  : "Unreachable"}
            </span>
            <details>
              <summary>Details</summary>
              <Output value={statuses[s] || "No response from backend"} />
            </details>
          </div>
        ))}
      </div>
      <p className="muted">
        Reachability confirms an endpoint responded. Model readiness and Piper
        configuration are reported separately in the returned details.
      </p>
    </section>
  );
}
