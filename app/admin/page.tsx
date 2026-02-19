'use client';

import { useEffect, useState } from 'react';

const ADMIN_PIN = '1001';

interface Session {
  sessionId: string;
  fullName: string;
  timestamp: string;
  summary?: any;
  transcript?: any;
}

interface GroupedSessions {
  [name: string]: Session[];
}

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [groupedSessions, setGroupedSessions] = useState<GroupedSessions>({});
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [expandedNames, setExpandedNames] = useState<Set<string>>(new Set());
  const [showTranscript, setShowTranscript] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadSessions();
      // Refresh every 30 seconds
      const interval = setInterval(loadSessions, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Group sessions by name
    const grouped: GroupedSessions = {};
    sessions.forEach((session) => {
      const name = session.fullName || 'Unknown';
      if (!grouped[name]) {
        grouped[name] = [];
      }
      grouped[name].push(session);
    });

    // Sort sessions within each group by timestamp (newest first)
    Object.keys(grouped).forEach((name) => {
      grouped[name].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    });

    setGroupedSessions(grouped);
  }, [sessions]);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      setIsAuthenticated(true);
    } else {
      alert('Invalid PIN');
      setPin('');
    }
  };

  const toggleName = (name: string) => {
    const newExpanded = new Set(expandedNames);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedNames(newExpanded);
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // PIN Entry Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#4a1942] flex items-center justify-center relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-600/30 rounded-full blur-[128px]" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-800/20 rounded-full blur-[128px]" />

        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 max-w-md w-[90%] border border-white/20 shadow-2xl relative z-10">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Admin Panel</h1>
            <p className="text-gray-400 text-sm">Enter your PIN to access interview sessions</p>
          </div>

          <form onSubmit={handlePinSubmit}>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              maxLength={4}
              className="w-full px-4 py-4 bg-white/5 border border-white/20 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none mb-4 text-center text-3xl tracking-[0.5em] text-white placeholder-gray-500"
              autoFocus
            />
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-purple-500/25"
            >
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main Admin Dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#4a1942] relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[128px]" />
      <div className="absolute top-1/2 right-0 w-96 h-96 bg-purple-800/15 rounded-full blur-[128px]" />

      {/* Header */}
      <header className="bg-white/5 backdrop-blur-sm border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Logo" className="h-8" />
            <h1 className="text-xl font-semibold text-white">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              {sessions.length} sessions
            </span>
            <button
              onClick={loadSessions}
              disabled={isLoading}
              className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50"
            >
              <svg className={`w-5 h-5 text-gray-300 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Sidebar - Names and Sessions */}
        <div className="w-80 bg-white/5 backdrop-blur-sm border-r border-white/10 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Participants</h2>

            {Object.keys(groupedSessions).length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-gray-500 text-sm">No sessions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {Object.keys(groupedSessions).sort().map((name) => (
                  <div key={name}>
                    <button
                      onClick={() => toggleName(name)}
                      className="w-full text-left px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-medium text-white flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-600/30 rounded-full flex items-center justify-center">
                          <span className="text-purple-300 text-sm font-semibold">
                            {name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="truncate max-w-[140px]">{name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 bg-white/10 px-2 py-0.5 rounded-full">
                          {groupedSessions[name].length}
                        </span>
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${expandedNames.has(name) ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {expandedNames.has(name) && (
                      <div className="ml-4 mt-2 space-y-1 border-l-2 border-purple-600/30 pl-4">
                        {groupedSessions[name].map((session) => (
                          <button
                            key={session.sessionId}
                            onClick={() => {
                              setSelectedSession(session);
                              setShowTranscript(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                              selectedSession?.sessionId === session.sessionId
                                ? 'bg-purple-600/40 text-white'
                                : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {formatDate(session.timestamp)}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Session Details */}
        <div className="flex-1 p-6 overflow-y-auto">
          {selectedSession ? (
            <div className="max-w-4xl mx-auto">
              {/* Session Header */}
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 mb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">{selectedSession.fullName}</h2>
                    <p className="text-gray-400">{formatDate(selectedSession.timestamp)}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                      selectedSession.summary
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${selectedSession.summary ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
                      {selectedSession.summary ? 'Processed' : 'Pending'}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 font-mono mt-3 bg-white/5 rounded-lg px-3 py-2">
                  Session ID: {selectedSession.sessionId}
                </p>
              </div>

              {/* Tab Buttons */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setShowTranscript(false)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
                    !showTranscript
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Summary
                </button>
                <button
                  onClick={() => setShowTranscript(true)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
                    showTranscript
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Transcript
                </button>
              </div>

              {/* Content Panel */}
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
                {!showTranscript ? (
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Session Summary
                    </h3>
                    {selectedSession.summary ? (
                      <div className="bg-white/5 rounded-xl p-4">
                        <pre className="whitespace-pre-wrap text-sm text-gray-300 font-mono leading-relaxed">
                          {typeof selectedSession.summary === 'string'
                            ? selectedSession.summary
                            : JSON.stringify(selectedSession.summary, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-gray-400 mb-2">Summary not yet generated</p>
                        <p className="text-gray-500 text-sm">The session monitor will process this session within 5 minutes.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Full Transcript
                    </h3>
                    {selectedSession.transcript && selectedSession.transcript.length > 0 ? (
                      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                        {selectedSession.transcript.map((entry: any, idx: number) => (
                          <div
                            key={idx}
                            className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                              entry.role === 'user'
                                ? 'bg-purple-600 text-white rounded-br-md'
                                : 'bg-white/10 text-gray-200 rounded-bl-md'
                            }`}>
                              <p className="text-xs font-medium mb-1 opacity-70">
                                {entry.role === 'agent' || entry.role === 'assistant' ? 'AI Assistant' : 'User'}
                              </p>
                              <p className="text-sm leading-relaxed">{entry.text || entry.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p className="text-gray-400 mb-2">Transcript not yet available</p>
                        <p className="text-gray-500 text-sm">The session monitor will fetch this within 5 minutes.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Select a Session</h3>
                <p className="text-gray-400">Choose a participant from the sidebar to view their interview details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

