'use client';

import { useEffect, useState } from 'react';

const EXPERIENCE_ID = 'YWIzZGI5ZWItMWIxOC00MzVlLTkxN2UtYTgzZjJiNDVmM2I1OjFiY2FiMGFkLTA4NDktNDdlMS04MjM0LTFhNDFhYTZmYzQ1Zg==';

export default function Home() {
  const [showNamePopup, setShowNamePopup] = useState(true);
  const [fullName, setFullName] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);

  useEffect(() => {
    // Load Napster Spaces SDK
    const script = document.createElement('script');
    script.src = 'https://spaces-sdk.napsterai.dev/v1/napster-spaces.umd.js';
    script.async = true;
    script.onload = () => {
      console.log('Napster Spaces SDK loaded');
      setIsSDKLoaded(true);
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleStartInterview = async () => {
    if (!fullName.trim()) {
      alert('Please enter your full name');
      return;
    }

    setShowNamePopup(false);

    // Initialize Napster Spaces SDK
    if (typeof window !== 'undefined' && (window as any).NapsterSpaces && isSDKLoaded) {
      try {
        const container = document.getElementById('avatar-container');
        if (!container) return;

        const spaces = new (window as any).NapsterSpaces({
          experienceId: EXPERIENCE_ID,
          container: container,
          onSessionStart: async (session: any) => {
            console.log('Session started:', session);
            const sid = session.sessionId || session.id;
            setSessionId(sid);
            
            // Save session with full name
            await fetch('/api/sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: sid,
                fullName: fullName.trim(),
                timestamp: new Date().toISOString(),
              }),
            });
          },
        });

        await spaces.start();
      } catch (error) {
        console.error('Failed to start Napster Spaces:', error);
        alert('Failed to start interview. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Name Capture Popup */}
      {showNamePopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Welcome to AI Interview</h2>
            <p className="text-gray-600 mb-6">Please enter your full name to begin the interview session.</p>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mb-4 text-gray-800"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleStartInterview();
                }
              }}
              autoFocus
            />
            <button
              onClick={handleStartInterview}
              disabled={!isSDKLoaded}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
            >
              {isSDKLoaded ? 'Start Interview' : 'Loading...'}
            </button>
          </div>
        </div>
      )}

      {/* Avatar Container */}
      <div className="w-full h-screen flex items-center justify-center">
        <div 
          id="avatar-container" 
          className="w-full h-full max-w-4xl max-h-[800px] bg-black rounded-lg shadow-2xl overflow-hidden"
        />
      </div>

      {/* Session Info (for debugging) */}
      {sessionId && (
        <div className="fixed bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 text-sm">
          <p className="text-gray-600">Session ID:</p>
          <p className="font-mono text-xs text-gray-800">{sessionId.substring(0, 20)}...</p>
          <p className="text-gray-600 mt-2">Name:</p>
          <p className="font-semibold text-gray-800">{fullName}</p>
        </div>
      )}
    </div>
  );
}

