import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import { Headphones, MicOff, PhoneForwarded } from 'lucide-react';
import toast from 'react-hot-toast';

const CallMonitor = () => {
  const { socket } = useSocket();
  const [activeCalls, setActiveCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveCalls();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('call:initiated', () => fetchActiveCalls());
      socket.on('call:ended', () => fetchActiveCalls());
      socket.on('call:transferred', () => fetchActiveCalls());

      return () => {
        socket.off('call:initiated');
        socket.off('call:ended');
        socket.off('call:transferred');
      };
    }
  }, [socket]);

  const fetchActiveCalls = async () => {
    try {
      const response = await api.get('/calls/active');
      setActiveCalls(response.data.data);
    } catch (error) {
      toast.error('Failed to fetch active calls');
    } finally {
      setLoading(false);
    }
  };

  const handleListen = (callId) => {
    if (socket) {
      socket.emit('call:listen', { callId });
      toast.success('Now listening to call');
    }
  };

  const handleWhisper = (callId, agentId) => {
    const message = prompt('Enter whisper message:');
    if (message && socket) {
      socket.emit('call:whisper', { callId, agentId, message });
      toast.success('Whisper sent');
    }
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
                key={call._id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium">
                    {call.agent?.firstName} {call.agent?.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{call.phone}</p>
                  <p className="text-sm text-gray-500">
                    {call.campaign?.name || 'No campaign'}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <span
                    className={`badge ${
                      call.status === 'in-progress'
                        ? 'bg-green-100 text-green-800'
                        : call.status === 'ringing'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {call.status}
                  </span>

                  <button
                    onClick={() => handleListen(call._id)}
                    className="p-2 hover:bg-gray-200 rounded-lg"
                    title="Listen"
                  >
                    <Headphones className="h-5 w-5 text-blue-600" />
                  </button>

                  <button
                    onClick={() => handleWhisper(call._id, call.agent?._id)}
                    className="p-2 hover:bg-gray-200 rounded-lg"
                    title="Whisper"
                  >
                    <MicOff className="h-5 w-5 text-purple-600" />
                  </button>

                  <button
                    className="p-2 hover:bg-gray-200 rounded-lg"
                    title="Transfer"
                  >
                    <PhoneForwarded className="h-5 w-5 text-orange-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CallMonitor;
