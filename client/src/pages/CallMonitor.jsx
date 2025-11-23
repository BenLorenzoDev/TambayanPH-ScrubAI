import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import {
  Headphones,
  MessageSquare,
  PhoneForwarded,
  PhoneOff,
  Volume2,
  VolumeX,
  Clock,
  User,
  Phone,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

const CallMonitor = () => {
  const { socket } = useSocket();
  const [activeCalls, setActiveCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [whisperMessage, setWhisperMessage] = useState('');
  const [showWhisperModal, setShowWhisperModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferNumber, setTransferNumber] = useState('');

  useEffect(() => {
    fetchActiveCalls();
    const interval = setInterval(fetchActiveCalls, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('call:started', () => fetchActiveCalls());
      socket.on('call:connected', () => fetchActiveCalls());
      socket.on('call:ended', (data) => {
        fetchActiveCalls();
        if (selectedCall?.vapi_call_id === data.vapiCallId) {
          setSelectedCall(null);
          setIsListening(false);
          setTranscript([]);
        }
      });
      socket.on('call:transferred', () => fetchActiveCalls());

      socket.on('call:transcript', (data) => {
        if (selectedCall?.vapi_call_id === data.vapiCallId) {
          setTranscript(data.transcript);
        }
      });

      return () => {
        socket.off('call:started');
        socket.off('call:connected');
        socket.off('call:ended');
        socket.off('call:transferred');
        socket.off('call:transcript');
      };
    }
  }, [socket, selectedCall]);

  const fetchActiveCalls = async () => {
    try {
      const response = await api.get('/vapi/calls/active');
      setActiveCalls(response.data.data);
    } catch (error) {
      console.error('Failed to fetch active calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleListen = async (call) => {
    try {
      const response = await api.get(`/vapi/call/${call.id}/listen`);
      setSelectedCall(call);
      setIsListening(true);

      // Get transcript
      try {
        const transcriptRes = await api.get(`/vapi/call/${call.id}/transcript`);
        setTranscript(transcriptRes.data.data);
      } catch {
        setTranscript([]);
      }

      toast.success('Now monitoring call');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to listen to call');
    }
  };

  const stopListening = () => {
    setSelectedCall(null);
    setIsListening(false);
    setTranscript([]);
  };

  const handleWhisper = async () => {
    if (!selectedCall || !whisperMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    try {
      await api.post(`/vapi/call/${selectedCall.id}/whisper`, {
        message: whisperMessage,
      });
      toast.success('Whisper sent to AI');
      setWhisperMessage('');
      setShowWhisperModal(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send whisper');
    }
  };

  const handleBarge = async () => {
    if (!selectedCall || !whisperMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    try {
      await api.post(`/vapi/call/${selectedCall.id}/barge`, {
        message: whisperMessage,
      });
      toast.success('Barge message sent');
      setWhisperMessage('');
      setShowWhisperModal(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to barge');
    }
  };

  const handleTransfer = async () => {
    if (!selectedCall || !transferNumber.trim()) {
      toast.error('Please enter a phone number');
      return;
    }

    try {
      await api.post(`/vapi/call/${selectedCall.id}/transfer`, {
        destination: transferNumber,
      });
      toast.success('Call transferred');
      setTransferNumber('');
      setShowTransferModal(false);
      setSelectedCall(null);
      setIsListening(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to transfer call');
    }
  };

  const handleEndCall = async (callId) => {
    try {
      await api.post(`/vapi/call/${callId}/end`);
      toast.success('Call ended');
      if (selectedCall?.id === callId) {
        setSelectedCall(null);
        setIsListening(false);
        setTranscript([]);
      }
    } catch (error) {
      toast.error('Failed to end call');
    }
  };

  const formatDuration = (startTime) => {
    if (!startTime) return '0:00';
    const seconds = Math.floor((Date.now() - new Date(startTime)) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Call Monitor</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Calls List */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Active Calls</h2>
            <span className="badge bg-green-100 text-green-800">
              {activeCalls.length} active
            </span>
          </div>

          {activeCalls.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No active calls</p>
          ) : (
            <div className="space-y-4">
              {activeCalls.map((call) => (
                <div
                  key={call.id}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    selectedCall?.id === call.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <p className="font-medium">
                          {call.agent?.first_name} {call.agent?.last_name}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <p className="text-sm text-gray-600">
                          {call.lead?.first_name} {call.lead?.last_name} - {call.lead?.phone || call.phone}
                        </p>
                      </div>
                      <div className="flex items-center space-x-4 mt-2">
                        <span
                          className={`badge ${
                            call.status === 'in-progress'
                              ? 'bg-green-100 text-green-800'
                              : call.status === 'ringing' || call.status === 'initiated'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {call.status}
                        </span>
                        <span className="text-sm text-gray-500 flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatDuration(call.started_at || call.created_at)}
                        </span>
                      </div>
                      {call.campaign && (
                        <p className="text-xs text-gray-500 mt-1">
                          Campaign: {call.campaign.name}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col space-y-1">
                      <button
                        onClick={() => handleListen(call)}
                        className={`p-2 rounded-lg ${
                          selectedCall?.id === call.id
                            ? 'bg-primary-500 text-white'
                            : 'hover:bg-gray-200 text-blue-600'
                        }`}
                        title="Listen"
                      >
                        <Headphones className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleEndCall(call.id)}
                        className="p-2 hover:bg-red-100 rounded-lg text-red-600"
                        title="End Call"
                      >
                        <PhoneOff className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Monitoring Panel */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">
            {isListening ? 'Monitoring Call' : 'Call Details'}
          </h2>

          {selectedCall ? (
            <div className="space-y-4">
              {/* Call Info */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium">
                  {selectedCall.lead?.first_name} {selectedCall.lead?.last_name}
                </p>
                <p className="text-sm text-gray-500">
                  {selectedCall.lead?.phone || selectedCall.phone}
                </p>
                <p className="text-sm text-gray-500">
                  Agent: {selectedCall.agent?.first_name} {selectedCall.agent?.last_name}
                </p>
              </div>

              {/* Control Buttons */}
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowWhisperModal(true)}
                  className="btn btn-secondary flex-1 flex items-center justify-center"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Whisper/Barge
                </button>
                <button
                  onClick={() => setShowTransferModal(true)}
                  className="btn btn-secondary flex-1 flex items-center justify-center"
                >
                  <PhoneForwarded className="h-4 w-4 mr-2" />
                  Transfer
                </button>
              </div>

              <button
                onClick={stopListening}
                className="btn btn-outline w-full flex items-center justify-center"
              >
                <VolumeX className="h-4 w-4 mr-2" />
                Stop Monitoring
              </button>

              {/* Live Transcript */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Live Transcript
                </h3>
                <div className="h-64 overflow-y-auto space-y-2 p-3 bg-gray-50 rounded-lg">
                  {transcript.length > 0 ? (
                    transcript.map((message, index) => (
                      <div
                        key={index}
                        className={`p-2 rounded text-sm ${
                          message.role === 'assistant'
                            ? 'bg-blue-100 text-blue-900'
                            : message.role === 'user'
                            ? 'bg-gray-200 text-gray-900'
                            : 'bg-yellow-100 text-yellow-900'
                        }`}
                      >
                        <span className="font-medium capitalize">
                          {message.role}:
                        </span>{' '}
                        {message.content}
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">
                      Waiting for conversation...
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Volume2 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">
                Select a call to start monitoring
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Whisper/Barge Modal */}
      {showWhisperModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Send Message</h3>
              <button
                onClick={() => setShowWhisperModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={whisperMessage}
                  onChange={(e) => setWhisperMessage(e.target.value)}
                  className="input h-24"
                  placeholder="Enter your message..."
                />
              </div>
              <div className="bg-blue-50 p-3 rounded-lg text-sm">
                <p className="font-medium text-blue-700">Note:</p>
                <ul className="text-blue-600 mt-1 space-y-1">
                  <li>• <strong>Whisper:</strong> Only AI assistant hears</li>
                  <li>• <strong>Barge:</strong> AI responds as if customer said it</li>
                </ul>
              </div>
            </div>
            <div className="flex space-x-2 p-4 border-t">
              <button
                onClick={handleWhisper}
                className="btn btn-primary flex-1"
                disabled={!whisperMessage.trim()}
              >
                Whisper to AI
              </button>
              <button
                onClick={handleBarge}
                className="btn btn-secondary flex-1"
                disabled={!whisperMessage.trim()}
              >
                Barge In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Transfer Call</h3>
              <button
                onClick={() => setShowTransferModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transfer to Phone Number
                </label>
                <input
                  type="tel"
                  value={transferNumber}
                  onChange={(e) => setTransferNumber(e.target.value)}
                  className="input"
                  placeholder="+63 9XX XXX XXXX"
                />
              </div>
            </div>
            <div className="flex space-x-2 p-4 border-t">
              <button
                onClick={() => setShowTransferModal(false)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                className="btn btn-primary flex-1"
                disabled={!transferNumber.trim()}
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallMonitor;
