import { useState, useEffect } from 'react';
import { XIcon, PhoneIcon, VideoIcon, ClockIcon, UserIcon, RadioIcon } from 'lucide-react';

const CallLogsPanel = ({ isOpen, onClose, onCallBack }) => {
  const [callLogs, setCallLogs] = useState([]);
  const [filter, setFilter] = useState('all'); // all, video, voice, missed

  useEffect(() => {
    if (isOpen) {
      loadCallLogs();
    }
  }, [isOpen]);

  const loadCallLogs = () => {
    const logs = JSON.parse(localStorage.getItem('callLogs') || '[]');
    setCallLogs(logs);
  };

  const clearCallLogs = () => {
    localStorage.removeItem('callLogs');
    setCallLogs([]);
  };

  const formatDuration = (startTime, endTime) => {
    if (!endTime) return 'Ongoing';
    const duration = Math.floor((new Date(endTime) - new Date(startTime)) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredLogs = callLogs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'video') return log.type === 'video';
    if (filter === 'voice') return log.type === 'voice';
    if (filter === 'missed') return log.status === 'missed';
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-base-100 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-base-300 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-base-content">Call History</h2>
            <p className="text-sm text-base-content/60 mt-1">{callLogs.length} total calls</p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-circle"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-base-300">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('video')}
              className={`btn btn-sm ${filter === 'video' ? 'btn-primary' : 'btn-ghost'}`}
            >
              <VideoIcon className="size-4" />
              Video
            </button>
            <button
              onClick={() => setFilter('voice')}
              className={`btn btn-sm ${filter === 'voice' ? 'btn-primary' : 'btn-ghost'}`}
            >
              <PhoneIcon className="size-4" />
              Voice
            </button>
            <button
              onClick={() => setFilter('missed')}
              className={`btn btn-sm ${filter === 'missed' ? 'btn-error' : 'btn-ghost'}`}
            >
              Missed
            </button>
            <div className="flex-1"></div>
            {callLogs.length > 0 && (
              <button
                onClick={clearCallLogs}
                className="btn btn-sm btn-ghost text-error"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Call Logs List */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <PhoneIcon className="size-16 mx-auto text-base-content/20 mb-4" />
              <p className="text-base-content/60 text-lg">No call history</p>
              <p className="text-base-content/40 text-sm mt-2">
                {filter !== 'all' ? 'Try changing the filter' : 'Start a call to see it here'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log, index) => (
                <div
                  key={index}
                  className="card bg-base-200 hover:bg-base-300 transition-colors"
                >
                  <div className="card-body p-4">
                    <div className="flex items-center gap-4">
                      {/* Call Type Icon */}
                      <div className={`avatar placeholder ${
                        log.status === 'missed' ? 'opacity-50' : ''
                      }`}>
                        <div className={`w-12 rounded-full ${
                          log.type === 'video' ? 'bg-primary/20' : 'bg-success/20'
                        }`}>
                          {log.type === 'video' ? (
                            <VideoIcon className="size-6 text-primary" />
                          ) : (
                            <PhoneIcon className="size-6 text-success" />
                          )}
                        </div>
                      </div>

                      {/* Call Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-base-content">
                            {log.participants.join(', ')}
                          </h3>
                          {log.recorded && (
                            <div className="badge badge-sm badge-error gap-1">
                              <RadioIcon className="size-3" />
                              Recorded
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-base-content/60">
                          <span className="flex items-center gap-1">
                            <ClockIcon className="size-3" />
                            {formatTime(log.startTime)}
                          </span>
                          {log.endTime && (
                            <span className="flex items-center gap-1">
                              Duration: {formatDuration(log.startTime, log.endTime)}
                            </span>
                          )}
                          <span className={`badge badge-sm ${
                            log.status === 'ended' ? 'badge-success' :
                            log.status === 'missed' ? 'badge-error' :
                            'badge-warning'
                          }`}>
                            {log.status}
                          </span>
                        </div>
                      </div>

                      {/* Call Back Button */}
                      <button
                        onClick={() => {
                          onCallBack(log.type);
                          onClose();
                        }}
                        className="btn btn-circle btn-ghost"
                        title="Call back"
                      >
                        {log.type === 'video' ? (
                          <VideoIcon className="size-5" />
                        ) : (
                          <PhoneIcon className="size-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallLogsPanel;
