import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCall } from '../../context/CallContext';
import { Phone, PhoneOff, Maximize2, Clock, User } from 'lucide-react';

const FloatingCallWidget = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isOnCall, currentCall, currentLead, callDuration, callStatus } = useCall();

  const [position, setPosition] = useState({ x: window.innerWidth - 320, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const widgetRef = useRef(null);

  // Don't show widget on Dialer page or if not on call
  const isDialerPage = location.pathname === '/dialer';
  const shouldShow = isOnCall && !isDialerPage;

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Keep widget within viewport bounds
      const maxX = window.innerWidth - (widgetRef.current?.offsetWidth || 300);
      const maxY = window.innerHeight - (widgetRef.current?.offsetHeight || 200);

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleMouseDown = (e) => {
    if (e.target.closest('button')) return; // Don't drag when clicking buttons

    const rect = widgetRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleNavigateToDialer = () => {
    navigate('/dialer');
  };

  if (!shouldShow) return null;

  return (
    <div
      ref={widgetRef}
      className="fixed z-50 bg-white rounded-lg shadow-2xl border-2 border-blue-500"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '300px',
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header - Draggable area */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-t-lg flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Phone className="h-4 w-4 animate-pulse" />
          <span className="text-sm font-semibold">Active Call</span>
        </div>
        <button
          onClick={handleNavigateToDialer}
          className="hover:bg-blue-700 p-1 rounded transition-colors"
          title="Open Dialer"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Call Duration */}
        <div className="flex items-center justify-center bg-gray-100 rounded-lg py-2">
          <Clock className="h-4 w-4 text-gray-600 mr-2" />
          <span className="font-mono text-lg font-semibold text-gray-800">
            {formatDuration(callDuration)}
          </span>
        </div>

        {/* Call Status */}
        <div className="text-center">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
            callStatus === 'in-progress'
              ? 'bg-green-100 text-green-800'
              : callStatus === 'ringing'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
            {callStatus === 'in-progress' ? 'In Progress' :
             callStatus === 'ringing' ? 'Ringing' :
             callStatus}
          </span>
        </div>

        {/* Lead Info */}
        {currentLead && (
          <div className="border-t pt-3">
            <div className="flex items-start space-x-2">
              <User className="h-4 w-4 text-gray-500 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {currentLead.firstName || currentLead.first_name} {currentLead.lastName || currentLead.last_name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {currentCall?.call?.phone || currentLead.phone}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="border-t pt-3 flex space-x-2">
          <button
            onClick={handleNavigateToDialer}
            className="flex-1 btn btn-primary text-sm py-2 flex items-center justify-center"
          >
            <Maximize2 className="h-3 w-3 mr-1" />
            Open Dialer
          </button>
        </div>
      </div>

      {/* Dragging indicator */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-10 rounded-lg pointer-events-none" />
      )}
    </div>
  );
};

export default FloatingCallWidget;
