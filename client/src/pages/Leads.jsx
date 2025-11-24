import { useEffect, useState } from 'react';
import api from '../services/api';
import { Upload, Search, Phone, Download, Filter, X } from 'lucide-react';
import toast from 'react-hot-toast';
import ImportModal from '../components/leads/ImportModal';

const Leads = () => {
  const [leads, setLeads] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'new', label: 'New' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'callback', label: 'Callback' },
    { value: 'converted', label: 'Converted' },
    { value: 'not_interested', label: 'Not Interested' },
    { value: 'dnc', label: 'Do Not Call' },
    { value: 'invalid', label: 'Invalid' },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [leadsRes, campaignsRes] = await Promise.all([
        api.get('/leads'),
        api.get('/campaigns'),
      ]);
      setLeads(leadsRes.data.data);
      setCampaigns(campaignsRes.data.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleImportSuccess = () => {
    fetchData();
  };

  const downloadTemplate = () => {
    const headers = ['phone', 'firstName', 'lastName', 'email', 'altPhone', 'street', 'city', 'state', 'zipCode'];
    const csvContent = headers.join(',') + '\n+639171234567,Juan,Dela Cruz,juan@email.com,+639181234567,123 Main St,Manila,Metro Manila,1000';

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setCampaignFilter('');
  };

  const hasActiveFilters = searchTerm || statusFilter || campaignFilter;

  const filteredLeads = leads.filter((lead) => {
    // Search filter
    const matchesSearch =
      !searchTerm ||
      lead.phone?.includes(searchTerm) ||
      lead.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase());

    // Status filter
    const matchesStatus = !statusFilter || lead.status === statusFilter;

    // Campaign filter
    const matchesCampaign = !campaignFilter || lead.campaignId === campaignFilter;

    return matchesSearch && matchesStatus && matchesCampaign;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'converted':
        return 'bg-green-100 text-green-800';
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'callback':
        return 'bg-yellow-100 text-yellow-800';
      case 'contacted':
        return 'bg-purple-100 text-purple-800';
      case 'not_interested':
        return 'bg-orange-100 text-orange-800';
      case 'dnc':
        return 'bg-red-100 text-red-800';
      case 'invalid':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
        <h1 className="text-2xl font-bold">Leads</h1>
        <div className="flex space-x-2">
          <button
            onClick={downloadTemplate}
            className="btn btn-secondary flex items-center"
            title="Download CSV template"
          >
            <Download className="h-5 w-5 mr-2" />
            Template
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="btn btn-primary flex items-center"
          >
            <Upload className="h-5 w-5 mr-2" />
            Import Leads
          </button>
        </div>
      </div>

      <div className="card">
        {/* Search and Filters */}
        <div className="mb-4 space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, phone, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'} flex items-center`}
            >
              <Filter className="h-5 w-5 mr-2" />
              Filters
              {hasActiveFilters && (
                <span className="ml-2 bg-white text-primary-600 rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold">
                  !
                </span>
              )}
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="bg-gray-50 p-4 rounded-lg border">
              <div className="flex justify-between items-center mb-3">
                <span className="font-medium text-sm">Filter Options</span>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear All
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="input"
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Campaign
                  </label>
                  <select
                    value={campaignFilter}
                    onChange={(e) => setCampaignFilter(e.target.value)}
                    className="input"
                  >
                    <option value="">All Campaigns</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign._id} value={campaign._id}>
                        {campaign.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="mb-3 text-sm text-gray-500">
          Showing {filteredLeads.length} of {leads.length} leads
          {hasActiveFilters && ' (filtered)'}
        </div>

        {filteredLeads.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            {hasActiveFilters ? 'No leads match your filters' : 'No leads found'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-3">Name</th>
                  <th className="pb-3">Phone</th>
                  <th className="pb-3">Email</th>
                  <th className="pb-3">Campaign</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Attempts</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr key={lead._id} className="border-b last:border-0">
                    <td className="py-3">
                      {lead.firstName} {lead.lastName}
                    </td>
                    <td className="py-3">{lead.phone}</td>
                    <td className="py-3 text-sm text-gray-500">{lead.email || '-'}</td>
                    <td className="py-3">{lead.campaign?.name || 'N/A'}</td>
                    <td className="py-3">
                      <span className={`badge ${getStatusColor(lead.status)}`}>
                        {lead.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3">{lead.attempts}</td>
                    <td className="py-3">
                      <button
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Call"
                      >
                        <Phone className="h-4 w-4 text-green-600" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        campaigns={campaigns}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
};

export default Leads;
