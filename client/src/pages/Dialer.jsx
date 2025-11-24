import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import { Phone, PhoneOff, Pause, Play, ArrowRight, MessageSquare, FileText, Clock, AlertCircle, CheckCircle, Headphones, Mic, Volume2, PhoneForwarded, Send, VolumeX, Volume1 } from 'lucide-react';
import toast from 'react-hot-toast';

const Dialer = () => {
  const { socket } = useSocket();
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [currentLead, setCurrentLead] = useState(null);
  const [currentCall, setCurrentCall] = useState(null);
  const [isOnCall, setIsOnCall] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [callStatus, setCallStatus] = useState('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const [disposition, setDisposition] = useState('');
  const [phoneValidation, setPhoneValidation] = useState({ isValid: false, message: '' });
  const [whisperMessage, setWhisperMessage] = useState('');
  const [transferNumber, setTransferNumber] = useState('');
  const [showControls, setShowControls] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // WebSocket refs for live listening
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioNodeRef = useRef(null);

  // Validate international phone number (E.164 format)
  const validatePhoneNumber = (phone) => {
    if (!phone) {
      return { isValid: false, message: '' };
    }

    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');

    // E.164 format: + followed by country code and number (7-15 digits total)
    const e164Pattern = /^\+[1-9]\d{6,14}$/;

    // Common patterns without + prefix
    const usPattern = /^1?\d{10}$/; // US: 10 digits or 1+10 digits
    const intlPattern = /^\d{7,15}$/; // Generic international

    if (e164Pattern.test(cleaned)) {
      return { isValid: true, message: 'Valid international number' };
    } else if (usPattern.test(cleaned)) {
      return { isValid: true, message: 'Valid US/Canada number' };
    } else if (intlPattern.test(cleaned)) {
      return { isValid: true, message: 'Valid phone number' };
    } else if (cleaned.length < 7) {
      return { isValid: false, message: 'Phone number is too short' };
    } else if (cleaned.length > 16) {
      return { isValid: false, message: 'Phone number is too long' };
    } else {
      return { isValid: false, message: 'Invalid phone number format' };
    }
  };

  // Normalize phone number to E.164 format
  const normalizePhoneNumber = (phone) => {
    const cleaned = phone.replace(/[^\d+]/g, '');

    // Already in E.164 format
    if (cleaned.startsWith('+')) {
      return cleaned;
    }

    // US/Canada: 10 digits -> +1
    if (cleaned.length === 10) {
      return '+1' + cleaned;
    }

    // US/Canada: 11 digits starting with 1
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return '+' + cleaned;
    }

    // Default: assume it needs +1 prefix
    return '+1' + cleaned;
  };

  // Update validation when phone number changes
  useEffect(() => {
    setPhoneValidation(validatePhoneNumber(phoneNumber));
  }, [phoneNumber]);

  useEffect(() => {
    fetchCampaigns();
  }, []);

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
          // Fetch call status to detect if call ended
          const statusResponse = await api.get(`/vapi/call/${currentCall.call.id}`);
          const callData = statusResponse.data.data;
          const vapiStatus = callData.vapiDetails?.status;
          const dbStatus = callData.status;

          // Debug logging - check browser console to see what VAPI returns
          console.log('Call status check:', {
            vapiStatus,
            dbStatus,
            vapiDetails: callData.vapiDetails,
            fullData: callData
          });

          // Check if call has ended - multiple conditions
          const endedStatuses = ['ended', 'failed', 'busy', 'no-answer'];
          const dbEndedStatuses = ['completed', 'failed', 'no_answer'];

          if (endedStatuses.includes(vapiStatus) || dbEndedStatuses.includes(dbStatus)) {
            console.log('Call ended detected!', { vapiStatus, dbStatus });
            setIsOnCall(false);
            setCallStatus('ended');
            setShowControls(false);
            setIsMuted(false);
            stopListening();
            const reason = callData.vapiDetails?.endedReason || callData.notes || 'completed';
            toast.info(`Call ended: ${reason}`);
            return; // Stop polling
          }

          // Update call status display based on VAPI status
          if (vapiStatus === 'in-progress' || vapiStatus === 'forwarding') {
            setCallStatus('in-progress');
          } else if (vapiStatus === 'ringing' || vapiStatus === 'queued') {
            setCallStatus('ringing');
          }

          // Fetch transcript
          try {
            const transcriptResponse = await api.get(`/vapi/call/${currentCall.call.id}/transcript`);
            if (transcriptResponse.data.data && transcriptResponse.data.data.length > 0) {
              // Format transcript messages
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
          // Only end call on 404 if we've been polling for a while
          // Don't immediately assume call ended on first error
          console.log('Status fetch error:', error.message);
        }
      };

      // Initial fetch after 5 seconds (give call more time to start)
      const initialDelay = setTimeout(fetchCallStatus, 5000);

      // Poll every 3 seconds
      pollTimer = setInterval(fetchCallStatus, 3000);

      return () => {
        clearTimeout(initialDelay);
        clearInterval(pollTimer);
      };
    }
  }, [isOnCall, currentCall]);

  useEffect(() => {
    if (socket) {
      socket.on('call:connected', (data) => {
        if (currentCall?.vapiCall?.id === data.vapiCallId) {
          setCallStatus('in-progress');
          setShowControls(true);
          toast.success('Call connected');
        }
      });

      socket.on('call:ended', (data) => {
        if (currentCall?.vapiCall?.id === data.vapiCallId) {
          setIsOnCall(false);
          setCallStatus('ended');
          setShowControls(false);
          toast.info(`Call ended: ${data.reason || 'completed'}`);
        }
      });

      socket.on('call:transcript', (data) => {
        if (currentCall?.vapiCall?.id === data.vapiCallId) {
          // Handle both array and single message format
          if (Array.isArray(data.transcript)) {
            setTranscript(data.transcript);
          } else if (data.transcript) {
            setTranscript(prev => [...prev, data.transcript]);
          }
        }
      });

      socket.on('call:speech', (data) => {
        if (currentCall?.vapiCall?.id === data.vapiCallId) {
          // Could be used to show speaking indicators
        }
      });

      return () => {
        socket.off('call:connected');
        socket.off('call:ended');
        socket.off('call:transcript');
        socket.off('call:speech');
      };
    }
  }, [socket, currentCall]);

  const fetchCampaigns = async () => {
    try {
      const response = await api.get('/campaigns', { params: { status: 'active' } });
      setCampaigns(response.data.data);
    } catch (error) {
      toast.error('Failed to fetch campaigns');
    }
  };

  const fetchNextLead = async () => {
    if (!selectedCampaign) {
      toast.error('Please select a campaign');
      return;
    }

    try {
      const response = await api.get(`/leads/next/${selectedCampaign}`);
      setCurrentLead(response.data.data);
      setPhoneNumber(response.data.data.phone);
      setTranscript([]);
      setDisposition('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'No leads available');
    }
  };

  const initiateCall = async () => {
    if (!phoneNumber) {
      toast.error('Please enter a phone number');
      return;
    }

    if (!phoneValidation.isValid) {
      toast.error('Please enter a valid phone number');
      return;
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    try {
      // Use VAPI to make the call
      const response = await api.post('/vapi/call', {
        leadId: currentLead?.id,
        campaignId: selectedCampaign,
        phoneNumber: normalizedPhone,
      });

      setCurrentCall(response.data.data);
      setIsOnCall(true);
      setCallStatus('in-progress');
      setCallDuration(0);
      setShowControls(true);
      toast.success('Call initiated with AI assistant');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to initiate call');
    }
  };

  const endCall = async () => {
    if (!currentCall) return;

    try {
      await api.post(`/vapi/call/${currentCall.call.id}/end`);
      setIsOnCall(false);
      setCallStatus('ended');
      setShowControls(false);
      setIsMuted(false);
      stopListening();
      toast.success('Call ended');
    } catch (error) {
      toast.error('Failed to end call');
    }
  };

  const listenToCall = async () => {
    if (!currentCall) return;

    // If already listening, stop
    if (isListening) {
      stopListening();
      return;
    }

    const listenUrl = currentCall.listenUrl;
    if (!listenUrl) {
      toast.error('Listen URL not available for this call');
      return;
    }

    try {
      // Create audio context at device's native sample rate for better performance
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const deviceSampleRate = audioContextRef.current.sampleRate;

      // Connect to WebSocket
      wsRef.current = new WebSocket(listenUrl);
      wsRef.current.binaryType = 'arraybuffer';

      wsRef.current.onopen = () => {
        setIsListening(true);
        toast.success('Now listening to call');
      };

      wsRef.current.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer && audioContextRef.current) {
          const int16Array = new Int16Array(event.data);

          // Convert 16-bit PCM to Float32 [-1.0, 1.0]
          const float32Array = new Float32Array(int16Array.length);
          for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / 32768.0;
          }

          // Resample from 16kHz to device sample rate if needed
          const inputSampleRate = 16000;
          let audioData = float32Array;

          if (deviceSampleRate !== inputSampleRate) {
            const ratio = deviceSampleRate / inputSampleRate;
            const newLength = Math.round(float32Array.length * ratio);
            audioData = new Float32Array(newLength);

            for (let i = 0; i < newLength; i++) {
              const srcIndex = i / ratio;
              const srcIndexFloor = Math.floor(srcIndex);
              const srcIndexCeil = Math.min(srcIndexFloor + 1, float32Array.length - 1);
              const t = srcIndex - srcIndexFloor;
              audioData[i] = float32Array[srcIndexFloor] * (1 - t) + float32Array[srcIndexCeil] * t;
            }
          }

          // Create audio buffer and play immediately
          const audioBuffer = audioContextRef.current.createBuffer(1, audioData.length, deviceSampleRate);
          audioBuffer.getChannelData(0).set(audioData);

          const source = audioContextRef.current.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContextRef.current.destination);
          source.start();
        }
      };

      wsRef.current.onclose = () => {
        setIsListening(false);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast.error('Audio stream error');
        stopListening();
      };
    } catch (error) {
      console.error('Failed to start listening:', error);
      toast.error('Failed to start listening');
    }
  };

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

  const sendWhisper = async () => {
    if (!currentCall || !whisperMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    try {
      await api.post(`/vapi/call/${currentCall.call.id}/whisper`, {
        message: whisperMessage,
        controlUrl: currentCall.controlUrl,
      });
      toast.success('Whisper sent to AI');
      setWhisperMessage('');
    } catch (error) {
      toast.error('Failed to send whisper');
    }
  };

  const sendBarge = async () => {
    if (!currentCall || !whisperMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    try {
      await api.post(`/vapi/call/${currentCall.call.id}/barge`, {
        message: whisperMessage,
        controlUrl: currentCall.controlUrl,
      });
      toast.success('Message sent to both parties');
      setWhisperMessage('');
    } catch (error) {
      toast.error('Failed to barge into call');
    }
  };

  const transferCall = async () => {
    if (!currentCall || !transferNumber.trim()) {
      toast.error('Please enter a transfer number');
      return;
    }

    try {
      await api.post(`/vapi/call/${currentCall.call.id}/transfer`, {
        destination: transferNumber,
        controlUrl: currentCall.controlUrl,
      });
      toast.success('Call transferred');
      setTransferNumber('');
      setIsOnCall(false);
      setCallStatus('transferred');
      stopListening();
    } catch (error) {
      toast.error('Failed to transfer call');
    }
  };

  const muteAssistant = async () => {
    if (!currentCall) return;

    try {
      const control = isMuted ? 'unmute-assistant' : 'mute-assistant';
      await api.post(`/vapi/call/${currentCall.call.id}/control`, {
        control,
        controlUrl: currentCall.controlUrl,
      });
      setIsMuted(!isMuted);
      toast.success(isMuted ? 'Assistant unmuted' : 'Assistant muted');
    } catch (error) {
      toast.error('Failed to mute/unmute assistant');
    }
  };

  const saveDisposition = async () => {
    if (!currentCall || !disposition) {
      toast.error('Please select a disposition');
      return;
    }

    try {
      await api.patch(`/calls/${currentCall.call.id}/disposition`, {
        disposition,
        notes: transcript.map(t => `${t.role}: ${t.content}`).join('\n'),
      });

      // Update lead status based on disposition
      if (currentLead) {
        const statusMap = {
          'interested': 'contacted',
          'not_interested': 'not_interested',
          'callback': 'callback',
          'converted': 'converted',
          'no_answer': 'contacted',
          'busy': 'contacted',
          'voicemail': 'contacted',
        };

        await api.patch(`/leads/${currentLead.id}`, {
          status: statusMap[disposition] || 'contacted',
          lastDisposition: disposition,
        });
      }

      toast.success('Disposition saved');

      // Reset for next call
      setCurrentCall(null);
      setCurrentLead(null);
      setPhoneNumber('');
      setTranscript([]);
      setDisposition('');
      setCallStatus('idle');
    } catch (error) {
      toast.error('Failed to save disposition');
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const dispositionOptions = [
    { value: 'interested', label: 'Interested' },
    { value: 'not_interested', label: 'Not Interested' },
    { value: 'callback', label: 'Callback Requested' },
    { value: 'converted', label: 'Converted/Sale' },
    { value: 'no_answer', label: 'No Answer' },
    { value: 'busy', label: 'Busy' },
    { value: 'voicemail', label: 'Voicemail' },
    { value: 'wrong_number', label: 'Wrong Number' },
    { value: 'dnc', label: 'Do Not Call' },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">AI Dialer</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dialer Panel */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Make a Call</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Campaign
              </label>
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className="input"
                disabled={isOnCall}
              >
                <option value="">Select a campaign</option>
                {campaigns.map((campaign) => (
                  <option key={campaign._id} value={campaign._id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <div className="flex space-x-2">
                <div className="flex-1 relative">
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className={`input pr-10 ${
                      phoneNumber
                        ? phoneValidation.isValid
                          ? 'border-green-500 focus:ring-green-500'
                          : 'border-red-500 focus:ring-red-500'
                        : ''
                    }`}
                    placeholder="+63 9XX XXX XXXX"
                    disabled={isOnCall}
                  />
                  {phoneNumber && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      {phoneValidation.isValid ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={fetchNextLead}
                  className="btn btn-secondary"
                  disabled={!selectedCampaign || isOnCall}
                  title="Get next lead"
                >
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
              {phoneNumber && phoneValidation.message && (
                <p className={`text-xs mt-1 ${phoneValidation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                  {phoneValidation.message}
                </p>
              )}
            </div>

            {/* Call Status */}
            {callStatus !== 'idle' && (
              <div className="text-center py-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="font-mono text-lg">{formatDuration(callDuration)}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1 capitalize">{callStatus}</p>
              </div>
            )}

            <div className="flex space-x-2 pt-4">
              {!isOnCall ? (
                <button
                  onClick={initiateCall}
                  className="btn btn-success flex-1 flex items-center justify-center"
                  disabled={!phoneNumber || !phoneValidation.isValid || !selectedCampaign}
                >
                  <Phone className="h-5 w-5 mr-2" />
                  Call with AI
                </button>
              ) : (
                <button
                  onClick={endCall}
                  className="btn btn-danger flex-1 flex items-center justify-center"
                >
                  <PhoneOff className="h-5 w-5 mr-2" />
                  End Call
                </button>
              )}
            </div>

            {/* Call Controls */}
            {showControls && isOnCall && (
              <div className="space-y-3 pt-4 border-t">
                <h3 className="text-sm font-medium text-gray-700">Call Controls</h3>

                {/* Listen and Mute Buttons */}
                <div className="flex space-x-2">
                  <button
                    onClick={listenToCall}
                    className={`btn flex-1 flex items-center justify-center ${
                      isListening ? 'btn-success' : 'btn-secondary'
                    }`}
                  >
                    <Headphones className="h-4 w-4 mr-2" />
                    {isListening ? 'Listening...' : 'Listen'}
                  </button>
                  <button
                    onClick={muteAssistant}
                    className={`btn flex-1 flex items-center justify-center ${
                      isMuted ? 'btn-warning' : 'btn-secondary'
                    }`}
                    title={isMuted ? 'Unmute Assistant' : 'Mute Assistant'}
                  >
                    {isMuted ? (
                      <>
                        <VolumeX className="h-4 w-4 mr-2" />
                        Unmute
                      </>
                    ) : (
                      <>
                        <Volume1 className="h-4 w-4 mr-2" />
                        Mute
                      </>
                    )}
                  </button>
                </div>

                {/* Whisper/Barge Input */}
                <div className="space-y-2">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={whisperMessage}
                      onChange={(e) => setWhisperMessage(e.target.value)}
                      placeholder="Message to AI or customer..."
                      className="input flex-1 text-sm"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={sendWhisper}
                      className="btn btn-secondary flex-1 text-xs py-1.5 flex items-center justify-center"
                      title="Only AI hears this"
                    >
                      <Mic className="h-3 w-3 mr-1" />
                      Whisper
                    </button>
                    <button
                      onClick={sendBarge}
                      className="btn btn-secondary flex-1 text-xs py-1.5 flex items-center justify-center"
                      title="Both parties hear this"
                    >
                      <Volume2 className="h-3 w-3 mr-1" />
                      Barge
                    </button>
                  </div>
                </div>

                {/* Transfer */}
                <div className="space-y-2">
                  <div className="flex space-x-2">
                    <input
                      type="tel"
                      value={transferNumber}
                      onChange={(e) => setTransferNumber(e.target.value)}
                      placeholder="Transfer to number..."
                      className="input flex-1 text-sm"
                    />
                    <button
                      onClick={transferCall}
                      className="btn btn-secondary flex items-center"
                      disabled={!transferNumber}
                    >
                      <PhoneForwarded className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Disposition */}
            {callStatus === 'ended' && (
              <div className="space-y-3 pt-4 border-t">
                <label className="block text-sm font-medium text-gray-700">
                  Call Disposition
                </label>
                <select
                  value={disposition}
                  onChange={(e) => setDisposition(e.target.value)}
                  className="input"
                >
                  <option value="">Select disposition...</option>
                  {dispositionOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={saveDisposition}
                  className="btn btn-primary w-full"
                  disabled={!disposition}
                >
                  Save & Next
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Lead Info */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Lead Information</h2>

          {currentLead ? (
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-500">Name</span>
                <p className="font-medium">
                  {currentLead.first_name} {currentLead.last_name}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Phone</span>
                <p className="font-medium">{currentLead.phone}</p>
              </div>
              {currentLead.email && (
                <div>
                  <span className="text-sm text-gray-500">Email</span>
                  <p className="font-medium">{currentLead.email}</p>
                </div>
              )}
              <div>
                <span className="text-sm text-gray-500">Status</span>
                <p>
                  <span className="badge bg-blue-100 text-blue-800">
                    {currentLead.status}
                  </span>
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Attempts</span>
                <p className="font-medium">{currentLead.attempts}</p>
              </div>

              {currentLead.campaign?.script && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Script</span>
                  <p className="text-sm mt-1">{currentLead.campaign.script}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              Select a campaign and click the arrow to get the next lead
            </p>
          )}
        </div>

        {/* Live Transcript */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <MessageSquare className="h-5 w-5 mr-2" />
            Live Transcript
          </h2>

          <div className="h-80 overflow-y-auto space-y-3">
            {transcript.length > 0 ? (
              transcript.map((message, index) => (
                <div
                  key={index}
                  className={`p-2 rounded-lg text-sm ${
                    message.role === 'assistant'
                      ? 'bg-blue-50 text-blue-900'
                      : message.role === 'user'
                      ? 'bg-gray-100 text-gray-900'
                      : 'bg-yellow-50 text-yellow-900'
                  }`}
                >
                  <span className="font-medium capitalize">{message.role}:</span>{' '}
                  {message.content}
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">
                {isOnCall
                  ? 'Waiting for conversation...'
                  : 'Transcript will appear here during the call'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dialer;
