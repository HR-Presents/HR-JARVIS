import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Menu,
  Mic,
  Square,
  X,
  Volume2,
  Play,
} from "lucide-react";
import { IntelligenceCore } from "./IntelligenceCore";
import type { CoreState } from "./IntelligenceCore";
import type { Message, Status } from "../../types/api";
import { Markdown, Output } from "../../components/Common";
interface Props {
  state: CoreState;
  analyser: RefObject<AnalyserNode | null>;
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  busy: boolean;
  recording: boolean;
  online: boolean;
  modelReady: boolean;
  voiceReady: boolean;
  model: string;
  statuses: Record<string, Status | null>;
  onRecord: () => void;
  onSend: () => void;
  onStop: () => void;
  onReplay: () => void;
  canReplay: boolean;
  onNavigate: (page: string) => void;
  voiceEnabled: boolean;
  setVoiceEnabled: (value: boolean) => void;
  onUpload: (file: File) => void;
  onNew: () => void;
  agentMode: boolean;
  setAgentMode: (value: boolean) => void;
}
const labels: Record<CoreState, string> = {
  standby: "At your service.",
  listening: "I’m listening.",
  transcribing: "Understanding your words.",
  thinking: "Thinking it through.",
  synthesizing: "Preparing your response.",
  speaking: "Speaking.",
  approval: "A decision for you.",
  error: "Let’s reconnect.",
};
export function PresenceWorkspace(p: Props) {
  const [menu, setMenu] = useState(false),
    [transcript, setTranscript] = useState(false),
    [typing, setTyping] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null),
    menuPanel = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLDivElement>(null),
    tail = useRef<HTMLDivElement>(null),
    textInput = useRef<HTMLTextAreaElement>(null),
    upload = useRef<HTMLInputElement>(null);
  const last = p.messages.findLast((m) => m.role === "assistant" && m.content),
    lastUser = p.messages.findLast((m) => m.role === "user");
  const recentEvents =
    p.messages.findLast((m) => m.events?.length)?.events || [];
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        setTranscript(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (
        !menuPanel.current?.contains(e.target as Node) &&
        !menuButton.current?.contains(e.target as Node)
      )
        setMenu(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);
  useEffect(() => {
    if (typing) textInput.current?.focus();
  }, [typing]);
  useEffect(() => {
    if (transcript)
      tail.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [p.messages, transcript]);
  useEffect(() => {
    if (!transcript) return;
    const panel = dialog.current;
    panel?.querySelector<HTMLButtonElement>("button")?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],summary,[tabindex="0"]',
        ),
      );
      const first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    panel?.addEventListener("keydown", trap);
    return () => panel?.removeEventListener("keydown", trap);
  }, [transcript]);
  const action = (fn: () => void) => {
    setMenu(false);
    fn();
  };
  const stop = p.busy || p.state === "speaking";
  const showInput = typing || !!p.input;
  return (
    <section
      className={"quiet-workspace quiet-" + p.state}
      aria-label="J.A.R.V.I.S. assistant"
    >
      <header className="quiet-header">
        <div className="quiet-brand">
          <h1>J.A.R.V.I.S.</h1>
          <span>HR-PRESENTS</span>
        </div>
        <button
          ref={menuButton}
          className="quiet-menu-trigger"
          aria-label="Open assistant menu"
          aria-expanded={menu}
          aria-controls="assistant-menu"
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X size={19} /> : <Menu size={20} strokeWidth={1.4} />}
        </button>
        {menu && (
          <div
            className="quiet-menu"
            id="assistant-menu"
            ref={menuPanel}
            aria-label="Assistant options"
          >
            <div className="quiet-menu-heading">
              Your workspace{" "}
              <span
                className={"menu-connection " + (p.online ? "connected" : "")}
              >
                {p.online ? "Connected" : "Offline"}
              </span>
            </div>
            <div className="quiet-menu-group">
              <button
                disabled={p.busy || p.recording}
                onClick={() => action(p.onNew)}
              >
                New conversation <span>↗</span>
              </button>
              <button onClick={() => action(() => setTranscript(true))}>
                Conversation <span>{p.messages.length}</span>
              </button>
              <button onClick={() => action(() => setTyping(true))}>
                Write a message <Keyboard size={13} />
              </button>
            </div>
            <div className="quiet-menu-group">
              {[
                ["Memory", "Memory"],
                ["Coding assistant", "Coding workspace"],
                ["Internet research", "Research"],
                ["Approvals", "Review changes"],
              ].map(([page, label]) => (
                <button
                  key={page}
                  disabled={p.busy || p.recording}
                  onClick={() => action(() => p.onNavigate(page))}
                >
                  {label}
                  <ChevronRight size={12} />
                </button>
              ))}
            </div>
            <div className="quiet-menu-group">
              <button
                onClick={() => p.setVoiceEnabled(!p.voiceEnabled)}
                aria-pressed={p.voiceEnabled}
              >
                Spoken responses {p.voiceEnabled && <Check size={13} />}
              </button>
              <button
                disabled={p.busy}
                onClick={() => p.setAgentMode(!p.agentMode)}
                aria-pressed={p.agentMode}
              >
                Agent tools {p.agentMode && <Check size={13} />}
              </button>
              {p.canReplay && (
                <button
                  disabled={p.busy || p.recording}
                  onClick={() => action(p.onReplay)}
                >
                  Replay last response <Play size={12} />
                </button>
              )}
              <button
                disabled={p.busy || p.recording}
                onClick={() => {
                  upload.current?.click();
                  setMenu(false);
                }}
              >
                Transcribe audio file
              </button>
            </div>
            <div className="quiet-menu-group">
              <button
                disabled={p.busy || p.recording}
                onClick={() => action(() => p.onNavigate("System status"))}
              >
                System status
              </button>
              <button
                disabled={p.busy || p.recording}
                onClick={() => action(() => p.onNavigate("Settings"))}
              >
                Settings
              </button>
            </div>
            <div className="quiet-menu-foot">
              {p.model}
              <span>
                {p.voiceReady ? "Voice configured" : "Piper not configured"}
              </span>
            </div>
          </div>
        )}
      </header>
      <div className="quiet-stage">
        <div className="quiet-form">
          <IntelligenceCore state={p.state} analyser={p.analyser} />
        </div>
        <div className="quiet-state" aria-live="polite">
          {labels[p.state]}
        </div>
        <button
          className={"quiet-mic " + (p.recording ? "is-recording" : "")}
          aria-label={
            p.recording
              ? "Finish recording"
              : p.busy
                ? "Cancel request"
                : p.state === "speaking"
                  ? "Stop speaking"
                  : "Start recording"
          }
          onClick={p.recording ? p.onRecord : stop ? p.onStop : p.onRecord}
        >
          {p.recording || stop ? (
            <Square size={15} />
          ) : (
            <Mic size={20} strokeWidth={1.4} />
          )}
        </button>
        {(last || lastUser) && (
          <div className="quiet-response" aria-live={p.busy ? "off" : "polite"}>
            {p.recording ? (
              <p className="quiet-hint">Tap again when you’ve finished.</p>
            ) : last ? (
              <p>
                {last.content.slice(0, 340)}
                {last.content.length > 340 ? "…" : ""}
              </p>
            ) : p.busy && lastUser ? (
              <p className="quiet-heard">{lastUser.content}</p>
            ) : null}
            {last && (
              <div className="response-actions">
                <button onClick={() => setTranscript(true)}>
                  View conversation <ChevronRight size={12} />
                </button>
                {p.canReplay && (
                  <button
                    aria-label="Replay response"
                    disabled={p.busy}
                    onClick={p.onReplay}
                  >
                    <Volume2 size={13} />
                  </button>
                )}
              </div>
            )}
            {recentEvents.length > 0 && (
              <button
                className="quiet-tool-result"
                onClick={() => setTranscript(true)}
              >
                {recentEvents.length} backend tool{" "}
                {recentEvents.length === 1 ? "result" : "results"}{" "}
                <ChevronRight size={11} />
              </button>
            )}
            {p.state === "approval" && (
              <button
                className="quiet-review"
                onClick={() => p.onNavigate("Approvals")}
              >
                Review proposed change <ChevronRight size={12} />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="quiet-input-area">
        {showInput ? (
          <form
            className="quiet-input"
            onSubmit={(e) => {
              e.preventDefault();
              p.onSend();
            }}
          >
            <textarea
              ref={textInput}
              aria-label="Message J.A.R.V.I.S."
              value={p.input}
              onChange={(e) => p.setInput(e.target.value)}
              placeholder="A thought, a question, a command…"
              maxLength={p.agentMode ? 12000 : 32000}
              rows={1}
              disabled={p.recording}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!p.busy && !p.recording) p.onSend();
                }
              }}
            />
            <button
              aria-label="Send message"
              disabled={!p.input.trim() || p.busy || p.recording}
            >
              <ArrowUp size={18} />
            </button>
            <button
              type="button"
              aria-label="Close text input"
              onClick={() => {
                setTyping(false);
                p.setInput("");
              }}
            >
              <X size={15} />
            </button>
          </form>
        ) : (
          <button className="quiet-type-toggle" onClick={() => setTyping(true)}>
            <Keyboard size={14} strokeWidth={1.2} />
            Type instead
          </button>
        )}
      </div>
      <input
        className="quiet-file-input"
        ref={upload}
        type="file"
        aria-label="Transcribe audio file"
        accept=".wav,.mp3,.m4a,.flac,.ogg,.webm"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) {
            p.onUpload(file);
            setTyping(true);
          }
        }}
      />
      {transcript && (
        <div
          ref={dialog}
          className="quiet-transcript"
          role="dialog"
          aria-modal="true"
          aria-label="Conversation transcript"
        >
          <header>
            <button
              aria-label="Close conversation"
              onClick={() => {
                setTranscript(false);
                menuButton.current?.focus();
              }}
            >
              <ChevronLeft size={17} />
              Conversation
            </button>
            <span>Session history</span>
          </header>
          <div className="quiet-transcript-feed">
            {!p.messages.length ? (
              <p className="quiet-transcript-empty">Start with a thought.</p>
            ) : (
              p.messages.map((m, i) => (
                <article key={i}>
                  <span className="quiet-role">
                    {m.role === "user" ? "You" : "J.A.R.V.I.S."}
                  </span>
                  <Markdown
                    text={
                      m.content ||
                      (p.busy ? "Processing…" : "No response received.")
                    }
                  />
                  {m.events && m.events.length > 0 && (
                    <details>
                      <summary>
                        Backend tool results · {m.events.length}
                      </summary>
                      <Output value={m.events} />
                    </details>
                  )}
                </article>
              ))
            )}
            <div ref={tail} />
          </div>
          <div className="transcript-assurance">
            This session is separate from saved Memory conversations.
          </div>
        </div>
      )}
    </section>
  );
}
