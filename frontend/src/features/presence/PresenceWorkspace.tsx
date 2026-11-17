import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  ArrowUp,
  Check,
  ChevronLeft,
  Keyboard,
  Menu,
  Mic,
  Square,
  X,
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
}
const labels: Record<CoreState, string> = {
  standby: "Tap to speak",
  listening: "Listening",
  transcribing: "Transcribing",
  thinking: "Thinking",
  synthesizing: "Preparing voice",
  speaking: "Speaking",
  approval: "Your confirmation is needed",
  error: "Connection needs attention",
};
export function PresenceWorkspace(p: Props) {
  const [menu, setMenu] = useState(false),
    [transcript, setTranscript] = useState(false),
    [typing, setTyping] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null),
    menuPanel = useRef<HTMLDivElement>(null),
    tail = useRef<HTMLDivElement>(null),
    textInput = useRef<HTMLInputElement>(null),
    upload = useRef<HTMLInputElement>(null);
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
    if (transcript)
      tail.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [p.messages, transcript]);
  useEffect(() => {
    if (typing) textInput.current?.focus();
  }, [typing]);
  useEffect(() => {
    if (!transcript) return;
    const panel = dialog.current;
    panel?.querySelector<HTMLButtonElement>("button")?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],summary,input:not(:disabled),[tabindex="0"]',
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
  const lastAssistant = p.messages.findLast(
    (m) => m.role === "assistant" && m.content,
  );
  const lastUser = p.messages.findLast((m) => m.role === "user");
  const stop = p.busy || p.state === "speaking";
  const microphoneLabel = p.recording
    ? "Finish recording"
    : p.busy
      ? "Cancel request"
      : p.state === "speaking"
        ? "Stop speaking"
        : "Start recording";
  const action = (fn: () => void) => {
    setMenu(false);
    fn();
  };
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
          {menu ? (
            <X size={20} strokeWidth={1.4} />
          ) : (
            <Menu size={20} strokeWidth={1.4} />
          )}
        </button>
        {menu && (
          <div
            className="quiet-menu"
            id="assistant-menu"
            ref={menuPanel}
            aria-label="Assistant options"
          >
            <div className="quiet-menu-group">
              <button
                disabled={p.busy || p.recording}
                onClick={() => action(p.onNew)}
              >
                New conversation
              </button>
              <button onClick={() => action(() => setTranscript(true))}>
                Conversation
              </button>
              <button
                onClick={() =>
                  action(() => {
                    setTyping(true);
                  })
                }
              >
                Type a message
              </button>
            </div>
            <div className="quiet-menu-group">
              {[
                ["Memory", "Saved conversations"],
                ["Coding assistant", "Coding"],
                ["Internet research", "Research"],
                ["Approvals", "Review changes"],
              ].map(([page, label]) => (
                <button
                  key={page}
                  disabled={p.busy || p.recording}
                  onClick={() => action(() => p.onNavigate(page))}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="quiet-menu-group">
              <button
                onClick={() => p.setVoiceEnabled(!p.voiceEnabled)}
                aria-pressed={p.voiceEnabled}
              >
                Spoken responses {p.voiceEnabled && <Check size={14} />}
              </button>
              {p.canReplay && (
                <button
                  disabled={p.busy || p.recording}
                  onClick={() => action(p.onReplay)}
                >
                  Replay response
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
          aria-label={microphoneLabel}
          onClick={p.recording ? p.onRecord : stop ? p.onStop : p.onRecord}
        >
          {p.recording || stop ? (
            <Square size={16} strokeWidth={1.4} />
          ) : (
            <Mic size={20} strokeWidth={1.35} />
          )}
        </button>
        <div className="quiet-response" aria-live={p.busy ? "off" : "polite"}>
          {p.recording ? (
            <p className="quiet-hint">Tap again when you’ve finished.</p>
          ) : lastAssistant ? (
            <p>
              {lastAssistant.content.slice(0, 360)}
              {lastAssistant.content.length > 360 ? "…" : ""}
            </p>
          ) : lastUser && p.busy ? (
            <p className="quiet-heard">{lastUser.content}</p>
          ) : null}
          {p.state === "approval" && (
            <button
              className="quiet-review"
              onClick={() => p.onNavigate("Approvals")}
            >
              Review proposed change
            </button>
          )}
        </div>
      </div>
      <div className="quiet-input-area">
        {typing || p.input ? (
          <form
            className="quiet-input"
            onSubmit={(e) => {
              e.preventDefault();
              p.onSend();
            }}
          >
            <input
              ref={textInput}
              aria-label="Message J.A.R.V.I.S."
              value={p.input}
              onChange={(e) => p.setInput(e.target.value)}
              placeholder="Message J.A.R.V.I.S."
              maxLength={12000}
              disabled={p.recording}
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
              <X size={16} />
            </button>
          </form>
        ) : (
          <button className="quiet-type-toggle" onClick={() => setTyping(true)}>
            <Keyboard size={15} strokeWidth={1.3} />
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
              <ChevronLeft size={18} />
              Conversation
            </button>
          </header>
          <div className="quiet-transcript-feed">
            {p.messages.length === 0 ? (
              <p className="quiet-transcript-empty">
                Your conversation will appear here.
              </p>
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
                      <summary>Tool results</summary>
                      <Output value={m.events} />
                    </details>
                  )}
                </article>
              ))
            )}
            <div ref={tail} />
          </div>
        </div>
      )}
    </section>
  );
}
