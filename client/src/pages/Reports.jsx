import { useState } from 'react';
import { BarChart3, Download, Calendar } from 'lucide-react';

const Reports = () => {
  const [dateRange, setDateRange] = useState('today');

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
            <option value="custom">Custom Range</option>
          </select>
          <button className="btn btn-secondary flex items-center">
            <Download className="h-5 w-5 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <h3 className="text-sm text-gray-500 mb-1">Total Calls</h3>
          <p className="text-3xl font-bold">0</p>
          <p className="text-sm text-green-600">+0% from yesterday</p>
        </div>
        <div className="card">
          <h3 className="text-sm text-gray-500 mb-1">Avg Talk Time</h3>
          <p className="text-3xl font-bold">0:00</p>
          <p className="text-sm text-gray-500">minutes</p>
        </div>
        <div className="card">
          <h3 className="text-sm text-gray-500 mb-1">Conversion Rate</h3>
          <p className="text-3xl font-bold">0%</p>
          <p className="text-sm text-gray-500">leads converted</p>
        </div>
      </div>

      {/* Chart Placeholder */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Call Volume</h2>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
          <div className="text-center text-gray-500">
            <BarChart3 className="h-12 w-12 mx-auto mb-2" />
            <p>Chart will be displayed here</p>
            <p className="text-sm">Integrate with Chart.js or Recharts</p>
          </div>
        </div>
      </div>

      {/* Agent Performance */}
      <div className="card mt-6">
        <h2 className="text-lg font-semibold mb-4">Agent Performance</h2>
        <p className="text-gray-500 text-center py-8">
          No data available for the selected period
        </p>
      </div>
    </div>
  );
};

export default Reports;
