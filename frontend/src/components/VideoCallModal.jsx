import { useEffect, useRef, useState } from 'react';
import { StreamVideoClient, StreamCall, StreamVideo, CallControls, SpeakerLayout } from '@stream-io/video-react-sdk';
import { MicIcon, MicOffIcon, RadioIcon, VideoIcon, VideoOffIcon, XIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import '@stream-io/video-react-sdk/dist/css/styles.css';

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

const VideoCallModal = ({ isOpen, onClose, callId, token, user, isInitiator, participantIds = [], participantNames = [], callType = 'video' }) => {
  const [client, setClient] = useState(null);
  const [call, setCall] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCamEnabled, setIsCamEnabled] = useState(callType === 'video');
  const [previewStream, setPreviewStream] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [audioDevices, setAudioDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [speakerDevices, setSpeakerDevices] = useState([]);
  const [selectedMicId, setSelectedMicId] = useState('');
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState('');
  const callRef = useRef(null);
  const previewVideoRef = useRef(null);

  useEffect(() => {
    setIsCamEnabled(callType === 'video');
  }, [callType, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const setupPreview = async () => {
      try {
        setPreviewError('');
        if (previewStream) {
          previewStream.getTracks().forEach((track) => track.stop());
        }

        const needsVideo = callType === 'video';
        const media = await navigator.mediaDevices.getUserMedia({
          audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true,
          video: needsVideo
            ? (selectedCameraId ? { deviceId: { exact: selectedCameraId } } : true)
            : false,
        });

        const devices = await navigator.mediaDevices.enumerateDevices();

        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }

        const microphones = devices.filter((device) => device.kind === 'audioinput');
        const cameras = devices.filter((device) => device.kind === 'videoinput');
        const speakers = devices.filter((device) => device.kind === 'audiooutput');
        setAudioDevices(microphones);
        setVideoDevices(cameras);
        setSpeakerDevices(speakers);
        if (!selectedMicId && microphones[0]?.deviceId) {
          setSelectedMicId(microphones[0].deviceId);
        }
        if (!selectedCameraId && cameras[0]?.deviceId) {
          setSelectedCameraId(cameras[0].deviceId);
        }
        if (!selectedSpeakerId && speakers[0]?.deviceId) {
          setSelectedSpeakerId(speakers[0].deviceId);
        }

        media.getAudioTracks().forEach((track) => {
          track.enabled = isMicEnabled;
        });
        media.getVideoTracks().forEach((track) => {
          track.enabled = needsVideo && isCamEnabled;
        });
        setPreviewStream(media);
      } catch (error) {
        console.error('Preview setup error:', error);
        setPreviewError('Camera or microphone access is blocked. You can still join after allowing permissions.');
      }
    };

    setupPreview();

    return () => {
      cancelled = true;
    };
  }, [isOpen, callType, selectedMicId, selectedCameraId, selectedSpeakerId]);

  useEffect(() => {
    if (!previewStream) return;
    previewStream.getAudioTracks().forEach((track) => {
      track.enabled = isMicEnabled;
    });
    previewStream.getVideoTracks().forEach((track) => {
      track.enabled = callType === 'video' && isCamEnabled;
    });
  }, [previewStream, isMicEnabled, isCamEnabled, callType]);

  useEffect(() => {
    if (previewVideoRef.current && previewStream) {
      previewVideoRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  useEffect(() => {
    const activeCall = callRef.current || call;
    if (!activeCall || !selectedSpeakerId || !activeCall.speaker?.select) return;

    activeCall.speaker.select(selectedSpeakerId)?.catch((error) => {
      console.error('Speaker selection error:', error);
    });
  }, [call, selectedSpeakerId]);

  useEffect(() => {
    if (!isOpen || !token || !user) return;

    return () => {
      const currentCall = callRef.current;
      if (currentCall) {
        updateCallLog(callId, { endTime: new Date().toISOString(), status: 'ended' });
        currentCall.leave().catch(() => {});
      }
      callRef.current = null;
      setCall(null);
      setClient(null);
      setIsRecording(false);
      setIsJoining(false);
      setSpeakerDevices([]);
      setSelectedSpeakerId('');
      setPreviewStream((current) => {
        current?.getTracks().forEach((track) => track.stop());
        return null;
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, callId, token, user]);

  const joinCall = async () => {
    if (isJoining || call) return;
    if (!token || !user) {
      toast.error('Call credentials are missing.');
      return;
    }

    const initialize = async () => {
      const videoClient = StreamVideoClient.getOrCreateInstance({
        apiKey: STREAM_API_KEY,
        user: {
          id: user._id,
          name: user.fullName,
          image: user.profilePic?.startsWith('data:') ? '' : user.profilePic || '',
        },
        token,
      });

      setClient(videoClient);
      const videoCall = videoClient.call('default', callId);
      callRef.current = videoCall;

      if (isInitiator) {
        await videoCall.getOrCreate({
          ring: true,
          video: callType === 'video',
          data: {
            members: Array.from(new Set(participantIds))
              .filter(Boolean)
              .map((id) => ({ user_id: id })),
            video: callType === 'video',
          },
        });
      }

      await videoCall.join();

      if (selectedMicId) {
        await videoCall.microphone.select(selectedMicId);
      }
      if (callType === 'video' && selectedCameraId) {
        await videoCall.camera.select(selectedCameraId);
      }
      if (selectedSpeakerId && videoCall.speaker?.select) {
        await videoCall.speaker.select(selectedSpeakerId);
      }

      if (!isMicEnabled) await videoCall.microphone.disable();
      if (callType === 'video' && !isCamEnabled) await videoCall.camera.disable();

      setCall(videoCall);
      setPreviewStream((current) => {
        current?.getTracks().forEach((track) => track.stop());
        return null;
      });

      saveCallLog({
        callId,
        type: callType,
        startTime: new Date().toISOString(),
        participants: Array.from(new Set(participantNames)).filter(Boolean),
        participantIds: Array.from(new Set(participantIds)).filter((id) => id && id !== user._id),
        status: 'started',
      });

      toast.success('Connected to call');
    };

    try {
      setIsJoining(true);
      await initialize();
    } catch (error) {
      console.error('Error initializing call:', error);
      toast.error('Failed to connect to call');
      onClose?.();
    } finally {
      setIsJoining(false);
    }
  };

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
    const activeCall = callRef.current || call;
    if (!activeCall) return;

    try {
      if (isRecording) {
        await activeCall.stopRecording();
        setIsRecording(false);
        toast.success('Recording stopped');
        updateCallLog(callId, { recorded: true });
      } else {
        await activeCall.startRecording();
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
            <div className="w-full max-w-5xl grid lg:grid-cols-[1.1fr_0.9fr] gap-6 bg-base-100 rounded-3xl overflow-hidden shadow-2xl border border-base-300">
              <div className="relative min-h-[420px] bg-neutral text-neutral-content flex items-center justify-center">
                {callType === 'video' && previewStream ? (
                  <video
                    ref={previewVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="text-center px-8">
                    {callType === 'video' ? <VideoOffIcon className="size-16 mx-auto mb-4 opacity-60" /> : <MicIcon className="size-16 mx-auto mb-4 opacity-60" />}
                    <p className="text-lg font-semibold">{callType === 'video' ? 'Camera preview is off' : 'Voice call ready'}</p>
                    <p className="text-sm opacity-70 mt-2">{previewError || 'Choose how you want to join before entering the call.'}</p>
                  </div>
                )}
                <div className="absolute left-4 bottom-4 flex gap-2">
                  <button
                    onClick={() => setIsMicEnabled((v) => !v)}
                    className={`btn btn-circle ${isMicEnabled ? 'btn-primary' : 'btn-ghost bg-black/30 text-white border-white/20'}`}
                    title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
                  >
                    {isMicEnabled ? <MicIcon className="size-5" /> : <MicOffIcon className="size-5" />}
                  </button>
                  {callType === 'video' && (
                    <button
                      onClick={() => setIsCamEnabled((v) => !v)}
                      className={`btn btn-circle ${isCamEnabled ? 'btn-primary' : 'btn-ghost bg-black/30 text-white border-white/20'}`}
                      title={isCamEnabled ? 'Turn camera off' : 'Turn camera on'}
                    >
                      {isCamEnabled ? <VideoIcon className="size-5" /> : <VideoOffIcon className="size-5" />}
                    </button>
                  )}
                </div>
              </div>

              <div className="p-8 flex flex-col justify-center">
                <div className="badge badge-outline mb-4 w-fit">{callType === 'video' ? 'Video Call' : 'Voice Call'}</div>
                <h2 className="text-3xl font-bold text-base-content">Ready to join?</h2>
                <p className="mt-3 text-base-content/60">
                  You are about to join with {isMicEnabled ? 'microphone on' : 'microphone off'}{callType === 'video' ? ` and ${isCamEnabled ? 'camera on' : 'camera off'}` : ''}.
                </p>

                <div className="mt-6 space-y-3">
                  <div className="rounded-2xl bg-base-200 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-base-content/50">Participants</p>
                    <p className="mt-1 font-medium text-base-content">{participantNames.length ? participantNames.join(', ') : 'Team call'}</p>
                  </div>
                  <div className="rounded-2xl bg-base-200 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-base-content/50">Status</p>
                    <p className="mt-1 font-medium text-base-content">{isInitiator ? 'Starting a ringing call' : 'Joining an incoming call'}</p>
                  </div>
                  <div className="rounded-2xl bg-base-200 px-4 py-3 space-y-3">
                    <p className="text-xs uppercase tracking-wide text-base-content/50">Devices</p>
                    <label className="form-control w-full">
                      <span className="label-text text-xs text-base-content/60 mb-1">Microphone</span>
                      <select
                        className="select select-bordered w-full"
                        value={selectedMicId}
                        onChange={(e) => setSelectedMicId(e.target.value)}
                      >
                        {audioDevices.map((device, index) => (
                          <option key={device.deviceId || index} value={device.deviceId}>
                            {device.label || `Microphone ${index + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                    {callType === 'video' && (
                      <label className="form-control w-full">
                        <span className="label-text text-xs text-base-content/60 mb-1">Camera</span>
                        <select
                          className="select select-bordered w-full"
                          value={selectedCameraId}
                          onChange={(e) => setSelectedCameraId(e.target.value)}
                        >
                          {videoDevices.map((device, index) => (
                            <option key={device.deviceId || index} value={device.deviceId}>
                              {device.label || `Camera ${index + 1}`}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {speakerDevices.length > 0 && (
                      <label className="form-control w-full">
                        <span className="label-text text-xs text-base-content/60 mb-1">Speaker / Output</span>
                        <select
                          className="select select-bordered w-full"
                          value={selectedSpeakerId}
                          onChange={(e) => setSelectedSpeakerId(e.target.value)}
                        >
                          {speakerDevices.map((device, index) => (
                            <option key={device.deviceId || index} value={device.deviceId}>
                              {device.label || `Speaker ${index + 1}`}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
                  <button onClick={joinCall} className={`btn btn-primary flex-1 ${isJoining ? 'btn-disabled' : ''}`}>
                    {isJoining ? 'Joining…' : 'Join now'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoCallModal;
