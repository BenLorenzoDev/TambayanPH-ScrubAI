import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useSocket } from './SocketContext';
import api from '../services/api';

const CallContext = createContext(null);

export const CallProvider = ({ children }) => {
  const { socket } = useSocket();

  // Active call state
  const [currentCall, setCurrentCall] = useState(null);
  const [isOnCall, setIsOnCall] = useState(false);
  const [callStatus, setCallStatus] = useState('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const [currentLead, setCurrentLead] = useState(null);
  const [showControls, setShowControls] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // WebSocket refs for live listening
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioNodeRef = useRef(null);

  // Call duration timer
  useEffect(() => {
    let timer;
    if (isOnCall && (callStatus === 'in-progress' || callStatus === 'initiated' || callStatus === 'ringing')) {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOnCall, callStatus]);

  // Poll for call status and transcript updates during active call
  useEffect(() => {
    let pollTimer;
    if (isOnCall && currentCall?.call?.id) {
      const fetchCallStatus = async () => {
        try {
          const statusResponse = await api.get(`/vapi/call/${currentCall.call.id}`);
          const callData = statusResponse.data.data;
          const vapiStatus = callData.vapiDetails?.status;
          const dbStatus = callData.status;

          // Check if call has ended
          const endedStatuses = ['ended', 'failed', 'busy', 'no-answer'];
          const dbEndedStatuses = ['completed', 'failed', 'no_answer'];

          if (endedStatuses.includes(vapiStatus) || dbEndedStatuses.includes(dbStatus)) {
            setIsOnCall(false);
            setCallStatus('ended');
            setShowControls(false);
            setIsMuted(false);
            stopListening();
            return;
          }

          // Update call status
          if (vapiStatus === 'in-progress' || vapiStatus === 'forwarding') {
            setCallStatus('in-progress');
          } else if (vapiStatus === 'ringing' || vapiStatus === 'queued') {
            setCallStatus('ringing');
          }

          // Fetch transcript
          try {
            const transcriptResponse = await api.get(`/vapi/call/${currentCall.call.id}/transcript`);
            if (transcriptResponse.data.data && transcriptResponse.data.data.length > 0) {
              const formattedTranscript = transcriptResponse.data.data.map(msg => ({
                role: msg.role || 'assistant',
                content: msg.content || msg.message || msg.text || '',
              })).filter(msg => msg.content);

              if (formattedTranscript.length > 0) {
                setTranscript(formattedTranscript);
              }
            }
          } catch (transcriptError) {
            // Transcript fetch can fail without meaning call ended
          }
        } catch (error) {
          console.log('Status fetch error:', error.message);
        }
      };

      const initialDelay = setTimeout(fetchCallStatus, 5000);
      pollTimer = setInterval(fetchCallStatus, 3000);

      return () => {
        clearTimeout(initialDelay);
        clearInterval(pollTimer);
      };
    }
  }, [isOnCall, currentCall]);

  // Socket event listeners
  useEffect(() => {
    if (socket && currentCall) {
      socket.on('call:connected', (data) => {
        if (currentCall?.vapiCall?.id === data.vapiCallId) {
          setCallStatus('in-progress');
          setShowControls(true);
        }
      });

      socket.on('call:ended', (data) => {
        if (currentCall?.vapiCall?.id === data.vapiCallId) {
          setIsOnCall(false);
          setCallStatus('ended');
          setShowControls(false);
        }
      });

      socket.on('call:transcript', (data) => {
        if (currentCall?.vapiCall?.id === data.vapiCallId) {
          if (Array.isArray(data.transcript)) {
            setTranscript(data.transcript);
          } else if (data.transcript) {
            setTranscript(prev => [...prev, data.transcript]);
          }
        }
      });

      return () => {
        socket.off('call:connected');
        socket.off('call:ended');
        socket.off('call:transcript');
      };
    }
  }, [socket, currentCall]);

  const stopListening = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (audioNodeRef.current) {
      audioNodeRef.current.disconnect();
      audioNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsListening(false);
  };

  const startCall = (callData, leadData) => {
    setCurrentCall(callData);
    setCurrentLead(leadData);
    setIsOnCall(true);
    setCallStatus('in-progress');
    setCallDuration(0);
    setShowControls(true);
    setTranscript([]);
  };

  const endCall = () => {
    setIsOnCall(false);
    setCallStatus('ended');
    setShowControls(false);
    setIsMuted(false);
    stopListening();
  };

  const clearCall = () => {
    setCurrentCall(null);
    setCurrentLead(null);
    setIsOnCall(false);
    setCallStatus('idle');
    setCallDuration(0);
    setTranscript([]);
    setShowControls(false);
    setIsListening(false);
    setIsMuted(false);
    stopListening();
  };

  return (
    <CallContext.Provider
      value={{
        // State
        currentCall,
        currentLead,
        isOnCall,
        callStatus,
        callDuration,
        transcript,
        showControls,
        isListening,
        isMuted,

        // Refs
        wsRef,
        audioContextRef,
        audioNodeRef,

        // Actions
        setCurrentCall,
        setCurrentLead,
        setIsOnCall,
        setCallStatus,
        setCallDuration,
        setTranscript,
        setShowControls,
        setIsListening,
        setIsMuted,
        startCall,
        endCall,
        clearCall,
        stopListening,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
