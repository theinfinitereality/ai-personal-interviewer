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
      const name = session.fullName;
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
    try {
      const response = await fetch('/api/admin/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">Admin Panel</h1>
          <form onSubmit={handlePinSubmit}>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter 4-digit PIN"
              maxLength={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mb-4 text-center text-2xl tracking-widest text-gray-800"
              autoFocus
            />
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
            >
              Access Admin Panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Left Sidebar - Names and Sessions */}
      <div className="w-80 bg-white shadow-lg overflow-y-auto">
        <div className="p-4 bg-blue-600 text-white">
          <h1 className="text-xl font-bold">Interview Sessions</h1>
          <p className="text-sm text-blue-100">{sessions.length} total sessions</p>
        </div>

        <div className="p-4">
          {Object.keys(groupedSessions).sort().map((name) => (
            <div key={name} className="mb-2">
              <button
                onClick={() => toggleName(name)}
                className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg font-semibold text-gray-800 flex items-center justify-between"
              >
                <span>{name}</span>
                <span className="text-sm text-gray-500">
                  ({groupedSessions[name].length})
                  {expandedNames.has(name) ? ' ▼' : ' ▶'}
                </span>
              </button>

              {expandedNames.has(name) && (
                <div className="ml-4 mt-1 space-y-1">
                  {groupedSessions[name].map((session) => (
                    <button
                      key={session.sessionId}
                      onClick={() => {
                        setSelectedSession(session);
                        setShowTranscript(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded text-sm ${
                        selectedSession?.sessionId === session.sessionId
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-white hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      {formatDate(session.timestamp)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel - Session Details */}
      <div className="flex-1 p-8 overflow-y-auto">
        {selectedSession ? (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">{selectedSession.fullName}</h2>
              <p className="text-gray-600">{formatDate(selectedSession.timestamp)}</p>
              <p className="text-xs text-gray-400 font-mono mt-1">
                Session ID: {selectedSession.sessionId.substring(0, 30)}...
              </p>
            </div>

            <div className="mb-6">
              <div className="flex gap-4 mb-4">
                <button
                  onClick={() => setShowTranscript(false)}
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    !showTranscript
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Summary
                </button>
                <button
                  onClick={() => setShowTranscript(true)}
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    showTranscript
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Full Transcript
                </button>
              </div>

              {!showTranscript ? (
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Session Summary</h3>
                  {selectedSession.summary ? (
                    <div className="prose max-w-none">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700">
                        {JSON.stringify(selectedSession.summary, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">
                      Summary not yet generated. The session monitor will process this session within 5 minutes.
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Full Transcript</h3>
                  {selectedSession.transcript ? (
                    <div className="space-y-3">
                      {selectedSession.transcript.map((entry: any, idx: number) => (
                        <div key={idx} className={`p-3 rounded ${
                          entry.role === 'agent' ? 'bg-blue-50' : 'bg-green-50'
                        }`}>
                          <p className="font-semibold text-sm text-gray-600 mb-1">
                            {entry.role === 'agent' ? 'AI Assistant' : 'User'}
                          </p>
                          <p className="text-gray-800">{entry.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">
                      Transcript not yet available. The session monitor will fetch this within 5 minutes.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <p className="text-gray-500 text-lg">Select a session from the left sidebar to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

