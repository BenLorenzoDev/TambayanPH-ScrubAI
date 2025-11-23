import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import { Phone, PhoneOff, Pause, Play, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

const Dialer = () => {
  const { socket } = useSocket();
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [currentLead, setCurrentLead] = useState(null);
  const [currentCall, setCurrentCall] = useState(null);
  const [isOnCall, setIsOnCall] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    fetchCampaigns();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('call:ended', () => {
        setIsOnCall(false);
        setCurrentCall(null);
      });

      return () => {
        socket.off('call:ended');
      };
    }
  }, [socket]);

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
      const response = await api.post('/calls/initiate', {
        phone: phoneNumber,
        leadId: currentLead?._id,
        campaignId: selectedCampaign,
      });
      setCurrentCall(response.data.data);
      setIsOnCall(true);
      toast.success('Call initiated');
    } catch (error) {
      toast.error('Failed to initiate call');
    }
  };

  const endCall = async () => {
    if (!currentCall) return;

    try {
      await api.post(`/calls/${currentCall._id}/end`);
      setIsOnCall(false);
      setCurrentCall(null);
      toast.success('Call ended');
    } catch (error) {
      toast.error('Failed to end call');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Dialer</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="input"
                  placeholder="+63 9XX XXX XXXX"
                />
                <button
                  onClick={fetchNextLead}
                  className="btn btn-secondary"
                  disabled={!selectedCampaign}
                  title="Get next lead"
                >
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex space-x-2 pt-4">
              {!isOnCall ? (
                <button
                  onClick={initiateCall}
                  className="btn btn-success flex-1 flex items-center justify-center"
                  disabled={!phoneNumber}
                >
                  <Phone className="h-5 w-5 mr-2" />
                  Call
                </button>
              ) : (
                <>
                  <button className="btn btn-secondary flex-1 flex items-center justify-center">
                    <Pause className="h-5 w-5 mr-2" />
                    Hold
                  </button>
                  <button
                    onClick={endCall}
                    className="btn btn-danger flex-1 flex items-center justify-center"
                  >
                    <PhoneOff className="h-5 w-5 mr-2" />
                    End
                  </button>
                </>
              )}
            </div>
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
                  {currentLead.firstName} {currentLead.lastName}
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
      </div>
    </div>
  );
};

export default Dialer;
