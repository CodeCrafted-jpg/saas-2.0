"use client";

import { useChat } from "@ai-sdk/react";
import type { Message } from "ai";
import { useState, useRef, useEffect } from "react";
import { Send, BookOpen, ChevronRight, FileText, ChevronDown, Download, Sparkles, LayoutDashboard, Database, ShieldCheck, HardDrive, Zap } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function ChatDashboard() {
  const [sources, setSources] = useState<any[]>([]);
  const [showRawContext, setShowRawContext] = useState(false);
  const [totalDocs, setTotalDocs] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Hardcode a dummy teamId for MVP testing purposes. 
  // In a real app, this comes from Supabase Auth / React Context.
  const MVP_TEAM_ID = "00000000-0000-0000-0000-000000000000";

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
    body: {
      teamId: MVP_TEAM_ID,
    },
    onResponse: (response: Response) => {
      // Extract the citations/sources from the custom header
      const sourcesHeader = response.headers.get("x-rag-sources");
      if (sourcesHeader) {
        try {
          const decoded = Buffer.from(sourcesHeader, "base64").toString("utf8");
          setSources(JSON.parse(decoded));
        } catch (e) {
          console.error("Failed to parse sources header:", e);
        }
      }
    },
  });

  // Fetch KB stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const supabase = createClient();
        const { count, error } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', MVP_TEAM_ID);

        if (!error && count !== null) {
          setTotalDocs(count);
        }
      } catch (e) {
        console.error("Failed to fetch doc stats:", e);
      }
    };
    fetchStats();
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const exportChat = () => {
    const mdContent = messages.map((m: Message) => `**${m.role.toUpperCase()}**:\n${m.content}\n`).join('\n---\n\n');
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen w-full bg-[#050505] text-white font-sans overflow-hidden relative">
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] ambient-glow rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] ambient-glow rounded-full pointer-events-none" />

      {/* Sidebar / Sources Panel */}
      <div className="w-[380px] border-r border-white/5 bg-[#050505]/40 backdrop-blur-3xl flex flex-col hidden lg:flex z-10">
        <div className="p-8 border-b border-white/5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center border border-accent/30">
              < Sparkles className="w-4 h-4 text-accent neon-text" />
            </div>
            <h1 className="text-xl font-medium tracking-tight">
              Next<span className="text-accent font-bold">Ware</span>
            </h1>
          </div>
          <p className="text-[11px] text-white/40 uppercase tracking-[0.2em] font-medium ml-11">Knowledge Base</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Enhanced Knowledge Stats */}
          <div className="space-y-4">
            <h2 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] flex items-center justify-between">
              Hub Summary
              <Zap className="w-3 h-3 text-accent animate-pulse" />
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="glass rounded-2xl p-4 space-y-1">
                <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider">Total Assets</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tighter text-white">
                    {totalDocs !== null ? totalDocs : "---"}
                  </span>
                  <span className="text-[10px] text-accent font-bold">LIVE</span>
                </div>
              </div>
              <div className="glass rounded-2xl p-4 space-y-1 border-accent/5">
                <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider">Connectors</p>
                <div className="flex items-center gap-2">
                  <HardDrive className="w-3.5 h-3.5 text-accent" />
                  <span className="text-xs font-bold text-white/80">Drive</span>
                </div>
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-4 flex items-center justify-between">
              Connected Nodes
              {sources.length > 0 && (
                <span className="text-accent text-[9px] px-2 py-0.5 rounded-full border border-accent/20 bg-accent/5">
                  {sources.length} ONLINE
                </span>
              )}
            </h2>

            {sources.length === 0 ? (
              <div className="glass rounded-2xl p-6 text-center space-y-3">
                <Database className="w-8 h-8 text-white/10 mx-auto" />
                <p className="text-xs text-white/40 leading-relaxed">
                  Query the system to activate retrieval nodes and citation mapping.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sources.map((src, i) => (
                  <div key={i} className="glass rounded-xl p-4 group hover:border-accent/30 transition-all duration-500">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 group-hover:bg-accent/10 transition-colors">
                        <FileText className="w-4 h-4 text-white/60 group-hover:text-accent transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xs font-semibold text-white/80 line-clamp-1 group-hover:text-white transition-colors">
                          {src.title || "Unknown Document"}
                        </h3>
                        <div className="flex items-center gap-3 mt-1.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-accent animate-pulse" />
                            <span className="text-[10px] text-white/40 font-medium">
                              {(src.similarity * 100).toFixed(1)}% MATCH
                            </span>
                          </div>
                          {src.page && (
                            <span className="text-[10px] text-white/20">• Page {src.page}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowRawContext(!showRawContext)}
                      className="w-full mt-4 flex items-center justify-center gap-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/5 text-[10px] text-white/40 hover:bg-white/[0.05] hover:text-white/60 transition-all"
                    >
                      {showRawContext ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      {showRawContext ? "HIDE VECTOR DATA" : "VIEW RAW CONTEXT"}
                    </button>

                    {showRawContext && (
                      <div className="mt-3 text-[11px] leading-relaxed text-white/50 bg-black/40 rounded-lg p-3 border border-white/5 font-mono">
                        {src.snippet}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4">
            <div className="glass rounded-xl p-4 space-y-3 border-accent/10">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-accent/60" />
                <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Safety Status</span>
              </div>
              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-accent neon-glow transition-all duration-1000" style={{ width: '100%' }} />
              </div>
              <p className="text-[9px] text-white/30 uppercase tracking-tight">PII Filters Active & Monitoring</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative h-full">
        {/* Glow Line / Neon Divider */}
        <div className="absolute top-[88px] left-0 right-0 z-20">
          <div className="glow-line w-full max-w-4xl mx-auto" />
        </div>

        {/* Global Toolbar */}
        <div className="h-[88px] flex items-center justify-between px-10 border-b border-white/5 bg-[#050505]/40 backdrop-blur-xl z-20">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 cursor-pointer group">
              <LayoutDashboard className="w-4 h-4 text-white/40 group-hover:text-accent transition-colors" />
              <span className="text-xs font-semibold text-white/40 group-hover:text-white transition-colors">Workspace</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {messages.length > 0 && (
              <button
                onClick={exportChat}
                className="glass hover:bg-white/5 text-white/60 text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-xl flex items-center gap-2 transition-all"
              >
                <Download className="w-3 h-3" /> Export .MD
              </button>
            )}
            <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/20 flex items-center justify-center text-[10px] font-bold text-accent">
              SY
            </div>
          </div>
        </div>

        {/* Messaging Thread */}
        <div className="flex-1 overflow-y-auto pt-12 pb-32 px-6 lg:px-0">
          <div className="max-w-3xl mx-auto space-y-12">
            {messages.length === 0 ? (
              <div className="py-20 flex flex-col items-center text-center space-y-8">
                <div className="relative">
                  <div className="w-24 h-24 rounded-3xl bg-accent/5 border border-accent/10 flex items-center justify-center animate-pulse">
                    <Sparkles className="w-10 h-10 text-accent neon-text" />
                  </div>
                  <div className="absolute -inset-4 ambient-glow scale-150 blur-2xl opacity-50" />
                </div>

                <div className="space-y-3">
                  <h2 className="text-4xl font-semibold tracking-tight">Your gateway to smarter<br />knowledge decisions.</h2>
                  <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
                    Access private enterprise data securely through our RAG-powered intelligence layer.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full max-w-xl">
                  {["What is our remote work policy?", "How do I setup the local backend?", "Summarize the Q3 marketing plan.", "Where are the branding assets?"].map((q) => (
                    <button
                      key={q}
                      onClick={() => handleInputChange({ target: { value: q } } as any)}
                      className="glass text-xs text-left p-4 rounded-2xl text-white/60 hover:text-white hover:border-accent/40 transition-all font-medium"
                    >
                      "{q}"
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-10">
                {messages.map((m) => (
                  <div key={m.id} className={`flex flex-col gap-3 ${m.role === "user" ? "items-end" : "items-start"}`}>
                    <div className="flex items-center gap-3 px-1">
                      {m.role === "assistant" ? (
                        <>
                          <div className="w-5 h-5 rounded-md bg-accent/20 flex items-center justify-center border border-accent/20">
                            <Sparkles className="w-2.5 h-2.5 text-accent" />
                          </div>
                          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">NextWare AI</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">OperatorSayan</span>
                          <div className="w-5 h-5 rounded-full bg-white/5 border border-white/10" />
                        </>
                      )}
                    </div>

                    <div className={`max-w-[90%] lg:max-w-2xl text-sm leading-relaxed p-6 rounded-3xl transition-all duration-700 font-medium ${m.role === "user"
                      ? "bg-accent text-black neon-glow rounded-tr-none"
                      : "glass rounded-tl-none text-white/90"
                      }`}>
                      <div className="prose prose-sm prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/5">
                        {m.content}
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex flex-col gap-3 items-start animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-3 px-1">
                      <div className="w-5 h-5 rounded-md bg-accent/20 flex items-center justify-center border border-accent/20">
                        <Sparkles className="w-2.5 h-2.5 text-accent" />
                      </div>
                      <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Synthesizing Response...</span>
                    </div>
                    <div className="glass rounded-3xl rounded-tl-none p-6 flex gap-1.5 items-center">
                      <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce"></div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input Dock */}
        <div className="absolute font-sans bottom-0 left-0 right-0 p-8 z-30">
          <div className="max-w-3xl mx-auto relative group">
            {/* Ambient Input Glow */}
            <div className="absolute -inset-1 ambient-glow opacity-0 group-focus-within:opacity-100 transition-opacity blur-xl rounded-[32px] pointer-events-none" />

            <form onSubmit={handleSubmit} className="relative flex items-center">
              <input
                className="w-full h-16 bg-[#0A0A0A]/80 border border-white/5 focus:border-accent focus:ring-1 focus:ring-accent/20 text-white placeholder-white/20 rounded-[28px] pl-8 pr-20 shadow-2xl backdrop-blur-3xl transition-all outline-none text-sm font-medium"
                value={input}
                placeholder="Secure Query Terminal..."
                onChange={handleInputChange}
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-3 w-10 h-10 bg-accent hover:bg-[#3CD9B7] disabled:bg-white/5 disabled:text-white/10 text-black rounded-full transition-all flex items-center justify-center font-bold"
              >
                <ChevronRight className="w-5 h-5 -mr-0.5" />
              </button>
            </form>
            <div className="text-center mt-3">
              <span className="text-[9px] uppercase tracking-[0.1em] text-white/20 font-bold">End-to-End Encrypted Knowledge Retrieval</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
