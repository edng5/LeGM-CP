"use client";
"use client";
import React, { useState, useRef, useEffect } from "react";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "LeGM";
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

  function formatBotText(text: string) {
    if (!text) return "";
    // Bold section headers like --- filename --- (only at start of line)
    let formatted = text.replace(/---\s*(.*?)\s*---/g, '<strong>$1</strong>');
    // Convert line breaks to <br>
    formatted = formatted.replace(/\n/g, '<br>');
    return formatted;
  }

  return (
    <div className="min-h-screen w-full bg-gray-900 flex flex-col items-center justify-center font-sans">
      <div className="flex flex-col w-full h-screen max-w-2xl mx-auto bg-gray-800 rounded-lg shadow-lg p-0">
        <h1 className="text-2xl font-bold py-6 text-center text-white border-b border-gray-700">LeGM-CP AI Chatbot</h1>
        <div className="flex-1 overflow-y-auto border-b border-gray-700 px-4 py-6 bg-gray-950 custom-scrollbar">
          {messages.map((msg, idx) => (
            <div key={idx} className={`mb-2 flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
              {msg.sender === "bot" ? (
                <span
                  className={`px-4 py-2 rounded-2xl text-base max-w-[70%] inline-block break-words shadow-md transition-all duration-300 animate-fade-in bg-gray-700 text-gray-100`}
                  dangerouslySetInnerHTML={{ __html: formatBotText(msg.text) }}
                />
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
        /* Custom scrollbar styles */
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
      `}</style>
    </div>
  );
}
