"use client";
"use client";
import React, { useState, useRef, useEffect } from "react";
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import ReactMarkdown from 'react-markdown';
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function SendIcon({ className = "w-6 h-6" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20l16-8-16-8v6l12 2-12 2v6z" />
    </svg>
  );
}

interface Message {
  sender: "user" | "bot";
  text: string;
}



export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [draftedPlayers, setDraftedPlayers] = useState<string[]>([]);
  const [currentDraftPick, setCurrentDraftPick] = useState<string>("");
  const [nextDraftPick, setNextDraftPick] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "LeGM";
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Parse drafted players and draft pick from bot messages
  useEffect(() => {
    let allDrafted: string[] = [];
    let draftPick = "";
    messages.forEach(msg => {
      if (msg.sender === "bot") {
        // Drafted players
        if (msg.text.includes("Your drafted players:")) {
          const match = msg.text.match(/Your drafted players:\s*([A-Za-z0-9 .,'-]+(?:,\s*[A-Za-z0-9 .,'-]+)*)/);
          if (match && match[1]) {
            const players = match[1].split(/,\s*/).map(p => p.trim()).filter(p => p && p.toLowerCase() !== "none");
            allDrafted = [...allDrafted, ...players];
          }
        }
        // Draft pick
        if (msg.text.includes("Draft Pick:")) {
          const pickMatch = msg.text.match(/Draft Pick:\s*(\d+)/);
          if (pickMatch && pickMatch[1]) {
            draftPick = pickMatch[1];
          }
        }
      }
    });
    const uniqueDrafted = Array.from(new Set(allDrafted));
    setDraftedPlayers(uniqueDrafted);
    setCurrentDraftPick(draftPick);
    // Calculate next draft pick (10-team serpentine)
    let nextPick = "";
    if (draftPick) {
      const pickNum = parseInt(draftPick);
      const roundNum = Math.floor((pickNum - 1) / 10) + 1;
      const posInRound = ((pickNum - 1) % 10) + 1;
      let nextPos;
      if (roundNum % 2 === 1) {
        nextPos = 10 - posInRound + 1;
      } else {
        nextPos = posInRound;
      }
      nextPick = (roundNum * 10 + nextPos).toString();
    }
    setNextDraftPick(nextPick);
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg: Message = { sender: "user", text: input };
    setMessages((msgs) => [...msgs, userMsg]);
    setInput("");
    setIsBotTyping(true);

    // Send to backend
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input })
      });
      const data = await res.json();
      let botText = "";
      // If response is an object with type/text, extract text
      if (typeof data.response === "object" && data.response !== null) {
        if (Array.isArray(data.response)) {
          // If response is an array, join all text fields
          botText = data.response.map((r: any) => r.text || JSON.stringify(r)).join("\n");
        } else if ("text" in data.response) {
          botText = data.response.text;
        } else {
          botText = JSON.stringify(data.response);
        }
      } else {
        botText = data.response;
      }
      setMessages((msgs) => [...msgs, { sender: "bot", text: botText }]);
    } catch (err) {
      setMessages((msgs) => [...msgs, { sender: "bot", text: "Error connecting to server." }]);
    }
    setIsBotTyping(false);
  }

  function cleanBotText(text: string) {
    // ...existing code...
    text = text.replace(/STATS:\s*{[\s\S]*?}/, "");
    text = text.replace(/# Generating Your Fantasy Basketball Team-Building Prompt[\s\S]*?league format\./, "");
    return text.trim();
  }
  // Extract only player summaries between 'Recommended players:' and 'STATS:'
  function extractPlayerSummaries(text: string) {
    const recIdx = text.indexOf('Recommended players:');
    const statsIdx = text.indexOf('STATS:');
    let summary = '';
    if (recIdx !== -1 && statsIdx !== -1 && statsIdx > recIdx) {
      // Get everything after 'Recommended players:' line and before 'STATS:'
      const recLineEnd = text.indexOf('\n', recIdx);
      if (recLineEnd !== -1) {
        summary = text.substring(recLineEnd + 1, statsIdx).trim();
      } else {
        summary = text.substring(recIdx + 'Recommended players:'.length, statsIdx).trim();
      }
    }
  // Bold player name and everything inside () before the colon
  summary = summary.replace(/^(\s*)([A-Za-z .,'-]+\s*\([^)]*\)):/gm, '$1**$2**:');
    return summary;
  }
  function parseStats(text: string) {
    // ...existing code...
    const statsMatch = text.match(/STATS:\s*({[\s\S]*})/);
    let stats: Record<string, any> = {};
    if (statsMatch) {
      try {
        stats = JSON.parse(statsMatch[1]);
      } catch {}
    }
    return stats;
  }

  // Helper to get NBA player photo URL
  function getPlayerPhotoUrl(name: string) {
    // NBA.com headshot format: https://cdn.nba.com/headshots/nba/latest/1040x760/{playerId}.png
    // Use unofficial API: https://nba-players.herokuapp.com/players/{lastName}/{firstName}
    // Fallback to initials avatar if not found
    const [first, ...rest] = name.split(' ');
    const last = rest.length > 0 ? rest[rest.length - 1] : '';
    if (first && last) {
      return `https://nba-players.herokuapp.com/players/${last}/${first}`;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff&size=128`;
  }

  return (
    <div className="min-h-screen w-full bg-gray-900 flex flex-row items-center justify-center font-sans">
      {/* Draft Pick Display */}
      <div className="absolute top-6 left-6 z-10 bg-gray-800 rounded-lg px-6 py-4 shadow-lg border border-blue-600 flex flex-col items-center">
        <span className="text-lg font-semibold text-blue-400">Current Draft Pick</span>
        <span className="text-3xl font-bold text-white mt-2">{currentDraftPick ? currentDraftPick : "-"}</span>
        <span className="text-lg font-semibold text-blue-400 mt-4">Next Draft Pick</span>
        <span className="text-2xl font-bold text-white mt-2">{nextDraftPick ? nextDraftPick : "-"}</span>
      </div>
      {/* Chat panel */}
      <div className="flex flex-col w-full h-screen max-w-2xl mx-auto bg-gray-800 rounded-lg shadow-lg p-0">
        <h1 className="text-2xl font-bold py-6 text-center text-white border-b border-gray-700">LeGM-CP AI Chatbot</h1>
        <div className="flex-1 overflow-y-auto border-b border-gray-700 px-4 py-6 bg-gray-950 custom-scrollbar">
          {messages.map((msg, idx) => (
            <div key={idx} className={`mb-2 flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
              {msg.sender === "bot" ? (
                (() => {
                  const stats = parseStats(msg.text);
                  const summary = extractPlayerSummaries(msg.text);
                  return (
                    <div className="w-full">
                      <div className="mb-2 text-sm text-gray-200 markdown-summary">
                        <ReactMarkdown>{summary}</ReactMarkdown>
                      </div>
                      {Object.keys(stats).length > 0 && (
                        <div className="mt-4">
                          <Bar
                            data={{
                              labels: ["PTS", "TRB", "AST", "3P", "STL", "BLK", "FG%", "FT%", "TOV"],
                              datasets: Object.keys(stats).map((name, i) => ({
                                label: name,
                                data: [
                                  stats[name]?.PTS ?? 0,
                                  stats[name]?.TRB ?? 0,
                                  stats[name]?.AST ?? 0,
                                  stats[name]?.["3P"] ?? 0,
                                  stats[name]?.STL ?? 0,
                                  stats[name]?.BLK ?? 0,
                                  ((stats[name]?.["FG%"] ?? 0) * 10),
                                  ((stats[name]?.["FT%"] ?? 0) * 10),
                                  stats[name]?.TOV ?? 0,
                                ],
                                backgroundColor: `hsl(${i * 60}, 70%, 60%)`,
                              })),
                            }}
                            options={{
                              indexAxis: 'y',
                              responsive: true,
                              plugins: {
                                legend: { position: 'top' },
                                title: { display: true, text: '9-Category Player Stats' },
                                tooltip: {
                                  callbacks: {
                                    label: function(context) {
                                      const idx = context.dataIndex;
                                      const datasetLabel = context.dataset?.label;
                                      if (datasetLabel && stats[datasetLabel]) {
                                        if (idx === 6) {
                                          // FG%
                                          return `${datasetLabel} FG%: ${typeof stats[datasetLabel]["FG%"] !== "undefined" ? stats[datasetLabel]["FG%"] : "0.0"}`;
                                        } else if (idx === 7) {
                                          // FT%
                                          return `${datasetLabel} FT%: ${typeof stats[datasetLabel]["FT%"] !== "undefined" ? stats[datasetLabel]["FT%"] : "0.0"}`;
                                        }
                                      }
                                      return `${datasetLabel}: ${context.parsed.x}`;
                                    }
                                  }
                                }
                              },
                              scales: {
                                x: {
                                  beginAtZero: true,
                                  ticks: {
                                    callback: function(value, idx) {
                                      if (typeof idx === 'number' && this.getLabelForValue) {
                                        const label = this.getLabelForValue(idx);
                                        if (label === "FG%" || label === "FT%") {
                                          const dataset = this?.chart?.data?.datasets?.[0];
                                          const playerName = dataset?.label ?? '';
                                          if (playerName && stats?.[playerName]?.[label] !== undefined) {
                                            return `${stats[playerName][label]}`;
                                          }
                                        }
                                      }
                                      return value;
                                    }
                                  }
                                },
                              },
                            }}
                            height={220}
                          />
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <span className={`px-4 py-2 rounded-2xl text-base max-w-[70%] inline-block break-words shadow-md transition-all duration-300 animate-fade-in bg-blue-600 text-white`}>
                  {msg.text}
                </span>
              )}
            </div>
          ))}
          {isBotTyping && (
            <div className="mb-2 flex justify-start">
              <span className="px-4 py-2 rounded-2xl text-base max-w-[70%] inline-block break-words shadow-md bg-gray-700 text-gray-100 animate-pulse">
                <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mr-1 animate-bounce" style={{animationDelay: "0ms"}}></span>
                <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mr-1 animate-bounce" style={{animationDelay: "150ms"}}></span>
                <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: "300ms"}}></span>
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={sendMessage} className="flex items-center px-4 py-4 bg-gray-800">
          <input
            type="text"
            className="flex-1 border border-gray-700 bg-gray-900 text-white rounded-l px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            autoFocus
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-3 rounded-r hover:bg-blue-700 transition flex items-center justify-center">
            <SendIcon />
          </button>
        </form>
      </div>
      {/* Player Tracker Sidebar */}
      <div className="hidden md:flex flex-col h-screen w-64 bg-gray-900 border-l border-gray-800 p-6 items-center">
        <h2 className="text-lg font-semibold text-white mb-4">Your Drafted Players</h2>
        <div className="flex flex-col gap-4 w-full">
          {draftedPlayers.length === 0 ? (
            <div className="text-gray-400 text-sm">No players drafted yet.</div>
          ) : (
            draftedPlayers.map((player, idx) => {
              // Try to extract team and position from the latest bot message
              let team = "";
              let pos = "";
              // Find the player block in the latest bot message
              const lastBotMsg = [...messages].reverse().find(m => m.sender === "bot" && m.text.includes(player));
              if (lastBotMsg) {
                const regex = new RegExp(`${player} \\(([^-]+) - ([^)]+)\\):`);
                const match = lastBotMsg.text.match(regex);
                if (match) {
                  team = match[1].trim();
                  pos = match[2].trim();
                }
              }
              return (
                <div key={player + idx} className="flex flex-col bg-gray-800 rounded-lg p-2 shadow">
                  <span className="text-white font-medium text-base">{player}</span>
                  <span className="text-blue-300 text-sm">{team ? team : ""} {pos ? `- ${pos}` : ""}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease;
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .animate-bounce {
          animation: bounce 1s infinite;
        }
        .animate-pulse {
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #374151;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1f2937;
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #374151 #1f2937;
        }
        .markdown-summary {
          font-size: 0.95rem;
          line-height: 1.5;
          color: #e5e7eb;
        }
        .markdown-summary strong {
          color: #60a5fa;
        }
        .markdown-summary p {
          margin: 0.5em 0;
        }
      `}</style>
    </div>
  );
}
