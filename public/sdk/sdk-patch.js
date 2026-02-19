// SDK Patch: Intercept function_implicitly_called events
// This patches console.log to capture WebRTC messages that the SDK logs but doesn't forward

(function() {
  'use strict';
  
  // Store the original console.log
  const originalConsoleLog = console.log;
  
  // Create a global callback registry
  window.__napsterFunctionCallbacks = window.__napsterFunctionCallbacks || [];
  
  // Register a callback to receive function calls
  window.registerNapsterFunctionCallback = function(callback) {
    window.__napsterFunctionCallbacks.push(callback);
    console.log('[SDK Patch] Function callback registered');
  };
  
  // Patch console.log to intercept WebRTC messages
  console.log = function(...args) {
    // Call original
    originalConsoleLog.apply(console, args);
    
    // Check if this is a WebRTC message log
    if (args.length >= 2) {
      const firstArg = args[0];
      const secondArg = args[1];
      
      // Check for "WebRTC received message:" pattern
      if (typeof firstArg === 'string' && firstArg.includes('WebRTC received message')) {
        // The data object should be in the second argument
        try {
          let data = secondArg;
          
          // If it's an object with event: "function_implicitly_called"
          if (data && data.event === 'function_implicitly_called') {
            console.warn('[SDK Patch] 🎯 INTERCEPTED function_implicitly_called:', data);

            // If this is a report_progress call, dispatch custom event for React to handle
            if (data.data && data.data.name === 'report_progress') {
              const args = typeof data.data.arguments === 'string'
                ? JSON.parse(data.data.arguments)
                : data.data.arguments;
              const callId = data.data.call_id;

              console.warn('[SDK Patch] 📊 Dispatching progress event:', args);
              window.dispatchEvent(new CustomEvent('napster-progress-update', {
                detail: { args, callId }
              }));
            }

            // Notify all registered callbacks
            window.__napsterFunctionCallbacks.forEach(function(cb) {
              try {
                cb(data);
              } catch (e) {
                console.error('[SDK Patch] Callback error:', e);
              }
            });
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }
  };
  
  console.log('[SDK Patch] Console.log interceptor installed');
})();

