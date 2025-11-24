import { useEffect, useState } from 'react';
import api from '../services/api';
import { Plus, Edit, Trash2, Play, Pause, X } from 'lucide-react';
import toast from 'react-hot-toast';

const Campaigns = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [deletingCampaign, setDeletingCampaign] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'outbound',
    dialMode: 'preview',
    status: 'draft',
    script: '',
    dispositions: ['interested', 'not_interested', 'callback', 'no_answer', 'voicemail', 'wrong_number'],
  });
  const [saving, setSaving] = useState(false);

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

  const handleOpenCreateModal = () => {
    setEditingCampaign(null);
    setFormData({
      name: '',
      description: '',
      type: 'outbound',
      dialMode: 'preview',
      status: 'draft',
      script: '',
      dispositions: ['interested', 'not_interested', 'callback', 'no_answer', 'voicemail', 'wrong_number'],
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (campaign) => {
    setEditingCampaign(campaign);
    setFormData({
      name: campaign.name || '',
      description: campaign.description || '',
      type: campaign.type || 'outbound',
      dialMode: campaign.dialMode || 'preview',
      status: campaign.status || 'draft',
      script: campaign.script || '',
      dispositions: campaign.dispositions || ['interested', 'not_interested', 'callback', 'no_answer', 'voicemail', 'wrong_number'],
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCampaign(null);
  };

  const handleOpenDeleteModal = (campaign) => {
    setDeletingCampaign(campaign);
    setShowDeleteModal(true);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletingCampaign(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDispositionsChange = (e) => {
    const value = e.target.value;
    const dispositions = value.split(',').map((d) => d.trim()).filter((d) => d);
    setFormData((prev) => ({ ...prev, dispositions }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingCampaign) {
        await api.patch(`/campaigns/${editingCampaign._id}`, formData);
        toast.success('Campaign updated successfully');
      } else {
        await api.post('/campaigns', formData);
        toast.success('Campaign created successfully');
      }
      handleCloseModal();
      fetchCampaigns();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCampaign) return;

    try {
      await api.delete(`/campaigns/${deletingCampaign._id}`);
      toast.success('Campaign deleted successfully');
      handleCloseDeleteModal();
      fetchCampaigns();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete campaign');
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
        <button onClick={handleOpenCreateModal} className="btn btn-primary flex items-center">
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
                        <button
                          onClick={() => handleOpenEditModal(campaign)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4 text-blue-600" />
                        </button>
                        <button
                          onClick={() => handleOpenDeleteModal(campaign)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Delete"
                        >
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold">
                {editingCampaign ? 'Edit Campaign' : 'Create New Campaign'}
              </h2>
              <button onClick={handleCloseModal} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="input"
                  required
                  placeholder="Enter campaign name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="input"
                  rows={3}
                  placeholder="Enter campaign description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Campaign Type *
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    className="input"
                    required
                  >
                    <option value="outbound">Outbound</option>
                    <option value="inbound">Inbound</option>
                    <option value="blended">Blended</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dial Mode *
                  </label>
                  <select
                    name="dialMode"
                    value={formData.dialMode}
                    onChange={handleInputChange}
                    className="input"
                    required
                  >
                    <option value="preview">Preview</option>
                    <option value="progressive">Progressive</option>
                    <option value="predictive">Predictive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="input"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Call Script
                </label>
                <textarea
                  name="script"
                  value={formData.script}
                  onChange={handleInputChange}
                  className="input"
                  rows={5}
                  placeholder="Enter the call script for agents..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dispositions (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.dispositions.join(', ')}
                  onChange={handleDispositionsChange}
                  className="input"
                  placeholder="interested, not_interested, callback, no_answer"
                />
                <p className="text-xs text-gray-500 mt-1">
                  These are the outcomes agents can select after a call
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingCampaign ? 'Update Campaign' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold mb-4">Delete Campaign</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{deletingCampaign?.name}</strong>? This action
              cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button onClick={handleCloseDeleteModal} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleDelete} className="btn bg-red-600 text-white hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Campaigns;
