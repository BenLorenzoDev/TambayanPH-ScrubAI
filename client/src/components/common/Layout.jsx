import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import {
  LayoutDashboard,
  Megaphone,
  Users,
  Phone,
  Monitor,
  BarChart3,
  LogOut,
  Menu,
  X,
  Circle,
} from 'lucide-react';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout, updateStatus } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleStatusChange = (e) => {
    updateStatus(e.target.value);
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Campaigns', href: '/campaigns', icon: Megaphone },
    { name: 'Leads', href: '/leads', icon: Users },
    { name: 'Dialer', href: '/dialer', icon: Phone },
    { name: 'Call Monitor', href: '/monitor', icon: Monitor, roles: ['admin', 'supervisor'] },
    { name: 'Users', href: '/users', icon: Users, roles: ['admin'] },
    { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['admin', 'supervisor'] },
  ];

  const filteredNavigation = navigation.filter(
    (item) => !item.roles || item.roles.includes(user?.role)
  );

  const statusColors = {
    available: 'text-green-500',
    busy: 'text-red-500',
    break: 'text-yellow-500',
    offline: 'text-gray-400',
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white transform transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-800">
          <h1 className="text-xl font-bold">ScrubAI</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="mt-6 px-3">
          {filteredNavigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `flex items-center px-3 py-2 mt-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`
              }
            >
              <item.icon className="h-5 w-5 mr-3" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2 text-gray-300 hover:bg-gray-800 rounded-lg"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={`transition-all duration-200 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        {/* Header */}
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex items-center space-x-4">
            {/* Connection status */}
            <div className="flex items-center">
              <Circle
                className={`h-3 w-3 mr-2 fill-current ${
                  connected ? 'text-green-500' : 'text-red-500'
                }`}
              />
              <span className="text-sm text-gray-500">
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Agent status */}
            <select
              value={user?.status || 'offline'}
              onChange={handleStatusChange}
              className={`text-sm border-0 focus:ring-0 ${statusColors[user?.status]}`}
            >
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="break">Break</option>
              <option value="offline">Offline</option>
            </select>

            {/* User info */}
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-medium">
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </div>
              <span className="ml-2 text-sm font-medium">
                {user?.firstName} {user?.lastName}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
