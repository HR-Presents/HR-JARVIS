import { ResearchPage } from "./features/research/ResearchPage";
import { ApprovalsPage } from "./features/approvals/ApprovalsPage";
import { StatusPage } from "./features/status/StatusPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  AudioLines,
  BrainCircuit,
  Check,
  ChevronDown,
  Code2,
  Command,
  Globe,
  History,
  Menu,
  MessageSquare,
  Mic,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Square,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { getBase, request, stream } from "./services/api";
import type {
  Approval,
  Conversation,
  Message,
  Reply,
  Research,
  Status,
  VoiceReply,
} from "./types/api";
import { ErrorBoundary, Markdown, Output } from "./components/Common";
import "./App.css";
const navigation = [
  { id: "Assistant", icon: MessageSquare },
  { id: "Voice assistant", icon: AudioLines },
  { id: "Memory", icon: History },
  { id: "Coding assistant", icon: Code2 },
  { id: "Internet research", icon: Globe },
  { id: "Approvals", icon: ShieldCheck },
];
const services = ["health", "voice", "memory", "coding", "research", "agent"];
const descriptions: Record<string, string> = {
  "Voice assistant":
    "A natural conversation. Powered by your local voice engines.",
  Memory: "Pick up where you left off. Your conversations, on your machine.",
  "Coding assistant":
    "Understand, diagnose and improve your code. You stay in control.",
  "Internet research": "Explore the web with traceable sources.",
  Approvals: "Every proposed change deserves your attention.",
  "System status": "A live view of your local intelligence stack.",
  Settings: "Make this workstation yours.",
};
function App() {
  const [page, setPage] = useState("Assistant"),
    [menu, setMenu] = useState(false),
    [statuses, setStatuses] = useState<Record<string, Status | null>>({}),
    [checked, setChecked] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [input, setInput] = useState(""),
    [messages, setMessages] = useState<Record<string, Message[]>>({}),
    [memoryId, setMemoryId] = useState<string>(),
    [conversations, setConversations] = useState<Conversation[]>([]),
    [approvals, setApprovals] = useState<Approval[]>([]),
    [selected, setSelected] = useState<Approval>(),
    [diff, setDiff] = useState<unknown>(),
    [path, setPath] = useState("backend"),
    [codeQuery, setCodeQuery] = useState(""),
    [result, setResult] = useState<unknown>(),
    [research, setResearch] = useState<Research>(),
    [base, setBase] = useState(getBase()),
    [voiceState, setVoiceState] = useState("Ready to listen"),
    [recording, setRecording] = useState(false),
    [streaming, setStreaming] = useState(true);
  const operation = useRef(false);
  const recorder = useRef<MediaRecorder | null>(null),
    audio = useRef<HTMLAudioElement | null>(null),
    media = useRef<MediaStream | null>(null),
    abort = useRef<AbortController | null>(null),
    end = useRef<HTMLDivElement>(null);
  const channel =
    page === "Memory"
      ? "memory"
      : page === "Voice assistant"
        ? "voice"
        : page === "Coding assistant"
          ? "coding"
          : "chat";
  const feed = messages[channel] || [];
  const refresh = useCallback(async () => {
    const entries = await Promise.all(
      services.map(async (s) => {
        try {
          return [
            s,
            await request<Status>(
              s === "health" ? "/api/health" : `/api/${s}/status`,
              undefined,
              "GET",
              AbortSignal.timeout(6000),
            ),
          ] as const;
        } catch {
          return [s, null] as const;
        }
      }),
    );
    setStatuses(Object.fromEntries(entries));
    setChecked(true);
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const t = setInterval(() => void refresh(), 30000);
    return () => {
      clearTimeout(initial);
      clearInterval(t);
      abort.current?.abort();
      media.current?.getTracks().forEach((t) => t.stop());
      audio.current?.pause();
    };
  }, [refresh]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);
  const run = async (fn: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError")
        setNotice("Response stopped. Partial output is preserved.");
      else
        setError(
          e instanceof TypeError
            ? "Cannot reach your backend. Check the API URL, local server, and CORS configuration."
            : e instanceof Error
              ? e.message
              : "Request failed. Check your backend connection.",
        );
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };
  const loadMemory = async () => {
    const r = await request<{ conversations: Conversation[] }>(
      "/api/memory/conversations",
    );
    setConversations(r.conversations);
  };
  const loadApprovals = async () => {
    const r = await request<{ approvals: Approval[] }>("/api/agent/approvals");
    setApprovals(r.approvals);
  };
  const navigate = (p: string) => {
    if (recording || busy) return;
    setPage(p);
    setInput("");
    setMenu(false);
    setError("");
    setNotice("");
    if (p === "Memory") void run(loadMemory);
    if (p === "Approvals") void run(loadApprovals);
  };
  const send = () => {
    const message = input.trim();
    if (!message || operation.current) return;
    const history = feed.map(({ role, content }) => ({ role, content }));
    setInput("");
    setMessages((m) => ({
      ...m,
      [channel]: [...feed, { role: "user", content: message }],
    }));
    void run(async () => {
      if (channel === "chat" && streaming) {
        setMessages((m) => ({
          ...m,
          chat: [...m.chat, { role: "assistant", content: "" }],
        }));
        const c = new AbortController();
        abort.current = c;
        const timeout = setTimeout(() => c.abort(), 240000);
        try {
          await stream(
            message,
            history,
            (token) =>
              setMessages((m) => ({
                ...m,
                chat: m.chat.map((v, i) =>
                  i === m.chat.length - 1
                    ? { ...v, content: v.content + token }
                    : v,
                ),
              })),
            c.signal,
          );
        } finally {
          clearTimeout(timeout);
          abort.current = null;
        }
      } else {
        const r = await request<Reply>(
          channel === "memory"
            ? "/api/memory/chat"
            : channel === "chat"
              ? "/api/chat"
              : "/api/agent/chat",
          channel === "memory"
            ? { message, conversation_id: memoryId }
            : { message, history: history.slice(-30), context: path },
        );
        if (r.conversation_id) setMemoryId(r.conversation_id);
        setMessages((m) => ({
          ...m,
          [channel]: [
            ...(m[channel] || []),
            { role: "assistant", content: r.response, events: r.events },
          ],
        }));
        if (channel === "memory") await loadMemory();
      }
    });
  };
  const play = async (src: string) => {
    audio.current?.pause();
    const a = new Audio(src);
    audio.current = a;
    setVoiceState("Speaking");
    a.onended = () => setVoiceState("Ready to listen");
    try {
      await a.play();
    } catch {
      setVoiceState("Playback blocked");
      throw new Error(
        "Audio playback was blocked. Use the play button to listen.",
      );
    }
  };
  const toggleRecord = async () => {
    if (recording) {
      recorder.current?.stop();
      setRecording(false);
      return;
    }
    await run(async () => {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          "Microphone recording requires a supported browser and a secure connection.",
        );
      const device = await navigator.mediaDevices.getUserMedia({ audio: true });
      media.current = device;
      try {
        const mime = ["audio/webm", "audio/ogg"].find((x) =>
          MediaRecorder.isTypeSupported(x),
        );
        if (!mime)
          throw new Error(
            "This browser cannot record a supported WebM or Ogg format.",
          );
        const rec = new MediaRecorder(device, { mimeType: mime });
        recorder.current = rec;
        const chunks: Blob[] = [];
        rec.ondataavailable = (e) => chunks.push(e.data);
        rec.onerror = () => {
          device.getTracks().forEach((t) => t.stop());
          setRecording(false);
          setError("Microphone recording failed.");
        };
        rec.onstop = () => {
          device.getTracks().forEach((t) => t.stop());
          setRecording(false);
          void run(async () => {
            setVoiceState("Processing");
            const data = new FormData();
            data.append(
              "file",
              new Blob(chunks, { type: mime }),
              mime.includes("ogg") ? "recording.ogg" : "recording.webm",
            );
            data.append(
              "history",
              JSON.stringify(
                feed.map(({ role, content }) => ({ role, content })).slice(-20),
              ),
            );
            try {
              const r = await request<VoiceReply>("/api/voice/converse", data);
              setMessages((m) => ({
                ...m,
                voice: [
                  ...(m.voice || []),
                  { role: "user", content: r.transcription },
                  { role: "assistant", content: r.response, events: r.events },
                ],
              }));
              const src = "data:audio/wav;base64," + r.audio_base64;
              setLastAudio(src);
              await play(src);
            } finally {
              if (!audio.current || audio.current.paused)
                setVoiceState("Ready to listen");
            }
          });
        };
        rec.start();
        setRecording(true);
        setVoiceState("Listening");
      } catch (e) {
        device.getTracks().forEach((t) => t.stop());
        throw e;
      }
    });
  };
  const [lastAudio, setLastAudio] = useState("");
  const health = statuses.health,
    online = health?.backend === "online",
    modelReady =
      health?.ollama === "online" && health?.model_installed === true;
  const newChat = () => {
    if (busy || recording) return;
    if (
      !["Assistant", "Memory", "Coding assistant", "Voice assistant"].includes(
        page,
      )
    )
      setPage("Assistant");
    setInput("");
    if (page === "Voice assistant") {
      audio.current?.pause();
      setLastAudio("");
      setVoiceState("Ready to listen");
    }
    setMessages((m) => ({ ...m, [channel]: [] }));
    if (channel === "memory") setMemoryId(undefined);
    setError("");
    setNotice("New conversation started.");
  };
  return (
    <div className="shell">
      <aside className={menu ? "sidebar expanded" : "sidebar"}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("Assistant");
          }}
        >
          <div className="logo-mark">
            <Command size={23} />
          </div>
          <div>
            <b>J.A.R.V.I.S.</b>
            <small>BY HR-PRESENTS</small>
          </div>
          <span className="version">01</span>
        </a>
        <button
          className="new-chat"
          onClick={newChat}
          disabled={busy || recording}
        >
          <Plus size={17} /> New conversation <span>↗</span>
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {navigation.map(({ id, icon: Icon }) => (
            <button
              disabled={busy || recording}
              className={page === id ? "nav active" : "nav"}
              key={id}
              onClick={() => navigate(id)}
            >
              <Icon size={18} />
              {id}
              {page === id && <span className="active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className={page === "System status" ? "nav active" : "nav"}
            onClick={() => navigate("System status")}
          >
            <Activity size={18} />
            System status
            <span className={"dot " + (online ? "green" : "")} />
          </button>
          <button
            className={page === "Settings" ? "nav active" : "nav"}
            onClick={() => navigate("Settings")}
          >
            <Settings size={18} />
            Settings
          </button>
          <div className="local-info">
            <ShieldCheck size={16} />
            <div>
              <strong>Local by design</strong>
              <small>Your intelligence. Your control.</small>
            </div>
          </div>
          <div className="account">
            <div className="avatar">HR</div>
            <div>
              <strong>HR-Presents</strong>
              <small>Personal workspace</small>
            </div>
            <ChevronDown size={15} />
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile"
              aria-label="Toggle menu"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={19} />
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>{page}</strong>
          </div>
          <div className="top-actions">
            <span className="local-tag">
              <ShieldCheck size={13} />
              LOCAL-FIRST
            </span>
            <span className="connection">
              <span className={"dot " + (online ? "green" : "")} />
              {!checked
                ? "Checking connection"
                : online
                  ? "Backend connected"
                  : "Backend disconnected"}
            </span>
            <button
              className="icon"
              onClick={() => void refresh()}
              aria-label="Refresh services"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </header>
        <main>
          <div className="workspace-head">
            <div>
              <div className="eyebrow">
                PERSONAL INTELLIGENCE WORKSTATION <span>/ 01</span>
              </div>
              <h1>{page === "Assistant" ? "Assistant" : page}</h1>
            </div>
            <div className="model-pill">
              <span className={"dot " + (modelReady ? "green" : "")} />
              {typeof health?.model === "string" ? health.model : "Local model"}
              <span>{modelReady ? "Available" : "Not verified"}</span>
            </div>
          </div>
          {error && (
            <div className="alert" role="alert">
              <span>{error}</span>
              <button
                className="icon"
                onClick={() => setError("")}
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              <Check size={15} />
              {notice}
            </div>
          )}
          {page === "Settings" ? (
            <SettingsPage
              base={base}
              setBase={setBase}
              setNotice={setNotice}
              setError={setError}
              refresh={refresh}
              streaming={streaming}
              setStreaming={setStreaming}
            />
          ) : page === "System status" ? (
            <StatusPage statuses={statuses} checked={checked} />
          ) : page === "Approvals" ? (
            <ApprovalsPage
              approvals={approvals}
              selected={selected}
              setSelected={setSelected}
              diff={diff}
              setDiff={setDiff}
              busy={busy}
              run={run}
              loadApprovals={loadApprovals}
              setNotice={setNotice}
            />
          ) : page === "Internet research" ? (
            <ResearchPage
              input={input}
              setInput={setInput}
              busy={busy}
              run={run}
              research={research}
              setResearch={setResearch}
            />
          ) : (
            <>
              {page === "Memory" && (
                <div className="memory-bar">
                  <select
                    aria-label="Saved conversations"
                    value={memoryId || ""}
                    disabled={busy}
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) {
                        newChat();
                        return;
                      }
                      void run(async () => {
                        const r = await request<{ messages: Message[] }>(
                          "/api/memory/conversations/" + encodeURIComponent(id),
                        );
                        setMemoryId(id);
                        setMessages((m) => ({ ...m, memory: r.messages }));
                      });
                    }}
                  >
                    <option value="">New persistent conversation</option>
                    {conversations.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.created_at
                          ? new Date(c.created_at).toLocaleString() +
                            " · " +
                            c.message_count +
                            " messages"
                          : c.id}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={!memoryId || busy}
                    onClick={() =>
                      void run(async () => {
                        if (
                          !confirm(
                            "Delete this saved conversation permanently?",
                          )
                        )
                          return;
                        await request(
                          "/api/memory/conversations/" +
                            encodeURIComponent(memoryId!),
                          undefined,
                          "DELETE",
                        );
                        setMemoryId(undefined);
                        setMessages((m) => ({ ...m, memory: [] }));
                        await loadMemory();
                        setNotice("Conversation deleted.");
                      })
                    }
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                  <span className="muted">Stored by your backend · SQLite</span>
                </div>
              )}
              {page === "Coding assistant" && (
                <div className="coding-tools">
                  <label>
                    Project path
                    <input
                      value={path}
                      maxLength={500}
                      onChange={(e) => setPath(e.target.value)}
                    />
                  </label>
                  <label>
                    Search query
                    <input
                      value={codeQuery}
                      maxLength={200}
                      onChange={(e) => setCodeQuery(e.target.value)}
                      placeholder="Function, class, or symbol"
                    />
                  </label>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () =>
                        setResult(
                          await request("/api/coding/inspect", {
                            path,
                            max_files: 50,
                          }),
                        ),
                      )
                    }
                  >
                    Inspect
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () =>
                        setResult(
                          await request("/api/coding/diagnose", { path }),
                        ),
                      )
                    }
                  >
                    Diagnose file
                  </button>
                  <button
                    disabled={busy || codeQuery.length < 2}
                    onClick={() =>
                      void run(async () =>
                        setResult(
                          await request("/api/coding/search", {
                            path,
                            query: codeQuery,
                            max_matches: 30,
                          }),
                        ),
                      )
                    }
                  >
                    Search
                  </button>
                  <button
                    disabled={busy || !path.endsWith(".py")}
                    onClick={() =>
                      void run(async () => {
                        const r = await request<Reply>("/api/agent/chat", {
                          message: `Use execute_python to execute the existing file ${path}. Report actual stdout, stderr, timeout, and isolation results. Do not propose writes.`,
                          history: [],
                          context:
                            "Execute only through the isolated backend tool.",
                        });
                        setResult(r);
                      })
                    }
                  >
                    Run Python file
                  </button>
                  <p>
                    <ShieldCheck size={14} /> Execution uses the backend agent’s
                    isolated Python tool. Writes require approval.
                  </p>
                  {result !== undefined && (
                    <details open>
                      <summary>Analysis results</summary>
                      <Output value={result} />
                    </details>
                  )}
                </div>
              )}
              <div
                className={
                  "conversation " + (feed.length ? "has-messages" : "")
                }
              >
                {feed.length === 0 ? (
                  <div className="welcome">
                    <div className="welcome-top">
                      <span className="tiny-line" /> YOUR PERSONAL AI,
                      REIMAGINED
                    </div>
                    <div
                      className={
                        "intelligence-orb " + (recording ? "listening" : "")
                      }
                    >
                      <div className="orb-ring ring-one" />
                      <div className="orb-ring ring-two" />
                      <div className="orb-inner">
                        <AudioLines size={40} strokeWidth={1.2} />
                      </div>
                      <span className="orb-spark" />
                    </div>
                    <div className="welcome-label">
                      J.A.R.V.I.S. <span>IS HERE FOR YOU</span>
                    </div>
                    <h2>
                      {page === "Voice assistant"
                        ? "Let’s talk."
                        : page === "Coding assistant"
                          ? "Build with confidence."
                          : page === "Memory"
                            ? "A conversation worth keeping."
                            : "A clearer mind. A capable partner."}
                    </h2>
                    <p>
                      {page === "Assistant"
                        ? "Think out loud. Explore an idea. Get things done."
                        : descriptions[page]}
                    </p>
                    {page === "Voice assistant" ? (
                      <div className="voice-controls">
                        <button
                          aria-label={
                            recording ? "Stop recording" : "Start recording"
                          }
                          className={
                            recording
                              ? "record-button recording"
                              : "record-button"
                          }
                          disabled={busy}
                          onClick={() => void toggleRecord()}
                        >
                          {recording ? <Square size={22} /> : <Mic size={22} />}
                        </button>
                        <span>{voiceState}</span>
                        <small>
                          Click to talk · No browser wake-word listening
                        </small>
                      </div>
                    ) : (
                      <div className="suggestion-grid">
                        {(page === "Coding assistant"
                          ? [
                              [
                                "Inspect my project",
                                "Inspect the project in " +
                                  path +
                                  " and explain its architecture.",
                              ],
                              [
                                "Run Python safely",
                                "Ask me which existing Python file to run using execute_python in the isolated backend sandbox.",
                              ],
                            ]
                          : [
                              [
                                "Think it through",
                                "Help me think through a difficult decision. Ask me what I am deciding.",
                              ],
                              [
                                "Make a plan",
                                "Help me turn my goals into a practical plan. Ask me about my priorities.",
                              ],
                              [
                                "Build something",
                                "Help me plan a coding project. Ask me what I want to build.",
                              ],
                            ]
                        ).map(([title, prompt], i) => (
                          <button key={title} onClick={() => setInput(prompt)}>
                            <span>
                              {i === 0 ? (
                                <BrainCircuit size={18} />
                              ) : i === 1 ? (
                                <Activity size={18} />
                              ) : (
                                <Code2 size={18} />
                              )}
                            </span>
                            <strong>{title}</strong>
                            <ArrowRight size={14} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="message-list">
                    {feed.map((m, i) => (
                      <article className={"message " + m.role} key={i}>
                        <div className={"message-avatar " + m.role}>
                          {m.role === "assistant" ? (
                            <Command size={17} />
                          ) : (
                            "HR"
                          )}
                        </div>
                        <div className="message-content">
                          <div className="message-meta">
                            {m.role === "assistant" ? "J.A.R.V.I.S." : "You"}
                            <span>
                              {m.role === "assistant"
                                ? "LOCAL INTELLIGENCE"
                                : ""}
                            </span>
                          </div>
                          <Markdown
                            text={
                              m.content ||
                              (busy ? "Thinking…" : "No response received.")
                            }
                          />
                          {m.events && m.events.length > 0 && (
                            <details>
                              <summary>
                                Tool activity · {m.events.length} events
                              </summary>
                              <Output value={m.events} />
                            </details>
                          )}
                          {m.role === "assistant" && m.content && (
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() =>
                                void run(async () => {
                                  const blob = await request<Blob>(
                                    "/api/voice/speak",
                                    { text: m.content.slice(0, 2000) },
                                  );
                                  const url = URL.createObjectURL(blob);
                                  try {
                                    await play(url);
                                    audio.current?.addEventListener(
                                      "ended",
                                      () => URL.revokeObjectURL(url),
                                      { once: true },
                                    );
                                  } catch (e) {
                                    URL.revokeObjectURL(url);
                                    throw e;
                                  }
                                })
                              }
                            >
                              <Volume2 size={14} /> Read aloud
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                    {busy && (
                      <div className="processing">
                        <span /> Processing your request…
                      </div>
                    )}
                    <div ref={end} />
                  </div>
                )}
              </div>
              <div className="composer-area">
                {page === "Voice assistant" && (
                  <label className="audio-upload">
                    Transcribe an audio file
                    <input
                      type="file"
                      accept=".wav,.mp3,.m4a,.flac,.ogg,.webm"
                      disabled={busy || recording}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (!f) return;
                        void run(async () => {
                          if (f.size > 15 * 1024 * 1024)
                            throw new Error(
                              "Audio exceeds the 15 MB backend limit.",
                            );
                          const data = new FormData();
                          data.append("file", f);
                          const r = await request<{ text: string }>(
                            "/api/voice/transcribe",
                            data,
                          );
                          setNotice("Transcription: " + r.text);
                        });
                      }}
                    />
                  </label>
                )}
                {page === "Voice assistant" && feed.length > 0 && (
                  <div className="voice-inline">
                    <button disabled={busy} onClick={() => void toggleRecord()}>
                      {recording ? <Square size={17} /> : <Mic size={17} />}{" "}
                      {recording ? "Stop recording" : "Start recording"}
                    </button>
                    <span>{voiceState}</span>
                  </div>
                )}
                {lastAudio && page === "Voice assistant" && (
                  <audio controls src={lastAudio} />
                )}
                {page !== "Voice assistant" && (
                  <>
                    <form
                      className="composer"
                      onSubmit={(e) => {
                        e.preventDefault();
                        send();
                      }}
                    >
                      <textarea
                        aria-label="Message J.A.R.V.I.S."
                        placeholder={
                          page === "Coding assistant"
                            ? "Ask about your project, propose a change, or run a Python file…"
                            : "Ask anything, or think out loud…"
                        }
                        value={input}
                        maxLength={page === "Coding assistant" ? 12000 : 32000}
                        rows={2}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (!busy) send();
                          }
                        }}
                      />
                      <div className="composer-controls">
                        <span>
                          <Command size={14} />{" "}
                          {page === "Memory"
                            ? "Persistent memory"
                            : page === "Coding assistant"
                              ? "Supervised agent"
                              : "Conversation"}{" "}
                          <ChevronDown size={12} />
                        </span>
                        <div>
                          <button
                            type="button"
                            className="icon"
                            aria-label="Open voice assistant"
                            onClick={() => navigate("Voice assistant")}
                            disabled={busy}
                          >
                            <Mic size={18} />
                          </button>
                          {busy && channel === "chat" && streaming ? (
                            <button
                              type="button"
                              className="send"
                              aria-label="Stop response"
                              onClick={() => abort.current?.abort()}
                            >
                              <Square size={15} />
                            </button>
                          ) : (
                            <button
                              type="submit"
                              className="send"
                              aria-label="Send message"
                              disabled={busy || !input.trim()}
                            >
                              <ArrowUp size={19} />
                            </button>
                          )}
                        </div>
                      </div>
                    </form>
                    <div className="composer-note">
                      <span>
                        <ShieldCheck size={12} />{" "}
                        {page === "Memory"
                          ? "Saved on your backend"
                          : "Session conversation · Not saved to memory"}
                      </span>
                      <span>
                        Enter to send <span className="key">↵</span>
                      </span>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </main>
        <footer>
          <span>
            <span className={"dot " + (online ? "green" : "")} />{" "}
            {online ? "CONNECTED TO YOUR BACKEND" : "AWAITING LOCAL CONNECTION"}
          </span>
          <span>
            HR-PRESENTS <span className="footer-divider">/</span> J.A.R.V.I.S.
            WORKSTATION
          </span>
          <button
            className="icon"
            aria-label="Scroll to latest message"
            onClick={() => end.current?.scrollIntoView({ behavior: "smooth" })}
          >
            <ArrowDown size={13} />
          </button>
        </footer>
      </div>
    </div>
  );
}
export default function Root() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
