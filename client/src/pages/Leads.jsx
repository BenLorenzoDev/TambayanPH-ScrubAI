import { useEffect, useState } from 'react';
import api from '../services/api';
import { Upload, Search, Phone, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import ImportModal from '../components/leads/ImportModal';

const Leads = () => {
  const [leads, setLeads] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

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

  const filteredLeads = leads.filter(
    (lead) =>
      lead.phone?.includes(searchTerm) ||
      lead.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.lastName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        {filteredLeads.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No leads found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-3">Name</th>
                  <th className="pb-3">Phone</th>
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
                    <td className="py-3">{lead.campaign?.name || 'N/A'}</td>
                    <td className="py-3">
                      <span
                        className={`badge ${
                          lead.status === 'converted'
                            ? 'bg-green-100 text-green-800'
                            : lead.status === 'new'
                            ? 'bg-blue-100 text-blue-800'
                            : lead.status === 'callback'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {lead.status}
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
