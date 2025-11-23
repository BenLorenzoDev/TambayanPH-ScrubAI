import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import { Phone, PhoneOff, Pause, Play, ArrowRight, MessageSquare, FileText, Clock } from 'lucide-react';
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

  useEffect(() => {
    fetchCampaigns();
  }, []);

  useEffect(() => {
    let timer;
    if (isOnCall && callStatus === 'in-progress') {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOnCall, callStatus]);

  useEffect(() => {
    if (socket) {
      socket.on('call:connected', (data) => {
        if (currentCall?.vapiCall?.id === data.vapiCallId) {
          setCallStatus('in-progress');
          toast.success('Call connected');
        }
      });

      socket.on('call:ended', (data) => {
        if (currentCall?.vapiCall?.id === data.vapiCallId) {
          setIsOnCall(false);
          setCallStatus('ended');
          toast.info(`Call ended: ${data.reason || 'completed'}`);
        }
      });

      socket.on('call:transcript', (data) => {
        if (currentCall?.vapiCall?.id === data.vapiCallId) {
          setTranscript(data.transcript);
        }
      });

      return () => {
        socket.off('call:connected');
        socket.off('call:ended');
        socket.off('call:transcript');
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

    try {
      // Use VAPI to make the call
      const response = await api.post('/vapi/call', {
        leadId: currentLead?.id,
        campaignId: selectedCampaign,
      });

      setCurrentCall(response.data.data);
      setIsOnCall(true);
      setCallStatus('initiated');
      setCallDuration(0);
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
      toast.success('Call ended');
    } catch (error) {
      toast.error('Failed to end call');
    }
  };

  const saveDisposition = async () => {
    if (!currentCall || !disposition) {
      toast.error('Please select a disposition');
      return;
    }

    try {
      await api.patch(`/calls/${currentCall.call.id}`, {
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
                  <option key={campaign.id} value={campaign.id}>
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
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="input"
                  placeholder="+63 9XX XXX XXXX"
                  disabled={isOnCall}
                />
                <button
                  onClick={fetchNextLead}
                  className="btn btn-secondary"
                  disabled={!selectedCampaign || isOnCall}
                  title="Get next lead"
                >
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
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
                  disabled={!phoneNumber || !currentLead}
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
