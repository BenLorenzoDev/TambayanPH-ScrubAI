import { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ImportModal = ({ isOpen, onClose, campaigns, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [campaignId, setCampaignId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [step, setStep] = useState(1); // 1: upload, 2: mapping, 3: result
  const [fileColumns, setFileColumns] = useState([]);
  const [fieldMapping, setFieldMapping] = useState({});
  const [previewData, setPreviewData] = useState([]);
  const fileInputRef = useRef(null);

  const systemFields = [
    { key: 'phone', label: 'Phone Number', required: true },
    { key: 'firstName', label: 'First Name', required: false },
    { key: 'lastName', label: 'Last Name', required: false },
    { key: 'email', label: 'Email', required: false },
    { key: 'altPhone', label: 'Alt Phone', required: false },
    { key: 'street', label: 'Street', required: false },
    { key: 'city', label: 'City', required: false },
    { key: 'state', label: 'State/Province', required: false },
    { key: 'zipCode', label: 'Zip Code', required: false },
  ];

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      await processFile(selectedFile);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      await processFile(droppedFile);
    }
  };

  const processFile = async (selectedFile) => {
    const ext = selectedFile.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      toast.error('Please select a CSV or Excel file');
      return;
    }

    setFile(selectedFile);
    setResult(null);

    // Read file to get columns for mapping
    try {
      const text = await readFileAsText(selectedFile);
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length === 0) {
        toast.error('File appears to be empty');
        return;
      }

      // Parse headers (first line)
      const headers = parseCSVLine(lines[0]);
      setFileColumns(headers);

      // Parse preview data (first 3 rows)
      const preview = [];
      for (let i = 1; i < Math.min(4, lines.length); i++) {
        const values = parseCSVLine(lines[i]);
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        preview.push(row);
      }
      setPreviewData(preview);

      // Auto-map fields based on column names
      const autoMapping = {};
      headers.forEach(header => {
        const lowerHeader = header.toLowerCase().replace(/[_\s-]/g, '');

        if (lowerHeader.includes('phone') && !lowerHeader.includes('alt')) {
          if (!autoMapping.phone) autoMapping.phone = header;
        } else if (lowerHeader.includes('altphone') || lowerHeader.includes('phone2') || lowerHeader.includes('secondaryphone')) {
          autoMapping.altPhone = header;
        } else if (lowerHeader.includes('firstname') || lowerHeader === 'first') {
          autoMapping.firstName = header;
        } else if (lowerHeader.includes('lastname') || lowerHeader === 'last') {
          autoMapping.lastName = header;
        } else if (lowerHeader.includes('email')) {
          autoMapping.email = header;
        } else if (lowerHeader.includes('street') || lowerHeader.includes('address')) {
          autoMapping.street = header;
        } else if (lowerHeader.includes('city')) {
          autoMapping.city = header;
        } else if (lowerHeader.includes('state') || lowerHeader.includes('province')) {
          autoMapping.state = header;
        } else if (lowerHeader.includes('zip') || lowerHeader.includes('postal')) {
          autoMapping.zipCode = header;
        }
      });

      setFieldMapping(autoMapping);
    } catch (error) {
      toast.error('Failed to read file');
      console.error(error);
    }
  };

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());

    return result;
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    if (!campaignId) {
      toast.error('Please select a campaign');
      return;
    }

    if (!fieldMapping.phone) {
      toast.error('Phone number mapping is required');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('campaignId', campaignId);
      formData.append('fieldMapping', JSON.stringify(fieldMapping));

      const response = await api.post('/leads/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setResult(response.data.data);
      setStep(3);

      if (response.data.data.imported > 0) {
        toast.success(`Successfully imported ${response.data.data.imported} leads`);
        onSuccess?.();
      } else {
        toast.error(`Import failed: 0 of ${response.data.data.total} leads imported`);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setCampaignId('');
    setResult(null);
    setStep(1);
    setFileColumns([]);
    setFieldMapping({});
    setPreviewData([]);
    onClose();
  };

  const goToMapping = () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }
    if (!campaignId) {
      toast.error('Please select a campaign');
      return;
    }
    setStep(2);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            Import Leads {step === 2 && '- Field Mapping'}
          </h2>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {step === 1 && (
            <>
              {/* Campaign Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Campaign
                </label>
                <select
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  className="input"
                >
                  <option value="">Choose a campaign...</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign._id} value={campaign._id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload File
                </label>
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    file ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-primary-500'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {file ? (
                    <div className="flex items-center justify-center space-x-2">
                      <FileSpreadsheet className="h-8 w-8 text-green-500" />
                      <div>
                        <p className="font-medium text-green-700">{file.name}</p>
                        <p className="text-sm text-gray-500">
                          {(file.size / 1024).toFixed(1)} KB • {fileColumns.length} columns detected
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">
                        Drag and drop or click to select
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        CSV or Excel files (max 10MB)
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Preview detected columns */}
              {fileColumns.length > 0 && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-1">Detected columns:</p>
                  <p className="text-xs text-gray-600">
                    {fileColumns.join(', ')}
                  </p>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              {/* Field Mapping */}
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Map your file columns to the system fields. Phone number is required.
                </p>

                {systemFields.map((field) => (
                  <div key={field.key} className="flex items-center gap-3">
                    <label className="w-32 text-sm font-medium text-gray-700">
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                    </label>
                    <select
                      value={fieldMapping[field.key] || ''}
                      onChange={(e) => setFieldMapping(prev => ({
                        ...prev,
                        [field.key]: e.target.value
                      }))}
                      className="input flex-1"
                    >
                      <option value="">-- Not mapped --</option>
                      {fileColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Preview */}
              {previewData.length > 0 && fieldMapping.phone && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Preview (first 3 rows):</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-100">
                          {systemFields.filter(f => fieldMapping[f.key]).map(f => (
                            <th key={f.key} className="p-2 text-left">{f.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, i) => (
                          <tr key={i} className="border-b">
                            {systemFields.filter(f => fieldMapping[f.key]).map(f => (
                              <td key={f.key} className="p-2">
                                {row[fieldMapping[f.key]] || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 3 && result && (
            <div className={`p-4 rounded-lg ${result.imported === 0 ? 'bg-red-50' : result.errors.length > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
              <div className="flex items-center space-x-2 mb-2">
                {result.imported === 0 ? (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                ) : result.errors.length > 0 ? (
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
                <span className="font-medium">
                  Imported {result.imported} of {result.total} leads
                </span>
              </div>
              {result.errors.length > 0 && (
                <div className={`text-sm ${result.imported === 0 ? 'text-red-700' : 'text-yellow-700'}`}>
                  <p className="font-medium">Errors:</p>
                  <ul className="list-disc list-inside">
                    {result.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>Row {err.row}: {err.error}</li>
                    ))}
                    {result.errors.length > 5 && (
                      <li>...and {result.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between p-4 border-t">
          <div>
            {step === 2 && (
              <button onClick={() => setStep(1)} className="btn btn-secondary flex items-center">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </button>
            )}
          </div>
          <div className="flex space-x-2">
            <button onClick={handleClose} className="btn btn-secondary">
              {step === 3 ? 'Close' : 'Cancel'}
            </button>
            {step === 1 && (
              <button
                onClick={goToMapping}
                disabled={!file || !campaignId}
                className="btn btn-primary flex items-center"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            )}
            {step === 2 && (
              <button
                onClick={handleImport}
                disabled={loading || !fieldMapping.phone}
                className="btn btn-primary"
              >
                {loading ? 'Importing...' : 'Import Leads'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
