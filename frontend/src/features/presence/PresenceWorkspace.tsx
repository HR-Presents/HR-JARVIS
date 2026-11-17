import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  ArrowUp,
  AudioLines,
  ChevronRight,
  Code2,
  FileAudio,
  Globe,
  History,
  MessageSquare,
  Mic,
  PanelRightClose,
  Play,
  ShieldCheck,
  Square,
  Volume2,
  VolumeX,
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
}
const labels: Record<CoreState, [string, string]> = {
  standby: ["At your service.", "Speak your mind. Let’s take it from here."],
  listening: [
    "I’m listening.",
    "Speak naturally. Tap the core when you’re finished.",
  ],
  transcribing: [
    "Catching every word.",
    "Your recording is being transcribed on the backend.",
  ],
  thinking: [
    "Thinking it through.",
    "Your request is being processed by the local AI.",
  ],
  synthesizing: [
    "Finding my voice.",
    "The speech engine is preparing your response.",
  ],
  speaking: ["Here’s what I found.", "You can interrupt my voice at any time."],
  approval: [
    "Your decision.",
    "A proposed change needs your explicit approval.",
  ],
  error: [
    "Let’s reconnect.",
    "Check the message above or open connection settings.",
  ],
};
export function PresenceWorkspace(p: Props) {
  const [transcript, setTranscript] = useState(false),
    [upload, setUpload] = useState(false);
  const tail = useRef<HTMLDivElement>(null);
  const transcriptButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!transcript) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTranscript(false);
        transcriptButton.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [transcript]);
  useEffect(() => {
    if (transcript)
      tail.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [p.messages, transcript]);
  const lastAssistant = p.messages.findLast(
      (m) => m.role === "assistant" && m.content,
    ),
    lastUser = p.messages.findLast((m) => m.role === "user");
  const eventMessage = p.messages.findLast((m) => m.events?.length);
  const events = (eventMessage?.events || []) as {
    tool?: string;
    result?: unknown;
  }[];
  const state = p.state;
  return (
    <section
      className={
        "presence-workspace state-" +
        state +
        (transcript ? " transcript-open" : "")
      }
      aria-label="J.A.R.V.I.S. voice command space"
    >
      <div className="presence-masthead">
        <div>
          <span className="presence-overline">
            HR-PRESENTS / PERSONAL INTELLIGENCE
          </span>
          <h1>
            J.A.R.V.I.S.<span>01</span>
          </h1>
        </div>
        <button
          className={"transcript-toggle " + (transcript ? "selected" : "")}
          onClick={() => setTranscript(!transcript)}
          aria-expanded={transcript}
        >
          <MessageSquare size={15} />
          <span>Conversation</span>
          <span className="message-count">{p.messages.length}</span>
        </button>
      </div>
      <div className="presence-body">
        <div className="presence-stage">
          <div className="core-meta">
            <span className={"core-state-dot " + state} />
            {state === "standby"
              ? p.modelReady
                ? "READY WHEN YOU ARE"
                : "STANDBY"
              : state.toUpperCase()}
            <span className="core-meta-divider" />
            {p.recording
              ? "MICROPHONE ACTIVE"
              : state === "speaking"
                ? "AUDIO OUTPUT ACTIVE"
                : "VOICE INTERFACE"}
          </div>
          <div className="core-scene">
            <div className="core-crosshair crosshair-tl" />
            <div className="core-crosshair crosshair-br" />
            <span className="core-coordinate left">J / 01</span>
            <span className="core-coordinate right">HR-P</span>
            <IntelligenceCore state={state} analyser={p.analyser} />
            <button
              className="core-interaction"
              aria-label={
                p.recording
                  ? "Finish recording"
                  : state === "speaking"
                    ? "Interrupt and start recording"
                    : "Start voice conversation"
              }
              onClick={p.onRecord}
              disabled={p.busy}
            >
              <span className="core-glyph">
                {p.recording ? (
                  <Square size={22} strokeWidth={1.2} />
                ) : (
                  <AudioLines size={35} strokeWidth={1.2} />
                )}
              </span>
              <span className="core-interaction-label">
                {p.recording
                  ? "FINISH"
                  : state === "speaking"
                    ? "INTERRUPT"
                    : "TAP TO SPEAK"}
              </span>
            </button>
            <div className="core-baseline" />
          </div>
          <div className="presence-copy" aria-live="polite">
            <h2>{labels[state][0]}</h2>
            <p>{labels[state][1]}</p>
          </div>
          {(lastUser || lastAssistant) && (
            <div className="live-exchange">
              <div className="live-exchange-label">
                <span className={p.busy ? "live-pulse" : ""} />
                {p.busy ? "CURRENT REQUEST" : "LATEST EXCHANGE"}
                <button onClick={() => setTranscript(true)}>
                  Full conversation <ChevronRight size={12} />
                </button>
              </div>
              {lastUser && (
                <p className="heard">
                  <span>YOU</span>
                  {lastUser.content}
                </p>
              )}
              {lastAssistant && (
                <div className="spoken">
                  <span>J.A.R.V.I.S.</span>
                  <div>
                    {lastAssistant.content.slice(0, 420)}
                    {lastAssistant.content.length > 420 ? "…" : ""}
                  </div>
                </div>
              )}
            </div>
          )}
          {state === "approval" && (
            <button
              className="review-proposal"
              onClick={() => p.onNavigate("Approvals")}
            >
              <ShieldCheck size={15} /> Review proposed changes{" "}
              <ChevronRight size={14} />
            </button>
          )}
          {events.length > 0 && (
            <div className="activity-ribbon">
              {events.slice(-3).map((e, i) => (
                <button key={i} onClick={() => setTranscript(true)}>
                  <span /> {e.tool?.replaceAll("_", " ") || "Tool result"}{" "}
                  <ChevronRight size={12} />
                </button>
              ))}
            </div>
          )}
          {!lastUser && (
            <div className="presence-shortcuts">
              <button
                onClick={() => {
                  p.setInput(
                    "Help me plan my day. Ask me about my priorities.",
                  );
                }}
              >
                <History size={14} /> Plan my day
              </button>
              <button onClick={() => p.onNavigate("Coding assistant")}>
                <Code2 size={14} /> Work on code
              </button>
              <button onClick={() => p.onNavigate("Internet research")}>
                <Globe size={14} /> Explore an idea
              </button>
            </div>
          )}
        </div>
        {transcript && (
          <aside
            className="transcript-drawer"
            aria-label="Conversation transcript"
          >
            <header>
              <div>
                <span>SESSION TRANSCRIPT</span>
                <strong>Our conversation</strong>
              </div>
              <button
                aria-label="Close transcript"
                onClick={() => setTranscript(false)}
                className="icon"
              >
                <PanelRightClose size={18} />
              </button>
            </header>
            <div className="transcript-feed">
              {p.messages.length === 0 ? (
                <div className="transcript-empty">
                  <MessageSquare size={24} />
                  <p>
                    Your conversation appears here.
                    <br />
                    Voice and text share the same session.
                  </p>
                </div>
              ) : (
                p.messages.map((m, i) => (
                  <article key={i} className={"transcript-message " + m.role}>
                    <div className="transcript-role">
                      {m.role === "user" ? "YOU" : "J.A.R.V.I.S."}
                    </div>
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
            <div className="transcript-footer">
              <ShieldCheck size={12} /> Session history · Memory is a separate
              workspace
            </div>
          </aside>
        )}
      </div>
      <div className="presence-dock">
        <div className="voice-toolbar">
          <div className="voice-options">
            <button
              className={
                p.voiceEnabled ? "voice-switch enabled" : "voice-switch"
              }
              aria-pressed={p.voiceEnabled}
              onClick={() => p.setVoiceEnabled(!p.voiceEnabled)}
            >
              {p.voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              <span>Voice response</span>
              <span className="switch-track" />
            </button>
            {p.canReplay && (
              <button
                className="replay-control"
                onClick={p.onReplay}
                disabled={p.busy || p.recording}
              >
                <Play size={13} />
                Replay
              </button>
            )}
            {(state === "speaking" || p.busy) && (
              <button className="stop-control" onClick={p.onStop}>
                <Square size={12} />{" "}
                {state === "speaking" ? "Stop voice" : "Cancel request"}
              </button>
            )}
          </div>
          <button
            className="upload-control"
            onClick={() => setUpload(!upload)}
            aria-expanded={upload}
          >
            <FileAudio size={14} />
            <span>Audio file</span>
          </button>
        </div>
        {upload && (
          <div className="presence-upload">
            <label>
              Transcribe a recording
              <input
                type="file"
                accept=".wav,.mp3,.m4a,.flac,.ogg,.webm"
                disabled={p.busy || p.recording}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) p.onUpload(file);
                }}
              />
            </label>
            <button
              className="icon"
              onClick={() => setUpload(false)}
              aria-label="Close audio upload"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <form
          className="presence-composer"
          onSubmit={(e) => {
            e.preventDefault();
            p.onSend();
          }}
        >
          <button
            className={"dock-mic " + (p.recording ? "recording" : "")}
            type="button"
            aria-label={p.recording ? "Finish recording" : "Start recording"}
            onClick={p.onRecord}
            disabled={p.busy}
          >
            {p.recording ? <Square size={17} /> : <Mic size={20} />}
          </button>
          <input
            aria-label="Message J.A.R.V.I.S."
            placeholder="Or type a thought, a question, a command…"
            maxLength={12000}
            value={p.input}
            onChange={(e) => p.setInput(e.target.value)}
            disabled={p.recording}
          />
          <kbd>↵</kbd>
          <button
            className="dock-send"
            aria-label="Send message"
            disabled={p.busy || p.recording || !p.input.trim()}
          >
            <ArrowUp size={18} />
          </button>
        </form>
        <div className="presence-dock-footer">
          <span>
            <span className={"dot " + (p.modelReady ? "green" : "")} />
            {p.model} <span className="dock-divider">/</span>{" "}
            {p.modelReady ? "Model available" : "Model not verified"}
            {!p.voiceReady && (
              <span className="speech-unavailable">
                {" "}
                · Speech not configured
              </span>
            )}
          </span>
          <span>
            CLICK TO TALK <span className="dock-divider">·</span> YOU’RE IN
            CONTROL
          </span>
        </div>
      </div>
    </section>
  );
}
