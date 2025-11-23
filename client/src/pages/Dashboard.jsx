import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import { Phone, PhoneOff, Clock, TrendingUp } from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [stats, setStats] = useState({
    today: { totalCalls: 0, totalDuration: 0, totalTalkTime: 0, answered: 0 },
    total: { totalCalls: 0, totalDuration: 0, totalTalkTime: 0 },
  });
  const [recentCalls, setRecentCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('call:ended', () => {
        fetchDashboardData();
      });

      return () => {
        socket.off('call:ended');
      };
    }
  }, [socket]);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, callsRes] = await Promise.all([
        api.get(`/users/stats/${user._id}`),
        api.get('/calls', { params: { limit: 5 } }),
      ]);

      setStats(statsRes.data.data);
      setRecentCalls(callsRes.data.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
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
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Today's Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Calls Today</p>
              <p className="text-2xl font-bold">{stats.today.totalCalls}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Phone className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Answered</p>
              <p className="text-2xl font-bold">{stats.today.answered}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <PhoneOff className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Talk Time</p>
              <p className="text-2xl font-bold">
                {formatDuration(stats.today.totalTalkTime)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Calls</p>
              <p className="text-2xl font-bold">{stats.total.totalCalls}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Calls */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Recent Calls</h2>
        {recentCalls.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No calls yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-3">Phone</th>
                  <th className="pb-3">Campaign</th>
                  <th className="pb-3">Duration</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentCalls.map((call) => (
                  <tr key={call._id} className="border-b last:border-0">
                    <td className="py-3">{call.phone}</td>
                    <td className="py-3">{call.campaign?.name || 'N/A'}</td>
                    <td className="py-3">{formatDuration(call.duration || 0)}</td>
                    <td className="py-3">
                      <span
                        className={`badge ${
                          call.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : call.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {call.status}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-gray-500">
                      {new Date(call.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
