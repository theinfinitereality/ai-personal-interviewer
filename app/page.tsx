"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Script from "next/script";

// Workflow interface for capturing identified processes
interface Workflow {
  id: string;
  name: string;
  description: string;
  inputs: string[];
  outputs: string[];
  timestamp: string;
}

interface TranscriptMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// Experience ID provided by user
const EXPERIENCE_ID = "YWIzZGI5ZWItMWIxOC00MzVlLTkxN2UtYTgzZjJiNDVmM2I1OjFiY2FiMGFkLTA4NDktNDdlMS04MjM0LTFhNDFhYTZmYzQ1Zg==";
// Functions Library ID from registration script
const FUNCTIONS_LIBRARY_ID = "02df3db1-29ac-46b2-857e-74c8185f8a1a";

export default function Home() {
  // Profile modal state (similar to audi-demo pattern)
  const [showProfileModal, setShowProfileModal] = useState(true);
  const [fullName, setFullName] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // UI state
  const [hintsOpen, setHintsOpen] = useState(true);
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [avatarReady, setAvatarReady] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showTvOff, setShowTvOff] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  // Refs
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const avatarContainerRef = useRef<HTMLDivElement>(null);
  const sdkInstanceRef = useRef<any>(null);
  const finishingRef = useRef(false);
  const finishMessageSentRef = useRef(false);
  const avatarStartedSpeakingRef = useRef(false);
  const endAnimationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fullNameRef = useRef("");
  const submittedWorkflowNamesRef = useRef<Set<string>>(new Set());

  // Keep fullNameRef in sync
  useEffect(() => {
    fullNameRef.current = fullName;
  }, [fullName]);

  // Send a message to the avatar using SDK
  const sendMessageToAvatar = useCallback(() => {
    if (!messageInput.trim() || !sdkInstanceRef.current || isSending) return;

    setIsSending(true);
    try {
      sdkInstanceRef.current.sendQuestion(messageInput.trim());
      console.log("Message sent to avatar:", messageInput);
      setMessageInput("");
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  }, [messageInput, isSending]);

  // Handle Enter key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessageToAvatar();
    }
  }, [sendMessageToAvatar]);

  // Trigger TV turn-off animation and show thank you screen
  const triggerTvOffAnimation = useCallback(() => {
    finishingRef.current = false;
    setShowTvOff(true);

    setTimeout(() => {
      setShowTvOff(false);
      setShowThankYou(true);

      if (sdkInstanceRef.current) {
        try {
          sdkInstanceRef.current.destroy();
          console.log("Avatar SDK destroyed");
        } catch (e) {
          console.error("Error destroying avatar SDK:", e);
        }
        sdkInstanceRef.current = null;
      }
      setAvatarReady(false);
    }, 1500);
  }, []);

  // Handle finish interview
  const handleFinishInterview = useCallback(() => {
    if (!sdkInstanceRef.current || isFinishing) return;

    setIsFinishing(true);
    finishingRef.current = true;
    finishMessageSentRef.current = true;
    avatarStartedSpeakingRef.current = false;

    const finishMessage = "The user has decided to end this interview early. Please wrap up with a warm, grateful closing message thanking them for their time and participation.";
    sdkInstanceRef.current.sendMessage({
      text: finishMessage,
      triggerResponse: true,
      delay: false,
      role: "system"
    });
    console.log("Finish interview system message sent");

    setTimeout(() => {
      if (finishingRef.current) {
        console.log("Fallback timeout reached, triggering animation");
        triggerTvOffAnimation();
      }
    }, 30000);
  }, [isFinishing, triggerTvOffAnimation]);

  // Track if interview has started
  const [interviewStarted, setInterviewStarted] = useState(false);

  // Handle workflow submission from AI
  const handleWorkflowSubmit = useCallback((workflowData: any) => {
    console.log("Workflow submitted:", workflowData);

    if (!interviewStarted) {
      setInterviewStarted(true);
    }

    const workflowName = workflowData.name || workflowData.workflow_name || "";
    const workflowDescription = workflowData.description || "";
    const workflowInputs = workflowData.inputs || workflowData.inputs_required || [];
    const workflowOutputs = workflowData.outputs || workflowData.outputs_generated || [];

    // Validate: skip if no name
    if (!workflowName.trim()) {
      console.warn("Skipping workflow with empty name:", workflowData);
      return;
    }

    // Check for duplicates using ref (immediate, not async state)
    const normalizedName = workflowName.toLowerCase().trim();
    if (submittedWorkflowNamesRef.current.has(normalizedName)) {
      console.warn("Skipping duplicate workflow (ref check):", workflowName);
      return;
    }

    // Mark as submitted immediately to prevent race conditions
    submittedWorkflowNamesRef.current.add(normalizedName);

    const newWorkflow: Workflow = {
      id: `workflow-${Date.now()}`,
      name: workflowName,
      description: workflowDescription,
      inputs: workflowInputs,
      outputs: workflowOutputs,
      timestamp: new Date().toISOString(),
    };

    setWorkflows((prev) => [...prev, newWorkflow]);

    // Save workflow to GCS if we have a session ID
    if (currentSessionId) {
      fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          fullName: fullNameRef.current,
          workflow: newWorkflow,
        }),
      })
        .then(res => res.json())
        .then(data => console.log("Workflow saved to GCS:", data))
        .catch(err => console.error("Failed to save workflow:", err));
    }
  }, [interviewStarted, currentSessionId]);

  // Extract readable text from content
  const extractDisplayText = useCallback((content: string, role: string): string | null => {
    if (role === "user") {
      return content;
    }

    const trimmed = content.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.message) return parsed.message;
        if (parsed.question) return parsed.question;
        if (parsed.text) return parsed.text;
        if (parsed.content) return parsed.content;
        if (parsed.type === "interview_complete") {
          return "Interview complete! Thank you for your responses.";
        }
        return null;
      } catch (e) {
        return content;
      }
    }
    return content;
  }, []);

  // Helper to add a transcript message
  const addTranscriptMessage = useCallback((message: any) => {
    if (!message || !message.content) return;

    const role = message.role === "user" ? "user" : "assistant";
    const displayText = extractDisplayText(message.content, role);

    if (!displayText) {
      console.log("Skipping non-displayable content:", message.content.substring(0, 100));
      return;
    }

    const newMessage: TranscriptMessage = {
      id: message.item_id || message.response_id || Date.now().toString(),
      role: role,
      content: displayText,
      timestamp: new Date().toISOString(),
    };

    console.log("Adding transcript:", newMessage);
    setTranscripts((prev) => {
      if (prev.some((msg) => msg.id === newMessage.id)) {
        return prev;
      }
      return [...prev, newMessage];
    });

    if (finishingRef.current && role === "assistant") {
      console.log("AI responded during finish sequence, triggering animation");
      setTimeout(() => {
        if (finishingRef.current) {
          triggerTvOffAnimation();
        }
      }, 3000);
    }
  }, [extractDisplayText, triggerTvOffAnimation]);

  // Handle function calls from the avatar
  const handleFunctionCall = useCallback((data: any) => {
    const { name, arguments: args, callId } = data.payload || {};
    console.log("📞 Function call:", name, args);

    if (name === "submit_workflow") {
      handleWorkflowSubmit(args);

      // Send response back to avatar
      if (sdkInstanceRef.current && callId) {
        sdkInstanceRef.current.sendFunctionOutput(callId, {
          success: true,
          message: `Workflow "${args?.name || 'Unnamed'}" documented successfully`
        });
      }
    }
  }, [handleWorkflowSubmit]);

  // Handle data from the SDK onData callback
  const handleSDKData = useCallback((data: any) => {
    try {
      console.log("SDK onData callback:", data);
      if (!data) return;

      // Handle NAPSTER_SPACES_SESSION_STARTED - capture session ID and save to GCS
      if (data.type === "NAPSTER_SPACES_SESSION_STARTED" && data.payload?.sessionId) {
        const rawSessionId = data.payload.sessionId;
        console.log("🎯 SESSION_STARTED - Session ID:", rawSessionId);
        setCurrentSessionId(rawSessionId);

        // Save session with full name to GCS
        const nameToSave = fullNameRef.current;
        if (nameToSave) {
          fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: rawSessionId,
              fullName: nameToSave,
              timestamp: new Date().toISOString(),
            }),
          }).then(res => res.json())
            .then(data => console.log("Session saved to GCS:", data))
            .catch(err => console.error("Failed to save session:", err));
        }
      }

      // Handle function calls - standard format (like audi-demo)
      if (data?.type === "NAPSTER_SPACES_FUNCTION_CALL") {
        console.log("🟢 Function call detected (standard format)");
        handleFunctionCall(data);
        return;
      }

      // Handle function calls via DATA_MESSAGES format (fallback)
      if (data?.type === "NAPSTER_SPACES_DATA_MESSAGES" &&
          data?.payload?.data?.message?.type === "function_call") {
        console.log("🟢 Function call detected (DATA_MESSAGES format)");
        const message = data.payload.data.message;

        // Parse the content - could be JSON string or object
        let args = {};
        try {
          if (message.arguments && typeof message.arguments === "string") {
            args = JSON.parse(message.arguments);
          } else if (message.arguments && typeof message.arguments === "object") {
            args = message.arguments;
          } else if (message.content && typeof message.content === "string") {
            args = JSON.parse(message.content);
          } else if (message.content && typeof message.content === "object") {
            args = message.content;
          }
        } catch (e) {
          console.error("Failed to parse function args:", e);
        }

        handleFunctionCall({
          payload: {
            name: message.name || "submit_workflow",
            arguments: args,
            callId: message.call_id
          }
        });
        return;
      }

      // Handle NAPSTER_SPACES_DATA_MESSAGES - transcripts
      if (data.type === "NAPSTER_SPACES_DATA_MESSAGES" && data.payload) {
        console.log("Avatar data payload:", data.payload);
        addTranscriptMessage(data.payload);
      }

      // Handle talk state changes
      if (data.type === "NAPSTER_SPACES_TALK_STATES") {
        console.log("🎤 Talk state from onData:", data);
        const state = data.payload?.state || data.data?.state;

        if (finishMessageSentRef.current) {
          if (state === "started") {
            console.log("Avatar started speaking after finish message");
            avatarStartedSpeakingRef.current = true;
            if (endAnimationTimeoutRef.current) {
              clearTimeout(endAnimationTimeoutRef.current);
              endAnimationTimeoutRef.current = null;
            }
          } else if (state === "ended" && avatarStartedSpeakingRef.current) {
            console.log("Avatar ended speaking, scheduling TV-off animation");
            if (endAnimationTimeoutRef.current) {
              clearTimeout(endAnimationTimeoutRef.current);
            }
            endAnimationTimeoutRef.current = setTimeout(() => {
              if (finishingRef.current && finishMessageSentRef.current) {
                console.log("Triggering TV-off animation after delay");
                triggerTvOffAnimation();
              }
            }, 2000);
          }
        }
      }

      // Handle session started event
      if (data.type === "NAPSTER_SPACES_SESSION_STARTED") {
        console.log("🎬 Session started (onData):", data);
        setSessionStarted(true);
      }
    } catch (error) {
      console.error("Error handling SDK data:", error);
    }
  }, [addTranscriptMessage, triggerTvOffAnimation, handleFunctionCall]);

  // Initialize SDK when script is loaded and profile modal is closed
  const initializeSDK = useCallback(async () => {
    if (!sdkLoaded || !avatarContainerRef.current || sdkInstanceRef.current || showProfileModal) {
      return;
    }

    try {
      const sdk = (window as any).napsterSpacesSDK;
      if (!sdk) {
        console.error("SDK not available on window");
        return;
      }

      console.log("🚀 Initializing Napster Spaces SDK");

      console.log("🔧 Functions library:", FUNCTIONS_LIBRARY_ID);

      const instance = await sdk.init({
        experienceId: EXPERIENCE_ID,
        container: avatarContainerRef.current,
        features: {
          backgroundRemoval: { enabled: true },
          waveform: { enabled: true, color: "#a855f7" },
          inactiveTimeout: { enabled: true, duration: 3 * 60 * 1000 },
        },
        // Use registered function via library ID (like audi-demo pattern)
        functionsLibraryId: FUNCTIONS_LIBRARY_ID,
        functions: ["submit_workflow"],
        onReady: () => {
          console.log("SDK is ready");
          setAvatarReady(true);
        },
        onAvatarReady: () => {
          console.log("Avatar is ready!");
          setAvatarReady(true);
        },
        onData: (data: any) => {
          console.log("📥 SDK onData:", data);
          try {
            handleSDKData(data);
          } catch (e) {
            console.warn("Error in data handler:", e);
          }
        },
        onError: (error: Error) => {
          console.error("SDK Error:", error);
        },
      });

      sdkInstanceRef.current = instance;
      console.log("SDK initialized successfully");
      instance.show();
      console.log("Widget shown");
    } catch (error) {
      console.error("Failed to initialize SDK:", error);
    }
  }, [sdkLoaded, handleSDKData, showProfileModal]);

  // Initialize SDK when loaded and profile modal closed
  useEffect(() => {
    initializeSDK();
  }, [initializeSDK]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sdkInstanceRef.current) {
        sdkInstanceRef.current.destroy();
        sdkInstanceRef.current = null;
      }
    };
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [transcripts]);

  // Handle profile form submission
  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    console.log("📧 Profile created:", fullName);
    setShowProfileModal(false);
  };

  return (
    <>
      {/* Load Napster Spaces SDK */}
      <link rel="stylesheet" href="/sdk/napster-spaces-sdk.css" />
      <Script
        src={`/sdk/napster-spaces-sdk.umd.js?v=${Date.now()}`}
        strategy="afterInteractive"
        onLoad={() => {
          console.log("Napster Spaces SDK script loaded");
          setSdkLoaded(true);
        }}
        onError={(e) => {
          console.error("Failed to load SDK script:", e);
        }}
      />

      {/* Profile Modal (audi-demo style) */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999999]">
          <div className="bg-white p-10 rounded-2xl max-w-md w-[90%] text-center">
            <span className="bg-gradient-to-r from-purple-600 to-purple-800 text-white px-3 py-1 rounded-full text-xs font-semibold inline-block mb-4">
              Interview
            </span>
            <h2 className="text-2xl mb-2 text-gray-900">Welcome to the Interview</h2>
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">
              Enter your full name to begin the AI-powered interview session.
              Your responses will help us understand your needs better.
            </p>
            <form onSubmit={handleProfileSubmit} className="flex flex-col gap-3">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                required
                autoFocus
                className="px-4 py-3.5 border-2 border-gray-200 rounded-lg text-base outline-none transition-colors focus:border-purple-600 text-gray-900"
              />
              <button
                type="submit"
                className="bg-gradient-to-r from-purple-600 to-purple-800 text-white px-6 py-3.5 border-none rounded-lg text-base font-semibold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-500/30"
              >
                Continue
              </button>
            </form>
            <p className="mt-4 text-xs text-gray-400">
              Your data is stored securely for interview purposes only.
            </p>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#4a1942] relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-600/30 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-800/20 rounded-full blur-[128px]" />

        {/* Header */}
        <header className="bg-white w-full px-6 py-4 flex items-center justify-between">
          <img src="/logo.svg" alt="Logo" className="h-8" />
          <h1 className="text-xl md:text-2xl text-black font-semibold">
            AI Personal Interview
          </h1>
          <div className="w-32"></div>
        </header>

        {/* Main Content */}
        <main className="px-6 pb-6 mt-8">
          {/* Three Column Layout */}
          <div className="flex justify-center items-start gap-6 max-w-7xl mx-auto">
            {/* Left Sidebar - Identified Workflows (wider) */}
            <div className="hidden lg:flex flex-col gap-3 pt-8 min-w-[320px] max-w-[380px] flex-shrink-0">
              {/* Workflows Header */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span className="text-white font-medium">Identified Workflows</span>
                </div>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Workflows identified during the interview will appear here.
                </p>
              </div>

              {/* Workflow Counter */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Documented</span>
                  <span className="text-purple-400 font-bold text-lg">{workflows.length}</span>
                </div>
              </div>

              {/* Workflow Cards */}
              {workflows.length === 0 ? (
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-dashed border-white/20">
                  <p className="text-gray-500 text-sm text-center">
                    No workflows identified yet. The AI will document workflows as they are discovered.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                  {workflows.map((workflow, index) => (
                    <div
                      key={workflow.id}
                      className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10 transition-all hover:bg-white/15"
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <span className="bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          #{index + 1}
                        </span>
                        <h4 className="text-purple-400 font-medium text-sm leading-tight">{workflow.name}</h4>
                      </div>
                      <p className="text-gray-400 text-xs mb-3 line-clamp-2">{workflow.description}</p>

                      {/* Inputs */}
                      {workflow.inputs.length > 0 && (
                        <div className="mb-2">
                          <p className="text-green-400 text-xs font-medium mb-1">Inputs:</p>
                          <div className="flex flex-wrap gap-1">
                            {workflow.inputs.slice(0, 3).map((input, i) => (
                              <span key={i} className="bg-green-500/20 text-green-300 text-xs px-2 py-0.5 rounded">
                                {input}
                              </span>
                            ))}
                            {workflow.inputs.length > 3 && (
                              <span className="text-gray-500 text-xs">+{workflow.inputs.length - 3} more</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Outputs */}
                      {workflow.outputs.length > 0 && (
                        <div>
                          <p className="text-blue-400 text-xs font-medium mb-1">Outputs:</p>
                          <div className="flex flex-wrap gap-1">
                            {workflow.outputs.slice(0, 3).map((output, i) => (
                              <span key={i} className="bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded">
                                {output}
                              </span>
                            ))}
                            {workflow.outputs.length > 3 && (
                              <span className="text-gray-500 text-xs">+{workflow.outputs.length - 3} more</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Center - Avatar and Chat Transcript (smaller) */}
            <div className="flex-1 max-w-lg flex flex-col gap-3">
              {/* Avatar Container with Office Background */}
              <div
                className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 max-h-[280px]"
                style={{
                  backgroundImage: "url('/office-background.jpg')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div className="aspect-video relative max-h-[280px]">
                  {/* SDK Avatar Container */}
                  <div ref={avatarContainerRef} className="w-full h-full max-h-[280px]" />
                  {/* Loading state overlay */}
                  {!avatarReady && !showProfileModal && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                      <div className="text-center">
                        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-white text-sm">Loading AI Avatar...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Transcript */}
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="text-white font-medium text-sm">Conversation Transcript</span>
                  {transcripts.length > 0 && (
                    <span className="ml-auto text-xs text-gray-400">{transcripts.length} messages</span>
                  )}
                </div>
                <div
                  ref={chatContainerRef}
                  className="h-36 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
                >
                  {transcripts.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                      <p>Conversation transcript will appear here...</p>
                    </div>
                  ) : (
                    transcripts.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                            message.role === "user"
                              ? "bg-purple-600 text-white rounded-br-md"
                              : "bg-white/10 text-gray-200 rounded-bl-md"
                          }`}
                        >
                          <p className="text-sm leading-relaxed">{message.content}</p>
                          <p className="text-xs mt-1 opacity-60">
                            {new Date(message.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Message Input */}
                <div className="px-4 py-3 border-t border-white/10">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type your message..."
                      disabled={!avatarReady || isSending}
                      className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                      onClick={sendMessageToAvatar}
                      disabled={!avatarReady || !messageInput.trim() || isSending}
                      className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      <span className="text-sm">Send</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Sidebar - Hints & Finish */}
            <div className="hidden lg:flex flex-col gap-4 w-64 pt-8">
              {/* Hints Card */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <button
                  onClick={() => setHintsOpen(!hintsOpen)}
                  className="flex items-center justify-between w-full text-white font-medium"
                >
                  <span>Hints:</span>
                  <svg
                    className={`w-5 h-5 transition-transform ${hintsOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                {hintsOpen && (
                  <p className="mt-3 text-gray-300 text-sm leading-relaxed">
                    Speak naturally and share your experiences. The AI interviewer will guide you through the conversation.
                  </p>
                )}
              </div>

              {/* Participant Info */}
              {currentSessionId && (
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                  <p className="text-gray-400 text-xs">Participant</p>
                  <p className="text-white font-medium">{fullName}</p>
                  <p className="text-gray-400 text-xs mt-2">Session</p>
                  <p className="text-gray-300 text-xs font-mono">{currentSessionId.substring(0, 16)}...</p>
                </div>
              )}

              {/* Finish Interview Button */}
              {sessionStarted && (
                <button
                  onClick={handleFinishInterview}
                  disabled={!avatarReady || isFinishing}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-white/10 text-white rounded-full border border-white/20 hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isFinishing ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Finishing...
                    </>
                  ) : (
                    <>
                      Finish Interview
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* TV Turn-Off Animation Overlay */}
      {showTvOff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="tv-off-animation">
            <div className="tv-line"></div>
          </div>
          <style jsx>{`
            .tv-off-animation {
              width: 100%;
              height: 100%;
              background: white;
              animation: tvOff 1.5s ease-out forwards;
            }
            .tv-line {
              position: absolute;
              top: 50%;
              left: 0;
              right: 0;
              height: 4px;
              background: white;
              transform: translateY(-50%);
              animation: tvLine 1.5s ease-out forwards;
            }
            @keyframes tvOff {
              0% { transform: scale(1, 1); filter: brightness(1); }
              50% { transform: scale(1, 0.005); filter: brightness(2); }
              100% { transform: scale(0, 0); filter: brightness(0); }
            }
            @keyframes tvLine {
              0% { opacity: 0; }
              40% { opacity: 1; }
              100% { opacity: 0; }
            }
          `}</style>
        </div>
      )}

      {/* Thank You Screen */}
      {showThankYou && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
          <div className="text-center animate-fadeIn">
            <div className="mb-8">
              <svg className="w-24 h-24 mx-auto text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">Thank You, {fullName}!</h1>
            <p className="text-xl text-gray-300 mb-8">
              Thank you for participating in the interview.
            </p>
            <p className="text-gray-400 mb-8">
              Your responses have been recorded and will help us serve you better.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors font-medium"
            >
              Start New Interview
            </button>
          </div>
          <style jsx>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .animate-fadeIn {
              animation: fadeIn 0.8s ease-out forwards;
            }
          `}</style>
        </div>
      )}
    </>
  );
}