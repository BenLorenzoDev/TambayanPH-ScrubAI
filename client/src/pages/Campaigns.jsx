import { useEffect, useState } from 'react';
import api from '../services/api';
import { Plus, Edit, Trash2, Play, Pause } from 'lucide-react';
import toast from 'react-hot-toast';

const Campaigns = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await api.get('/campaigns');
      setCampaigns(response.data.data);
    } catch (error) {
      toast.error('Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      await api.patch(`/campaigns/${id}`, { status: newStatus });
      fetchCampaigns();
      toast.success(`Campaign ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update campaign');
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <button className="btn btn-primary flex items-center">
          <Plus className="h-5 w-5 mr-2" />
          New Campaign
        </button>
      </div>

      <div className="card">
        {campaigns.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No campaigns yet. Create your first campaign!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-3">Name</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Dial Mode</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Leads</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign._id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{campaign.name}</td>
                    <td className="py-3 capitalize">{campaign.type}</td>
                    <td className="py-3 capitalize">{campaign.dialMode}</td>
                    <td className="py-3">
                      <span
                        className={`badge ${
                          campaign.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : campaign.status === 'paused'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {campaign.status}
                      </span>
                    </td>
                    <td className="py-3">{campaign.stats?.totalLeads || 0}</td>
                    <td className="py-3">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleStatusToggle(campaign._id, campaign.status)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title={campaign.status === 'active' ? 'Pause' : 'Start'}
                        >
                          {campaign.status === 'active' ? (
                            <Pause className="h-4 w-4 text-yellow-600" />
                          ) : (
                            <Play className="h-4 w-4 text-green-600" />
                          )}
                        </button>
                        <button className="p-1 hover:bg-gray-100 rounded" title="Edit">
                          <Edit className="h-4 w-4 text-blue-600" />
                        </button>
                        <button className="p-1 hover:bg-gray-100 rounded" title="Delete">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
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

export default Campaigns;
