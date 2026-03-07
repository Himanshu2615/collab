import { useEffect, useState } from 'react';
import { StreamVideoClient, StreamCall, StreamVideo, CallControls, SpeakerLayout } from '@stream-io/video-react-sdk';
import { XIcon, RadioIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import '@stream-io/video-react-sdk/dist/css/styles.css';

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

const VideoCallModal = ({ isOpen, onClose, callId, token, user, isInitiator }) => {
  const [client, setClient] = useState(null);
  const [call, setCall] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!isOpen || !token || !user) return;

    const initializeCall = async () => {
      try {
        // Initialize video client
        const videoClient = new StreamVideoClient({
          apiKey: STREAM_API_KEY,
          user: {
            id: user._id,
            name: user.name,
            image: user.image,
          },
          token: token,
        });

        setClient(videoClient);

        // Create or join call
        const videoCall = videoClient.call('default', callId);
        
        if (isInitiator) {
          await videoCall.create({
            ring: true, // Enable ringing for participants
          });
        }
        
        await videoCall.join();
        setCall(videoCall);
        
        // Save call log
        saveCallLog({
          callId,
          type: 'video',
          startTime: new Date().toISOString(),
          participants: [user.name],
          status: 'started',
        });

        toast.success('Connected to call');
      } catch (error) {
        console.error('Error initializing call:', error);
        toast.error('Failed to connect to call');
      }
    };

    initializeCall();

    return () => {
      if (call) {
        // Update call log on end
        updateCallLog(callId, { endTime: new Date().toISOString(), status: 'ended' });
        call.leave();
      }
      if (client) {
        client.disconnectUser();
      }
    };
  }, [isOpen, callId, token, user, isInitiator]);

  const saveCallLog = (log) => {
    const logs = JSON.parse(localStorage.getItem('callLogs') || '[]');
    logs.unshift(log);
    localStorage.setItem('callLogs', JSON.stringify(logs.slice(0, 50))); // Keep last 50 calls
  };

  const updateCallLog = (callId, updates) => {
    const logs = JSON.parse(localStorage.getItem('callLogs') || '[]');
    const index = logs.findIndex(log => log.callId === callId);
    if (index !== -1) {
      logs[index] = { ...logs[index], ...updates };
      localStorage.setItem('callLogs', JSON.stringify(logs));
    }
  };

  const toggleRecording = async () => {
    if (!call) return;

    try {
      if (isRecording) {
        await call.stopRecording();
        setIsRecording(false);
        toast.success('Recording stopped');
        updateCallLog(callId, { recorded: true });
      } else {
        await call.startRecording();
        setIsRecording(true);
        toast.success('Recording started');
      }
    } catch (error) {
      console.error('Recording error:', error);
      toast.error('Recording failed: ' + error.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
      <div className="relative w-full h-full max-w-7xl max-h-[90vh] mx-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 btn btn-circle btn-error"
        >
          <XIcon className="size-5" />
        </button>

        {/* Video call UI */}
        {client && call ? (
          <StreamVideo client={client}>
            <StreamCall call={call}>
              <div className="h-full flex flex-col bg-base-300 rounded-xl overflow-hidden">
                <div className="flex-1 relative">
                  <SpeakerLayout />
                </div>
                <div className="p-4 bg-base-100 flex items-center justify-between">
                  <div className="flex-1">
                    <CallControls onLeave={onClose} />
                  </div>
                  <button
                    onClick={toggleRecording}
                    className={`btn btn-sm gap-2 ${
                      isRecording ? 'btn-error' : 'btn-ghost'
                    }`}
                  >
                    <RadioIcon className={`size-4 ${
                      isRecording ? 'animate-pulse' : ''
                    }`} />
                    {isRecording ? 'Stop Recording' : 'Record'}
                  </button>
                </div>
              </div>
            </StreamCall>
          </StreamVideo>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <span className="loading loading-spinner loading-lg text-primary"></span>
              <p className="mt-4 text-base-content">Connecting to call...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoCallModal;
