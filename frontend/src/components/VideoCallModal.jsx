import { useEffect, useMemo, useRef, useState } from 'react';
import { StreamVideoClient, StreamCall, StreamVideo, SpeakerLayout } from '@stream-io/video-react-sdk';
import {
  MessageSquareIcon,
  MicIcon,
  MicOffIcon,
  PenToolIcon,
  PhoneOffIcon,
  RadioIcon,
  SendIcon,
  Trash2Icon,
  VideoIcon,
  VideoOffIcon,
  XIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import '@stream-io/video-react-sdk/dist/css/styles.css';

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;
const CALL_CHAT_EVENT = 'bizzcolab.call.chat';
const WHITEBOARD_STROKE_EVENT = 'bizzcolab.call.whiteboard.stroke';
const WHITEBOARD_CLEAR_EVENT = 'bizzcolab.call.whiteboard.clear';
const WHITEBOARD_COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f97316', '#ef4444', '#111827'];

const createEventId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const pointsToSvgPath = (points = []) => {
  if (!points.length) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x * 100}% ${point.y * 100}%`).join(' ');
};

const getOrgSlug = (user) => {
  if (!user?.organization) return null;
  if (typeof user.organization === 'object') return user.organization.slug || null;
  return null;
};

const VideoCallModal = ({ isOpen, onClose, callId, token, user, isInitiator, participantIds = [], participantNames = [], callType = 'video' }) => {
  const [client, setClient] = useState(null);
  const [call, setCall] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCamEnabled, setIsCamEnabled] = useState(callType === 'video');
  const [isInCallMicEnabled, setIsInCallMicEnabled] = useState(true);
  const [isInCallCamEnabled, setIsInCallCamEnabled] = useState(callType === 'video');
  const [previewStream, setPreviewStream] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [audioDevices, setAudioDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [speakerDevices, setSpeakerDevices] = useState([]);
  const [selectedMicId, setSelectedMicId] = useState('');
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activePanel, setActivePanel] = useState('chat');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [whiteboardStrokes, setWhiteboardStrokes] = useState([]);
  const [draftStroke, setDraftStroke] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState(WHITEBOARD_COLORS[0]);
  const [brushWidth, setBrushWidth] = useState(3);
  const callRef = useRef(null);
  const previewVideoRef = useRef(null);
  const whiteboardRef = useRef(null);
  const messagesEndRef = useRef(null);
  const customUnsubscribeRef = useRef(null);

  useEffect(() => {
    setIsCamEnabled(callType === 'video');
    setIsInCallCamEnabled(callType === 'video');
  }, [callType, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setChatMessages([]);
      setChatInput('');
      setWhiteboardStrokes([]);
      setDraftStroke(null);
      setIsSidebarOpen(true);
      setActivePanel('chat');
      setBrushColor(WHITEBOARD_COLORS[0]);
      setBrushWidth(3);
    }
  }, [isOpen]);

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
      customUnsubscribeRef.current?.();
      customUnsubscribeRef.current = null;
      if (currentCall) {
        updateCallLog(callId, { endTime: new Date().toISOString(), status: 'ended' });
        currentCall.leave().catch(() => {});
      }
      callRef.current = null;
      setCall(null);
      setClient(null);
      setIsRecording(false);
      setIsJoining(false);
      setIsInCallMicEnabled(true);
      setIsInCallCamEnabled(callType === 'video');
      setSpeakerDevices([]);
      setSelectedSpeakerId('');
      setPreviewStream((current) => {
        current?.getTracks().forEach((track) => track.stop());
        return null;
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, callId, token, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendCustomCallEvent = async (payload) => {
    const activeCall = callRef.current || call;
    if (!activeCall) return;
    await activeCall.sendCustomEvent(payload);
  };

  const appendChatMessage = (message) => {
    if (!message?.id) return;
    setChatMessages((prev) => (prev.some((item) => item.id === message.id) ? prev : [...prev, message]));
  };

  const appendWhiteboardStroke = (stroke) => {
    if (!stroke?.id || !stroke?.points?.length) return;
    setWhiteboardStrokes((prev) => (prev.some((item) => item.id === stroke.id) ? prev : [...prev, stroke]));
  };

  const registerCustomEventHandlers = (activeCall) => {
    customUnsubscribeRef.current?.();
    customUnsubscribeRef.current = activeCall.on('custom', (event) => {
      const custom = event.custom;
      if (!custom?.type) return;

      if (custom.type === CALL_CHAT_EVENT) {
        const message = custom.message;
        if (!message || message.userId === user?._id) return;
        appendChatMessage(message);
      }

      if (custom.type === WHITEBOARD_STROKE_EVENT) {
        const stroke = custom.stroke;
        if (!stroke || stroke.userId === user?._id) return;
        appendWhiteboardStroke(stroke);
      }

      if (custom.type === WHITEBOARD_CLEAR_EVENT && custom.userId !== user?._id) {
        setWhiteboardStrokes([]);
        setDraftStroke(null);
      }
    });
  };

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
      const uniqueParticipantIds = Array.from(new Set([user._id, ...participantIds])).filter(Boolean);
      const team = getOrgSlug(user);

      if (isInitiator) {
        // Create the call and ring all members.
        // The `data.members` array includes both the caller and all callees.
        await videoCall.getOrCreate({
          ring: true,
          video: callType === 'video',
          data: {
            members: uniqueParticipantIds.map((id) => ({ user_id: id })),
            ...(team ? { team } : {}),
          },
        });
      } else {
        // Callee: fetch the call state before joining so the SDK knows
        // the call is in `ringing` state and can accept it properly.
        await videoCall.get();
      }

      // join() internally accepts the ring for the callee.
      await videoCall.join({ create: false });

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

      registerCustomEventHandlers(videoCall);
      setCall(videoCall);
      setIsInCallMicEnabled(isMicEnabled);
      setIsInCallCamEnabled(callType === 'video' ? isCamEnabled : false);
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

  const toggleInCallMicrophone = async () => {
    const activeCall = callRef.current || call;
    if (!activeCall) return;

    try {
      if (isInCallMicEnabled) {
        await activeCall.microphone.disable();
        setIsInCallMicEnabled(false);
      } else {
        await activeCall.microphone.enable();
        if (selectedMicId) await activeCall.microphone.select(selectedMicId);
        setIsInCallMicEnabled(true);
      }
    } catch (error) {
      console.error('Microphone toggle error:', error);
      toast.error('Could not update microphone state');
    }
  };

  const toggleInCallCamera = async () => {
    const activeCall = callRef.current || call;
    if (!activeCall || callType !== 'video') return;

    try {
      if (isInCallCamEnabled) {
        await activeCall.camera.disable();
        setIsInCallCamEnabled(false);
      } else {
        await activeCall.camera.enable();
        if (selectedCameraId) await activeCall.camera.select(selectedCameraId);
        setIsInCallCamEnabled(true);
      }
    } catch (error) {
      console.error('Camera toggle error:', error);
      toast.error('Could not update camera state');
    }
  };

  const leaveCurrentCall = async () => {
    const activeCall = callRef.current || call;
    try {
      await activeCall?.leave();
    } catch (_) {
      // noop
    }
    onClose?.();
  };

  const handleSendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text) return;

    const message = {
      id: createEventId(),
      text,
      userId: user._id,
      userName: user.fullName,
      createdAt: new Date().toISOString(),
    };

    appendChatMessage(message);
    setChatInput('');

    try {
      await sendCustomCallEvent({ type: CALL_CHAT_EVENT, message });
    } catch (error) {
      console.error('In-call chat send error:', error);
      toast.error('Failed to send in-call message');
    }
  };

  const getNormalizedPoint = (event) => {
    const surface = whiteboardRef.current;
    if (!surface) return null;
    const rect = surface.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    return {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height),
    };
  };

  const startDrawing = (event) => {
    if (activePanel !== 'whiteboard') return;
    const point = getNormalizedPoint(event);
    if (!point) return;

    setIsDrawing(true);
    setDraftStroke({
      id: createEventId(),
      userId: user._id,
      userName: user.fullName,
      color: brushColor,
      width: brushWidth,
      points: [point],
    });
  };

  const continueDrawing = (event) => {
    if (!isDrawing) return;
    const point = getNormalizedPoint(event);
    if (!point) return;

    setDraftStroke((prev) => {
      if (!prev) return prev;
      const last = prev.points[prev.points.length - 1];
      if (last && Math.abs(last.x - point.x) < 0.0025 && Math.abs(last.y - point.y) < 0.0025) {
        return prev;
      }
      return {
        ...prev,
        points: [...prev.points, point],
      };
    });
  };

  const stopDrawing = async () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (!draftStroke?.points?.length) {
      setDraftStroke(null);
      return;
    }

    appendWhiteboardStroke(draftStroke);

    try {
      await sendCustomCallEvent({ type: WHITEBOARD_STROKE_EVENT, stroke: draftStroke });
    } catch (error) {
      console.error('Whiteboard sync error:', error);
      toast.error('Failed to sync whiteboard stroke');
    }

    setDraftStroke(null);
  };

  const clearWhiteboard = async () => {
    setWhiteboardStrokes([]);
    setDraftStroke(null);
    try {
      await sendCustomCallEvent({ type: WHITEBOARD_CLEAR_EVENT, userId: user._id });
    } catch (error) {
      console.error('Whiteboard clear sync error:', error);
      toast.error('Failed to sync whiteboard clear');
    }
  };

  const renderedStrokes = useMemo(
    () => (draftStroke ? [...whiteboardStrokes, draftStroke] : whiteboardStrokes),
    [draftStroke, whiteboardStrokes]
  );

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
              <div className="h-full flex bg-base-300 rounded-xl overflow-hidden border border-base-200">
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center justify-between border-b border-base-200 bg-base-100 px-5 py-4">
                    <div>
                      <div className="badge badge-outline mb-2">{callType === 'video' ? 'Live video call' : 'Live voice call'}</div>
                      <h3 className="text-lg font-bold text-base-content">
                        {participantNames.length ? participantNames.join(', ') : 'Team call'}
                      </h3>
                      <p className="text-sm text-base-content/55">
                        Use chat and whiteboard tools without leaving the meeting.
                      </p>
                    </div>

                    <button
                      onClick={() => setIsSidebarOpen((prev) => !prev)}
                      className="btn btn-ghost btn-sm gap-2"
                    >
                      {isSidebarOpen ? <XIcon className="size-4" /> : <MessageSquareIcon className="size-4" />}
                      {isSidebarOpen ? 'Hide tools' : 'Show tools'}
                    </button>
                  </div>

                  <div className="relative min-h-0 flex-1 bg-slate-950">
                    <SpeakerLayout />
                  </div>

                  <div className="border-t border-base-200 bg-base-100 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={toggleInCallMicrophone}
                          className={`btn btn-sm gap-2 ${isInCallMicEnabled ? 'btn-primary' : 'btn-outline'}`}
                        >
                          {isInCallMicEnabled ? <MicIcon className="size-4" /> : <MicOffIcon className="size-4" />}
                          {isInCallMicEnabled ? 'Mute' : 'Unmute'}
                        </button>

                        {callType === 'video' && (
                          <button
                            onClick={toggleInCallCamera}
                            className={`btn btn-sm gap-2 ${isInCallCamEnabled ? 'btn-primary' : 'btn-outline'}`}
                          >
                            {isInCallCamEnabled ? <VideoIcon className="size-4" /> : <VideoOffIcon className="size-4" />}
                            {isInCallCamEnabled ? 'Camera on' : 'Camera off'}
                          </button>
                        )}

                        <button
                          onClick={toggleRecording}
                          className={`btn btn-sm gap-2 ${isRecording ? 'btn-error' : 'btn-outline'}`}
                        >
                          <RadioIcon className={`size-4 ${isRecording ? 'animate-pulse' : ''}`} />
                          {isRecording ? 'Stop recording' : 'Record'}
                        </button>

                        <button
                          onClick={() => {
                            setIsSidebarOpen(true);
                            setActivePanel('chat');
                          }}
                          className={`btn btn-sm gap-2 ${isSidebarOpen && activePanel === 'chat' ? 'btn-secondary' : 'btn-outline'}`}
                        >
                          <MessageSquareIcon className="size-4" /> Chat
                        </button>

                        <button
                          onClick={() => {
                            setIsSidebarOpen(true);
                            setActivePanel('whiteboard');
                          }}
                          className={`btn btn-sm gap-2 ${isSidebarOpen && activePanel === 'whiteboard' ? 'btn-secondary' : 'btn-outline'}`}
                        >
                          <PenToolIcon className="size-4" /> Whiteboard
                        </button>
                      </div>

                      <button onClick={leaveCurrentCall} className="btn btn-error btn-sm gap-2">
                        <PhoneOffIcon className="size-4" /> End call
                      </button>
                    </div>
                  </div>
                </div>

                {isSidebarOpen && (
                  <aside className="flex h-full w-full max-w-[380px] flex-col border-l border-base-200 bg-base-100">
                    <div className="flex items-center justify-between border-b border-base-200 px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setActivePanel('chat')}
                          className={`btn btn-sm gap-2 ${activePanel === 'chat' ? 'btn-secondary' : 'btn-ghost'}`}
                        >
                          <MessageSquareIcon className="size-4" /> Chat
                        </button>
                        <button
                          onClick={() => setActivePanel('whiteboard')}
                          className={`btn btn-sm gap-2 ${activePanel === 'whiteboard' ? 'btn-secondary' : 'btn-ghost'}`}
                        >
                          <PenToolIcon className="size-4" /> Whiteboard
                        </button>
                      </div>
                      <button onClick={() => setIsSidebarOpen(false)} className="btn btn-ghost btn-sm btn-circle">
                        <XIcon className="size-4" />
                      </button>
                    </div>

                    {activePanel === 'chat' ? (
                      <div className="flex min-h-0 flex-1 flex-col">
                        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                          {chatMessages.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-base-300 bg-base-200/50 p-6 text-center">
                              <MessageSquareIcon className="mx-auto mb-3 size-8 text-base-content/25" />
                              <p className="font-medium text-base-content/70">No messages yet</p>
                              <p className="mt-1 text-sm text-base-content/50">Share links, notes, or quick decisions during the call.</p>
                            </div>
                          ) : (
                            chatMessages.map((message) => {
                              const isOwn = message.userId === user._id;
                              return (
                                <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${isOwn ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content'}`}>
                                    <p className={`text-[11px] font-semibold uppercase tracking-wide ${isOwn ? 'text-primary-content/70' : 'text-base-content/45'}`}>
                                      {isOwn ? 'You' : message.userName}
                                    </p>
                                    <p className="mt-1 whitespace-pre-wrap break-words text-sm">{message.text}</p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                          <div ref={messagesEndRef} />
                        </div>

                        <div className="border-t border-base-200 p-4">
                          <div className="flex items-end gap-2">
                            <textarea
                              value={chatInput}
                              onChange={(event) => setChatInput(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.shiftKey) {
                                  event.preventDefault();
                                  handleSendChatMessage();
                                }
                              }}
                              className="textarea textarea-bordered min-h-[88px] flex-1 resize-none"
                              placeholder="Type a message for everyone in the call…"
                            />
                            <button onClick={handleSendChatMessage} className="btn btn-primary btn-square">
                              <SendIcon className="size-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-h-0 flex-1 flex-col">
                        <div className="flex flex-wrap items-center gap-2 border-b border-base-200 px-4 py-3">
                          {WHITEBOARD_COLORS.map((color) => (
                            <button
                              key={color}
                              onClick={() => setBrushColor(color)}
                              className={`h-8 w-8 rounded-full border-2 transition ${brushColor === color ? 'border-base-content scale-110' : 'border-base-200'}`}
                              style={{ backgroundColor: color }}
                              title={`Brush ${color}`}
                            />
                          ))}

                          <select
                            value={brushWidth}
                            onChange={(event) => setBrushWidth(Number(event.target.value))}
                            className="select select-bordered select-sm ml-auto w-28"
                          >
                            {[2, 3, 4, 6].map((width) => (
                              <option key={width} value={width}>{width}px</option>
                            ))}
                          </select>

                          <button onClick={clearWhiteboard} className="btn btn-ghost btn-sm gap-2 text-error">
                            <Trash2Icon className="size-4" /> Clear
                          </button>
                        </div>

                        <div className="px-4 py-3 text-sm text-base-content/55">
                          Sketch ideas live. Everyone in the meeting sees new strokes instantly.
                        </div>

                        <div className="min-h-0 flex-1 px-4 pb-4">
                          <div
                            ref={whiteboardRef}
                            className="relative h-full min-h-[320px] rounded-2xl border border-base-300 bg-white shadow-inner touch-none"
                            onPointerDown={startDrawing}
                            onPointerMove={continueDrawing}
                            onPointerUp={stopDrawing}
                            onPointerLeave={stopDrawing}
                          >
                            <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                              {renderedStrokes.map((stroke) => (
                                <path
                                  key={stroke.id}
                                  d={pointsToSvgPath(stroke.points)}
                                  fill="none"
                                  stroke={stroke.color}
                                  strokeWidth={stroke.width}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              ))}
                            </svg>
                            {renderedStrokes.length === 0 && (
                              <div className="absolute inset-0 flex items-center justify-center text-center text-base-content/35">
                                <div>
                                  <PenToolIcon className="mx-auto mb-3 size-8" />
                                  <p className="font-medium">Start drawing on the board</p>
                                  <p className="mt-1 text-sm">Use the color swatches above to annotate ideas together.</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </aside>
                )}
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
                  <div className="rounded-2xl bg-base-200 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-base-content/50">Meeting tools</p>
                    <p className="mt-1 text-sm font-medium text-base-content">Live chat, whiteboard, recording, microphone control, camera control</p>
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
                    {callType === 'video' && videoDevices.length > 0 && (
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
