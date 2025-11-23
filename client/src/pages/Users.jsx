import { useEffect, useState } from 'react';
import api from '../services/api';
import { UserPlus, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data.data);
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
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
        <h1 className="text-2xl font-bold">Users</h1>
        <button className="btn btn-primary flex items-center">
          <UserPlus className="h-5 w-5 mr-2" />
          Add User
        </button>
      </div>

      <div className="card">
        {users.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No users found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-3">Name</th>
                  <th className="pb-3">Email</th>
                  <th className="pb-3">Role</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Team</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id} className="border-b last:border-0">
                    <td className="py-3 font-medium">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="py-3">{user.email}</td>
                    <td className="py-3 capitalize">{user.role}</td>
                    <td className="py-3">
                      <span className={`badge badge-${user.status}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="py-3">{user.team || '-'}</td>
                    <td className="py-3">
                      <div className="flex items-center space-x-2">
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

export default Users;
