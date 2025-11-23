import { useState, useEffect } from 'react';
import { Download, Calendar, TrendingUp, Clock, Users, PhoneCall } from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import api from '../services/api';
import toast from 'react-hot-toast';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const Reports = () => {
  const [dateRange, setDateRange] = useState('month');
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [agentData, setAgentData] = useState([]);
  const [campaignData, setCampaignData] = useState([]);

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  const getDateRange = () => {
    const end = new Date();
    let start = new Date();

    switch (dateRange) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setDate(start.getDate() - 30);
        break;
      default:
        start.setDate(start.getDate() - 30);
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();
      const params = { startDate, endDate };

      const [dashboardRes, agentRes, campaignRes] = await Promise.all([
        api.get('/reports/dashboard', { params }),
        api.get('/reports/agents', { params }),
        api.get('/reports/campaigns'),
      ]);

      setDashboardData(dashboardRes.data.data);
      setAgentData(agentRes.data.data);
      setCampaignData(campaignRes.data.data);
    } catch (error) {
      toast.error('Failed to fetch report data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const exportReport = () => {
    if (!dashboardData) return;

    const csvRows = [
      ['Report Summary'],
      ['Metric', 'Value'],
      ['Total Calls', dashboardData.summary.totalCalls],
      ['Completed Calls', dashboardData.summary.completedCalls],
      ['Total Talk Time (sec)', dashboardData.summary.totalDuration],
      ['Avg Talk Time (sec)', dashboardData.summary.avgTalkTime],
      ['Total Leads', dashboardData.summary.totalLeads],
      ['Converted Leads', dashboardData.summary.convertedLeads],
      ['Conversion Rate', `${dashboardData.summary.conversionRate}%`],
      [],
      ['Agent Performance'],
      ['Name', 'Total Calls', 'Completed', 'Avg Talk Time', 'Answer Rate'],
      ...agentData.map(agent => [
        agent.name,
        agent.totalCalls,
        agent.completedCalls,
        formatDuration(agent.avgTalkTime),
        `${agent.answerRate}%`,
      ]),
    ];

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Report exported successfully');
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex items-center space-x-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="input w-auto"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          <button
            onClick={exportReport}
            className="btn btn-secondary flex items-center"
          >
            <Download className="h-5 w-5 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm text-gray-500 mb-1">Total Calls</h3>
              <p className="text-3xl font-bold">{dashboardData?.summary.totalCalls || 0}</p>
            </div>
            <PhoneCall className="h-8 w-8 text-blue-500" />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {dashboardData?.summary.completedCalls || 0} completed
          </p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm text-gray-500 mb-1">Avg Talk Time</h3>
              <p className="text-3xl font-bold">
                {formatDuration(dashboardData?.summary.avgTalkTime || 0)}
              </p>
            </div>
            <Clock className="h-8 w-8 text-green-500" />
          </div>
          <p className="text-sm text-gray-500 mt-2">minutes per call</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm text-gray-500 mb-1">Total Leads</h3>
              <p className="text-3xl font-bold">{dashboardData?.summary.totalLeads || 0}</p>
            </div>
            <Users className="h-8 w-8 text-purple-500" />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {dashboardData?.summary.convertedLeads || 0} converted
          </p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm text-gray-500 mb-1">Conversion Rate</h3>
              <p className="text-3xl font-bold">{dashboardData?.summary.conversionRate || 0}%</p>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-500" />
          </div>
          <p className="text-sm text-gray-500 mt-2">leads converted</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Call Volume Chart */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Call Volume Over Time</h2>
          {dashboardData?.callsByDate?.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dashboardData.callsByDate}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="calls"
                  stroke="#0088FE"
                  name="Total Calls"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  stroke="#00C49F"
                  name="Completed"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500">No call data available</p>
            </div>
          )}
        </div>

        {/* Disposition Breakdown */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Call Dispositions</h2>
          {dashboardData?.dispositions?.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dashboardData.dispositions}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dashboardData.dispositions.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500">No disposition data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Agent Performance */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">Agent Performance</h2>
        {agentData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={agentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalCalls" fill="#0088FE" name="Total Calls" />
                <Bar dataKey="completedCalls" fill="#00C49F" name="Completed" />
              </BarChart>
            </ResponsiveContainer>

            {/* Agent Table */}
            <div className="overflow-x-auto mt-4">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-3">Agent</th>
                    <th className="pb-3">Total Calls</th>
                    <th className="pb-3">Completed</th>
                    <th className="pb-3">Avg Talk Time</th>
                    <th className="pb-3">Answer Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {agentData.map((agent) => (
                    <tr key={agent.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">{agent.name}</td>
                      <td className="py-3">{agent.totalCalls}</td>
                      <td className="py-3">{agent.completedCalls}</td>
                      <td className="py-3">{formatDuration(agent.avgTalkTime)}</td>
                      <td className="py-3">
                        <span className={`badge ${
                          agent.answerRate >= 70
                            ? 'bg-green-100 text-green-800'
                            : agent.answerRate >= 50
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {agent.answerRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-gray-500 text-center py-8">
            No agent performance data available
          </p>
        )}
      </div>

      {/* Campaign Performance */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Campaign Performance</h2>
        {campaignData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-3">Campaign</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Leads</th>
                  <th className="pb-3">Calls</th>
                  <th className="pb-3">Converted</th>
                  <th className="pb-3">Conversion Rate</th>
                </tr>
              </thead>
              <tbody>
                {campaignData.map((campaign) => (
                  <tr key={campaign.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{campaign.name}</td>
                    <td className="py-3">
                      <span className={`badge ${
                        campaign.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : campaign.status === 'paused'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="py-3">{campaign.totalLeads}</td>
                    <td className="py-3">{campaign.totalCalls}</td>
                    <td className="py-3">{campaign.convertedLeads}</td>
                    <td className="py-3">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-primary-600 h-2 rounded-full"
                            style={{ width: `${campaign.conversionRate}%` }}
                          ></div>
                        </div>
                        <span>{campaign.conversionRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            No campaign data available
          </p>
        )}
      </div>
    </div>
  );
};

export default Reports;
