import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, ArrowUp, BrainCircuit, ChevronLeft, ChevronRight, CircleHelp, Cpu, Menu, MessageSquare, Mic, Radio, RotateCcw, ShieldCheck, Terminal, Wifi, X } from 'lucide-react'
import './App.css'

type Message = { role: 'user' | 'assistant'; content: string }
type Health = { backend?: string; ollama?: string; model?: string; model_installed?: boolean }

function Core({ busy, online }: { busy: boolean; online: boolean }) {
  return <div className={'core-wrap' + (busy ? ' is-thinking' : '')} aria-label="Animated J.A.R.V.I.S. intelligence core">
    <div className="core-glow" />
    <div className="orbit orbit-outer"><span className="orbit-node node-one"/><span className="orbit-node node-two"/></div>
    <div className="orbit orbit-mid"/><div className="orbit orbit-inner"/>
    <svg className="core-svg" viewBox="0 0 600 600" aria-hidden="true">
      <defs><linearGradient id="arc" x1="0" x2="1"><stop offset="0" stopColor="#1d638b"/><stop offset=".5" stopColor="#8deeff"/><stop offset="1" stopColor="#13587f"/></linearGradient></defs>
      {Array.from({length: 72}, (_,i) => <line key={i} x1="300" y1="28" x2="300" y2={i%6===0?'48':'39'} stroke={i%6===0?'#b2f4ff':'#357da1'} strokeWidth={i%6===0?2:1} opacity={i%6===0?.85:.4} transform={`rotate(${i*5} 300 300)`}/>)}
      <circle cx="300" cy="300" r="234" fill="none" stroke="#265a7b" strokeWidth="1" strokeDasharray="3 11"/>
      <circle cx="300" cy="300" r="215" fill="none" stroke="url(#arc)" strokeWidth="2" strokeDasharray="170 24 80 28 65 28 170 24 80 28"/>
      <circle cx="300" cy="300" r="176" fill="none" stroke="#77e7ff" strokeWidth="1" strokeDasharray="2 8" opacity=".55"/>
      <circle cx="300" cy="300" r="147" fill="none" stroke="url(#arc)" strokeWidth="4" strokeDasharray="145 25 120 42 180 42"/>
      <circle cx="300" cy="300" r="112" fill="none" stroke="#79eaff" strokeWidth="1.5" opacity=".5"/>
      {Array.from({length: 12}, (_,i) => <path key={i} d="M300 185 L310 204 L290 204 Z" fill="#60d9f5" opacity=".55" transform={`rotate(${i*30} 300 300)`}/>)}
      <circle cx="300" cy="300" r="78" fill="#061725" stroke="#74dfff" strokeWidth="2"/>
      <circle cx="300" cy="300" r="66" fill="none" stroke="#2c8eb9" strokeWidth="1" strokeDasharray="3 5"/>
    </svg>
    <div className="core-center"><div className="core-symbol">J</div><div className="core-small">A.R.V.I.S.</div></div>
    <div className="core-status"><span className={'status-dot '+(online?'live':'offline')}/>{busy ? 'PROCESSING REQUEST' : online ? 'INTELLIGENCE ONLINE' : 'CONNECTION OFFLINE'}</div>
  </div>
}

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [chatOpen, setChatOpen] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const online = health?.backend === 'online' && health?.ollama === 'online' && health?.model_installed === true
  const refresh = useCallback(async () => {
    try { const res = await fetch('/api/health', { signal: AbortSignal.timeout(5000) }); if (!res.ok) throw new Error(); setHealth(await res.json()) }
    catch { setHealth({backend:'offline', ollama:'offline'}) }
  }, [])
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 12000); return () => clearInterval(timer) }, [refresh])
  useEffect(() => { endRef.current?.scrollIntoView({behavior:'smooth'}) }, [messages, busy])
  useEffect(() => { const fn = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='j') { e.preventDefault(); setChatOpen(v=>!v) } }; window.addEventListener('keydown',fn); return ()=>window.removeEventListener('keydown',fn) }, [])
  const send = async () => {
    const message = input.trim(); if (!message || busy) return
    const history = [...messages]
    setInput(''); setError(''); setChatOpen(true); setMessages(prev=>[...prev,{role:'user',content:message},{role:'assistant',content:''}]); setBusy(true)
    const controller = new AbortController(); abortRef.current = controller
    try {
      const res = await fetch('/api/chat/stream', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,history}),signal:controller.signal})
      if (!res.ok || !res.body) throw new Error(`Server returned HTTP ${res.status}`)
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let buffer=''
      while (true) {
        const {done,value}=await reader.read(); if(done) break
        buffer+=decoder.decode(value,{stream:true}); const lines=buffer.split('\n'); buffer=lines.pop()||''
        for(const line of lines) { if(!line.trim()) continue; const item=JSON.parse(line) as {type:string;content?:string;message?:string};
          if(item.type==='error') throw new Error(item.message||'AI stream failed')
          if(item.type==='token' && item.content) setMessages(prev=>prev.map((m,i)=>i===prev.length-1?{...m,content:m.content+item.content}:m))
        }
      }
    } catch(e) { if(!controller.signal.aborted) setError(e instanceof Error?e.message:'Unable to reach AI backend') }
    finally { setBusy(false); abortRef.current=null }
  }
  const reset = () => { abortRef.current?.abort(); setBusy(false); setMessages([]); setError('') }
  return <div className="app-shell">
    <div className="ambient ambient-one"/><div className="ambient ambient-two"/><div className="scanlines"/>
    <header className="topbar"><div className="brand"><div className="brand-mark">HR</div><div><strong>J.A.R.V.I.S.</strong><span>BY HR-PRESENTS</span></div></div><div className="top-center">PERSONAL INTELLIGENCE SYSTEM <span className="top-divider">/</span> COMMAND CENTER</div><div className="top-right"><span className={'top-indicator '+(online?'connected':'')}/><span>{online?'ALL SYSTEMS NOMINAL':'BACKEND NOT READY'}</span><button className="icon-button mobile-menu" onClick={()=>setMenuOpen(v=>!v)} aria-label="Toggle navigation"><Menu size={18}/></button></div></header>
    <aside className={'side-rail '+(menuOpen?'mobile-open':'')}><div className="rail-label">NAVIGATION</div><button className="rail-item active" title="Intelligence core"><BrainCircuit size={19}/><span>Intelligence</span></button><button className="rail-item" onClick={()=>{setChatOpen(true);setMenuOpen(false)}} title="Open conversation"><MessageSquare size={19}/><span>Conversation</span></button><div className="rail-separator"/><div className="rail-label">MONITOR</div><div className="rail-item passive"><Activity size={19}/><span>System status</span></div><div className="rail-item passive"><ShieldCheck size={19}/><span>Local processing</span></div><div className="rail-bottom"><div className="rail-version">HR-PRESENTS<br/>BUILD 0.1.0</div></div></aside>
    <main className={'stage '+(chatOpen?'chat-visible':'')}><div className="stage-eyebrow"><span className="eyebrow-line"/>NEURAL INTERFACE <span className="stage-id">CORE / 001</span></div><div className="stage-main"><Core busy={busy} online={online}/><div className="stage-copy"><div className="stage-kicker">YOUR INTELLIGENCE. YOUR CONTROL.</div><h1>Good to have you here.</h1><p>J.A.R.V.I.S. is standing by. Start a conversation to access your local intelligence engine.</p><button className="stage-action" onClick={()=>setChatOpen(true)}>OPEN CONVERSATION <ChevronRight size={16}/></button></div></div><div className="stage-bottom"><div className="telemetry"><Cpu size={15}/><span>MODEL</span><strong>{health?.model||'qwen3.5:4b'}</strong></div><div className="telemetry"><Wifi size={15}/><span>OLLAMA</span><strong>{health?.ollama==='online'?'CONNECTED':'DISCONNECTED'}</strong></div><div className="telemetry"><Radio size={15}/><span>PROCESSING</span><strong>ON DEVICE</strong></div></div></main>
    <section className={'chat-panel '+(chatOpen?'open':'closed')} aria-label="Conversation panel"><div className="chat-head"><div className="chat-head-icon"><Terminal size={18}/></div><div className="chat-head-text"><strong>Conversation</strong><span>J.A.R.V.I.S. / LOCAL INTELLIGENCE</span></div><button className="icon-button" onClick={reset} title="New conversation"><RotateCcw size={16}/></button><button className="icon-button" onClick={()=>setChatOpen(false)} title="Hide conversation"><X size={18}/></button></div><div className="chat-feed">{messages.length===0?<div className="welcome"><div className="welcome-icon"><BrainCircuit size={29}/></div><div className="welcome-eyebrow">SECURE CHANNEL ESTABLISHED</div><h2>How can I assist?</h2><p>Ask a question, explore an idea, or give me a task. Your AI model runs locally.</p><div className="suggestions"><button onClick={()=>setInput('Introduce yourself and explain what you can do.')}>Introduce yourself <ArrowUp size={13}/></button><button onClick={()=>setInput('Help me plan my day.')}>Help me plan my day <ArrowUp size={13}/></button></div></div>:messages.map((m,i)=><div className={'message '+m.role} key={i}><div className="message-label">{m.role==='assistant'?'J.A.R.V.I.S.':'YOU'}</div><div className="message-body">{m.content || (busy&&i===messages.length-1?<span className="typing">Thinking<span>...</span></span>:'')}</div></div>)}{error&&<div className="chat-error"><CircleHelp size={16}/>{error}</div>}<div ref={endRef}/></div><div className="composer-wrap"><form className="composer" onSubmit={e=>{e.preventDefault();void send()}}><input aria-label="Message J.A.R.V.I.S." placeholder="Ask J.A.R.V.I.S. anything..." value={input} onChange={e=>setInput(e.target.value)} disabled={busy}/><button type="button" className="mic-disabled" title="Voice input coming in a later milestone" disabled><Mic size={18}/></button><button className="send-button" type="submit" disabled={!input.trim()||busy} title="Send message"><ArrowUp size={19}/></button></form><div className="composer-footer"><span><span className="footer-dot"/>LOCAL & PRIVATE</span><span>{busy?'GENERATING RESPONSE':'PRESS ENTER TO SEND'}</span></div></div></section>
    <button className={'chat-toggle '+(chatOpen?'chat-toggle-open':'')} onClick={()=>setChatOpen(v=>!v)} title="Toggle conversation (Ctrl+J)">{chatOpen?<ChevronRight size={18}/>:<><ChevronLeft size={18}/><MessageSquare size={17}/></>}</button>
  </div>
}
