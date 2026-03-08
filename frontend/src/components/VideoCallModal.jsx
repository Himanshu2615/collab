import { useEffect, useMemo, useRef, useState } from 'react';
import { StreamVideoClient, StreamCall, StreamVideo, SpeakerLayout, useCallStateHooks } from '@stream-io/video-react-sdk';
import {
  DownloadIcon,
  InfoIcon,
  MessageSquareIcon,
  MonitorUpIcon,
  MicIcon,
  MicOffIcon,
  MoreHorizontalIcon,
  PenToolIcon,
  PhoneOffIcon,
  RadioIcon,
  UsersIcon,
  SendIcon,
  Trash2Icon,
  VideoIcon,
  VideoOffIcon,
  XIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import '@stream-io/video-react-sdk/dist/css/styles.css';
import Avatar from './Avatar';

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;
const CALL_CHAT_EVENT = 'bizzcolab.call.chat';
const WHITEBOARD_STROKE_EVENT = 'bizzcolab.call.whiteboard.stroke';
const WHITEBOARD_CLEAR_EVENT = 'bizzcolab.call.whiteboard.clear';
const WHITEBOARD_VISIBILITY_EVENT = 'bizzcolab.call.whiteboard.visibility';
const WHITEBOARD_COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f97316', '#ef4444', '#111827'];
const WHITEBOARD_INITIAL_SIZE = { width: 3200, height: 2200 };
const WHITEBOARD_EXPAND_STEP = 800;
const WHITEBOARD_EDGE_PADDING = 180;

const createEventId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const pointsToSvgPath = (points = []) => {
  if (!points.length) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
};

const getOrgSlug = (user) => {
  if (!user?.organization) return null;
  if (typeof user.organization === 'object') return user.organization.slug || null;
  return null;
};

const InCallScreenShareButton = () => {
  const { useHasOngoingScreenShare, useScreenShareState } = useCallStateHooks();
  const isSomeoneScreenSharing = useHasOngoingScreenShare();
  const { screenShare, optionsAwareIsMute, isTogglePending } = useScreenShareState({
    optimisticUpdates: true,
  });

  const isSharingScreen = !optionsAwareIsMute;
  const isDisabled = isTogglePending || (!isSharingScreen && isSomeoneScreenSharing);
  const label = isSharingScreen ? 'Stop sharing' : isSomeoneScreenSharing ? 'Screen live' : 'Share screen';

  const handleToggle = async () => {
    if (isDisabled) return;

    try {
      await screenShare.toggle();
    } catch (error) {
      console.error('Screen share toggle error:', error);
      toast.error('Could not update screen sharing');
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isDisabled}
      className={`btn btn-sm gap-2 ${isSharingScreen ? 'btn-secondary' : 'btn-outline border-white/20 text-white hover:bg-white/10'} ${isDisabled ? 'btn-disabled' : ''}`}
      title={isSomeoneScreenSharing && !isSharingScreen ? 'Another participant is already sharing' : 'Share your screen'}
    >
      <MonitorUpIcon className="size-4" />
      {label}
    </button>
  );
};

const VideoCallModal = ({
  isOpen,
  onClose,
  callId,
  token,
  user,
  isInitiator,
  participantIds = [],
  participantNames = [],
  participantProfiles = [],
  callType = 'video',
}) => {
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
  const [activeSidebarTab, setActiveSidebarTab] = useState('chat');
  const [activeStageTab, setActiveStageTab] = useState('meeting');
  const [isWhiteboardShared, setIsWhiteboardShared] = useState(false);
  const [showWhiteboardPopup, setShowWhiteboardPopup] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [whiteboardStrokes, setWhiteboardStrokes] = useState([]);
  const [draftStroke, setDraftStroke] = useState(null);
  const [personalWhiteboardStrokes, setPersonalWhiteboardStrokes] = useState([]);
  const [personalDraftStroke, setPersonalDraftStroke] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState(WHITEBOARD_COLORS[0]);
  const [brushWidth, setBrushWidth] = useState(3);
  const [boardSize, setBoardSize] = useState(WHITEBOARD_INITIAL_SIZE);
  const [personalBoardSize, setPersonalBoardSize] = useState(WHITEBOARD_INITIAL_SIZE);
  const callRef = useRef(null);
  const previewVideoRef = useRef(null);
  const whiteboardRef = useRef(null);
  const whiteboardScrollRef = useRef(null);
  const messagesEndRef = useRef(null);
  const customUnsubscribeRef = useRef(null);
  const draftStrokeRef = useRef(null);
  const personalDraftStrokeRef = useRef(null);

  const updateDraftStroke = (updater) => {
    setDraftStroke((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      draftStrokeRef.current = next;
      return next;
    });
  };

  const updatePersonalDraftStroke = (updater) => {
    setPersonalDraftStroke((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      personalDraftStrokeRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    const shouldEnableCamera = callType === 'video';
    setIsCamEnabled(shouldEnableCamera);
    setIsInCallCamEnabled(shouldEnableCamera);
  }, [callType, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setChatMessages([]);
      setChatInput('');
      setWhiteboardStrokes([]);
      setDraftStroke(null);
      setPersonalWhiteboardStrokes([]);
      setPersonalDraftStroke(null);
      draftStrokeRef.current = null;
      personalDraftStrokeRef.current = null;
      setIsSidebarOpen(true);
      setActiveSidebarTab('chat');
      setActiveStageTab('meeting');
      setIsWhiteboardShared(false);
      setShowWhiteboardPopup(false);
      setBrushColor(WHITEBOARD_COLORS[0]);
      setBrushWidth(3);
      setBoardSize(WHITEBOARD_INITIAL_SIZE);
      setPersonalBoardSize(WHITEBOARD_INITIAL_SIZE);
    }
  }, [isOpen]);

  const isPersonalWhiteboardOpen = showWhiteboardPopup && !isWhiteboardShared;
  const activeBoardSize = isPersonalWhiteboardOpen ? personalBoardSize : boardSize;

  useEffect(() => {
    if (!showWhiteboardPopup) return;
    requestAnimationFrame(() => {
      const el = whiteboardScrollRef.current;
      if (!el) return;
      el.scrollLeft = Math.max(0, (activeBoardSize.width - el.clientWidth) / 2);
      el.scrollTop = Math.max(0, (activeBoardSize.height - el.clientHeight) / 2);
    });
  }, [showWhiteboardPopup, activeBoardSize.height, activeBoardSize.width]);

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
    ensureBoardSizeForPoints(stroke.points, 'shared');
    setWhiteboardStrokes((prev) => (prev.some((item) => item.id === stroke.id) ? prev : [...prev, stroke]));
  };

  const appendPersonalWhiteboardStroke = (stroke) => {
    if (!stroke?.id || !stroke?.points?.length) return;
    ensureBoardSizeForPoints(stroke.points, 'personal');
    setPersonalWhiteboardStrokes((prev) => (prev.some((item) => item.id === stroke.id) ? prev : [...prev, stroke]));
  };

  const ensureBoardSizeForPoints = (points = [], scope = 'shared') => {
    if (!points.length) return;

    const maxX = Math.max(...points.map((point) => point.x));
    const maxY = Math.max(...points.map((point) => point.y));

    const updateSize = (prev) => ({
      width: maxX > prev.width - WHITEBOARD_EDGE_PADDING ? prev.width + WHITEBOARD_EXPAND_STEP : prev.width,
      height: maxY > prev.height - WHITEBOARD_EDGE_PADDING ? prev.height + WHITEBOARD_EXPAND_STEP : prev.height,
    });

    if (scope === 'personal') {
      setPersonalBoardSize(updateSize);
      return;
    }

    setBoardSize(updateSize);
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
        draftStrokeRef.current = null;
      }

      if (custom.type === WHITEBOARD_VISIBILITY_EVENT) {
        const shouldShowWhiteboard = Boolean(custom.shared);
        setIsWhiteboardShared(shouldShowWhiteboard);
        if (shouldShowWhiteboard) {
          setActiveStageTab('whiteboard');
        } else {
          setActiveStageTab((current) => (current === 'whiteboard' ? 'meeting' : current));
        }
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

      if (callType !== 'video') {
        await videoCall.camera.disable().catch(() => {});
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
      if (callType !== 'video') {
        await videoCall.camera.disable().catch(() => {});
      } else if (!isCamEnabled) {
        await videoCall.camera.disable();
      }

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

  const getBoardPoint = (event) => {
    const surface = whiteboardRef.current;
    if (!surface) return null;
    const rect = surface.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    return {
      x: clamp(event.clientX - rect.left, 0, rect.width),
      y: clamp(event.clientY - rect.top, 0, rect.height),
    };
  };

  const startDrawing = (event) => {
    const point = getBoardPoint(event);
    if (!point) return;

    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsDrawing(true);
    const nextStroke = {
      id: createEventId(),
      userId: user._id,
      userName: user.fullName,
      color: brushColor,
      width: brushWidth,
      points: [point],
    };

    if (isPersonalWhiteboardOpen) {
      updatePersonalDraftStroke(nextStroke);
      return;
    }

    updateDraftStroke(nextStroke);
  };

  const continueDrawing = (event) => {
    if (!isDrawing) return;
    const point = getBoardPoint(event);
    if (!point) return;

    ensureBoardSizeForPoints([point], isPersonalWhiteboardOpen ? 'personal' : 'shared');

    const updater = (prev) => {
      if (!prev) return prev;
      const last = prev.points[prev.points.length - 1];
      if (last && Math.abs(last.x - point.x) < 0.0025 && Math.abs(last.y - point.y) < 0.0025) {
        return prev;
      }
      return {
        ...prev,
        points: [...prev.points, point],
      };
    };

    if (isPersonalWhiteboardOpen) {
      updatePersonalDraftStroke(updater);
      return;
    }

    updateDraftStroke(updater);
  };

  const stopDrawing = async () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const stroke = isPersonalWhiteboardOpen ? personalDraftStrokeRef.current : draftStrokeRef.current;

    if (!stroke?.points?.length) {
      if (isPersonalWhiteboardOpen) {
        updatePersonalDraftStroke(null);
      } else {
        updateDraftStroke(null);
      }
      return;
    }

    if (isPersonalWhiteboardOpen) {
      appendPersonalWhiteboardStroke(stroke);
      updatePersonalDraftStroke(null);
      return;
    }

    appendWhiteboardStroke(stroke);

    try {
      await sendCustomCallEvent({ type: WHITEBOARD_STROKE_EVENT, stroke });
    } catch (error) {
      console.error('Whiteboard sync error:', error);
      toast.error('Failed to sync whiteboard stroke');
    }

    updateDraftStroke(null);
  };

  const clearWhiteboard = async () => {
    if (isPersonalWhiteboardOpen) {
      setPersonalWhiteboardStrokes([]);
      updatePersonalDraftStroke(null);
      setPersonalBoardSize(WHITEBOARD_INITIAL_SIZE);
      return;
    }

    setWhiteboardStrokes([]);
    updateDraftStroke(null);
    setBoardSize(WHITEBOARD_INITIAL_SIZE);
    try {
      await sendCustomCallEvent({ type: WHITEBOARD_CLEAR_EVENT, userId: user._id });
    } catch (error) {
      console.error('Whiteboard clear sync error:', error);
      toast.error('Failed to sync whiteboard clear');
    }
  };

  const shareWhiteboard = async () => {
    setIsWhiteboardShared(true);
    setActiveStageTab('whiteboard');

    try {
      await sendCustomCallEvent({
        type: WHITEBOARD_VISIBILITY_EVENT,
        shared: true,
        userId: user._id,
      });
      toast.success('Whiteboard shared with the meeting');
    } catch (error) {
      console.error('Whiteboard share sync error:', error);
      toast.error('Failed to share whiteboard');
    }
  };

  const stopWhiteboardShare = async () => {
    setIsWhiteboardShared(false);
    setActiveStageTab((current) => (current === 'whiteboard' ? 'meeting' : current));

    try {
      await sendCustomCallEvent({
        type: WHITEBOARD_VISIBILITY_EVENT,
        shared: false,
        userId: user._id,
      });
      toast.success('Whiteboard hidden from the meeting');
    } catch (error) {
      console.error('Whiteboard hide sync error:', error);
      toast.error('Failed to update whiteboard sharing');
    }
  };

  const renderedStrokes = useMemo(
    () => (draftStroke ? [...whiteboardStrokes, draftStroke] : whiteboardStrokes),
    [draftStroke, whiteboardStrokes]
  );
  const personalRenderedStrokes = useMemo(
    () => (personalDraftStroke ? [...personalWhiteboardStrokes, personalDraftStroke] : personalWhiteboardStrokes),
    [personalDraftStroke, personalWhiteboardStrokes]
  );

  const popupBoardTitle = isWhiteboardShared ? 'Collaborative whiteboard' : 'Personal whiteboard';
  const popupBoardDescription = isWhiteboardShared
    ? 'Draw, scroll, and expand the board as your discussion grows.'
    : 'Sketch privately, capture ideas, and keep notes without sharing them to the meeting.';
  const activeRenderedStrokes = isPersonalWhiteboardOpen ? personalRenderedStrokes : renderedStrokes;

  const workspaceLabel = user?.organization?.name || 'Organization Platform';
  const sessionLabel = participantNames.length ? participantNames.join(', ') : 'Call Session';
  const meetingRoster = useMemo(() => {
    const profileMap = new Map();

    participantProfiles.forEach((profile, index) => {
      const profileId = profile?.id || participantIds[index] || profile?.name;
      if (!profileId) return;
      profileMap.set(profileId, {
        id: profileId,
        name: profile?.name || participantNames[index] || profileId,
        image: profile?.image || '',
      });
    });

    if (user?._id) {
      profileMap.set(user._id, {
        id: user._id,
        name: user.fullName,
        image: user.profilePic || '',
      });
    }

    participantIds.forEach((id, index) => {
      if (!id || profileMap.has(id)) return;
      profileMap.set(id, {
        id,
        name: participantNames[index] || id,
        image: '',
      });
    });

    participantNames.forEach((name, index) => {
      const fallbackId = participantIds[index] || `${name}-${index}`;
      if (!name || profileMap.has(fallbackId)) return;
      profileMap.set(fallbackId, {
        id: fallbackId,
        name,
        image: '',
      });
    });

    return Array.from(profileMap.values()).map((member) => ({
      ...member,
      isYou: member.id === user?._id || member.name === user?.fullName,
    }));
  }, [participantIds, participantNames, participantProfiles, user?._id, user?.fullName, user?.profilePic]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-0 sm:p-4">
      <div className="relative h-full w-full max-w-7xl overflow-hidden sm:max-h-[92vh] sm:rounded-3xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-50 btn btn-circle btn-error btn-sm sm:right-4 sm:top-4"
        >
          <XIcon className="size-5" />
        </button>

        {/* Video call UI */}
        {client && call ? (
          <StreamVideo client={client}>
            <StreamCall call={call}>
              <div className="relative flex h-full flex-col overflow-hidden bg-[#eef2f7] text-base-content sm:rounded-3xl">
                <div className="flex items-center justify-between gap-3 border-b border-base-300 bg-base-100 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 text-sm font-semibold">
                      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                      <span className="truncate">{workspaceLabel}</span>
                      <span className="text-base-content/25">|</span>
                      <span className="truncate text-base-content/55">{sessionLabel}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="btn btn-ghost btn-sm btn-square"><InfoIcon className="size-4" /></button>
                    <button className="btn btn-ghost btn-sm btn-square"><MoreHorizontalIcon className="size-4" /></button>
                  </div>
                </div>

                <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="flex min-h-0 flex-col p-3 sm:p-4">
                    <div className="flex items-center justify-between rounded-t-2xl border border-b-0 border-base-300 bg-base-100 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setActiveStageTab('meeting')}
                          className={`btn btn-sm gap-2 ${activeStageTab === 'meeting' ? 'btn-primary' : 'btn-ghost'}`}
                        >
                          <MonitorUpIcon className="size-4" /> Meeting Stage
                        </button>
                        <button
                          onClick={() => isWhiteboardShared && setActiveStageTab('whiteboard')}
                          disabled={!isWhiteboardShared}
                          className={`btn btn-sm gap-2 ${activeStageTab === 'whiteboard' ? 'btn-primary' : 'btn-ghost'} ${!isWhiteboardShared ? 'btn-disabled' : ''}`}
                        >
                          <PenToolIcon className="size-4" /> {isWhiteboardShared ? 'Shared Whiteboard' : 'Whiteboard on demand'}
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {isWhiteboardShared ? (
                          <button onClick={stopWhiteboardShare} className="btn btn-ghost btn-sm gap-2 text-error">
                            <PenToolIcon className="size-4" /> Stop whiteboard
                          </button>
                        ) : (
                          <button onClick={shareWhiteboard} className="btn btn-primary btn-sm gap-2">
                            <PenToolIcon className="size-4" /> Share whiteboard
                          </button>
                        )}

                        {isWhiteboardShared && activeStageTab === 'whiteboard' && (
                          <>
                            <button onClick={clearWhiteboard} className="btn btn-ghost btn-sm btn-square" title="Clear whiteboard">
                              <Trash2Icon className="size-4" />
                            </button>
                            <button onClick={() => setShowWhiteboardPopup(true)} className="btn btn-ghost btn-sm btn-square" title="Open whiteboard popup">
                              <MonitorUpIcon className="size-4" />
                            </button>
                            <button
                              onClick={() => {
                                const blob = new Blob([JSON.stringify(whiteboardStrokes, null, 2)], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `whiteboard-${callId}.json`;
                                link.click();
                                URL.revokeObjectURL(url);
                              }}
                              className="btn btn-ghost btn-sm btn-square"
                              title="Export whiteboard"
                            >
                              <DownloadIcon className="size-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="relative min-h-0 flex-1 overflow-hidden rounded-b-2xl border border-base-300 bg-white shadow-sm">
                      {activeStageTab === 'whiteboard' ? (
                        showWhiteboardPopup ? (
                          <div className="flex h-full items-center justify-center bg-base-100 px-6 text-center text-base-content/55">
                            <div>
                              <PenToolIcon className="mx-auto mb-3 size-8 text-primary" />
                              <p className="font-semibold">Whiteboard opened in popup</p>
                              <p className="mt-1 text-sm">Use the larger workspace for sketching while keeping chat beside the meeting.</p>
                            </div>
                          </div>
                        ) : (
                          <div ref={whiteboardScrollRef} className="h-full overflow-auto bg-[#fbfcff] p-4">
                            <div
                              ref={whiteboardRef}
                              className="relative rounded-[28px] border border-base-300 bg-white shadow-inner touch-none"
                              style={{ width: `${boardSize.width}px`, height: `${boardSize.height}px` }}
                              onPointerDown={startDrawing}
                              onPointerMove={continueDrawing}
                              onPointerUp={stopDrawing}
                              onPointerLeave={stopDrawing}
                            >
                              <div
                                className="absolute inset-0 opacity-40"
                                style={{
                                  backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.25) 1px, transparent 1px)',
                                  backgroundSize: '22px 22px',
                                }}
                              />
                              <svg className="pointer-events-none absolute inset-0 h-full w-full">
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
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-base-content/35">
                                  <div>
                                    <PenToolIcon className="mx-auto mb-3 size-10" />
                                    <p className="font-medium">Start drawing on the whiteboard</p>
                                    <p className="mt-1 text-sm">This canvas expands as you move toward the edges.</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="relative h-full overflow-hidden bg-slate-950">
                          <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur-md">
                            Normal meeting view{isWhiteboardShared ? ' • Whiteboard ready when needed' : ' • Share a whiteboard or screen when you need it'}
                          </div>
                          <SpeakerLayout />
                        </div>
                      )}

                      {isWhiteboardShared && activeStageTab === 'whiteboard' && callType === 'video' && (
                        <div className="absolute bottom-4 right-4 h-24 w-40 overflow-hidden rounded-2xl border border-white/15 bg-slate-950 shadow-xl">
                          <SpeakerLayout />
                        </div>
                      )}
                    </div>

                    <div className="pointer-events-none absolute inset-x-0 bottom-20 z-20 px-3 sm:bottom-24 sm:px-4">
                      <div className="pointer-events-auto mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/55 p-2 shadow-xl backdrop-blur-md sm:gap-3 sm:px-4">
                        <button
                          onClick={toggleInCallMicrophone}
                          className={`btn btn-sm gap-2 ${isInCallMicEnabled ? 'btn-primary' : 'btn-outline border-white/20 text-white hover:bg-white/10'}`}
                        >
                          {isInCallMicEnabled ? <MicIcon className="size-4" /> : <MicOffIcon className="size-4" />}
                          {isInCallMicEnabled ? 'Mute' : 'Unmute'}
                        </button>

                        {callType === 'video' && (
                          <button
                            onClick={toggleInCallCamera}
                            className={`btn btn-sm gap-2 ${isInCallCamEnabled ? 'btn-primary' : 'btn-outline border-white/20 text-white hover:bg-white/10'}`}
                          >
                            {isInCallCamEnabled ? <VideoIcon className="size-4" /> : <VideoOffIcon className="size-4" />}
                            {isInCallCamEnabled ? 'Camera on' : 'Camera off'}
                          </button>
                        )}

                        <button
                          onClick={toggleRecording}
                          className={`btn btn-sm gap-2 ${isRecording ? 'btn-error' : 'btn-outline border-white/20 text-white hover:bg-white/10'}`}
                        >
                          <RadioIcon className={`size-4 ${isRecording ? 'animate-pulse' : ''}`} />
                          {isRecording ? 'Stop recording' : 'Record'}
                        </button>

                        <button
                          onClick={() => {
                            setIsSidebarOpen(true);
                            setActiveSidebarTab('chat');
                          }}
                          className={`btn btn-sm gap-2 ${isSidebarOpen && activeSidebarTab === 'chat' ? 'btn-secondary' : 'btn-outline border-white/20 text-white hover:bg-white/10'}`}
                        >
                          <MessageSquareIcon className="size-4" /> Chat
                        </button>

                        <button
                          onClick={() => {
                            setIsSidebarOpen(true);
                            setActiveSidebarTab('participants');
                          }}
                          className={`btn btn-sm gap-2 ${isSidebarOpen && activeSidebarTab === 'participants' ? 'btn-secondary' : 'btn-outline border-white/20 text-white hover:bg-white/10'}`}
                        >
                          <UsersIcon className="size-4" /> Participants
                        </button>

                        <InCallScreenShareButton />

                        <button
                          onClick={() => {
                            setShowWhiteboardPopup(true);
                            if (isWhiteboardShared) {
                              setActiveStageTab('whiteboard');
                            }
                          }}
                          className={`btn btn-sm gap-2 ${showWhiteboardPopup ? 'btn-secondary' : 'btn-outline border-white/20 text-white hover:bg-white/10'}`}
                        >
                          <PenToolIcon className="size-4" /> {isWhiteboardShared ? 'Open whiteboard' : 'Personal board'}
                        </button>

                        <button onClick={leaveCurrentCall} className="btn btn-error btn-sm gap-2">
                          <PhoneOffIcon className="size-4" /> End call
                        </button>
                      </div>
                    </div>

                    <div className="mt-auto flex gap-3 overflow-x-auto px-1 pt-4">
                      {meetingRoster.map((member) => (
                        <div key={member.id} className="min-w-[132px] rounded-2xl border border-base-300 bg-base-100 p-2 shadow-sm">
                          <div className="flex items-center gap-2">
                            <Avatar src={member.image} name={member.name} size="w-10 h-10" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{member.isYou ? 'You' : member.name}</p>
                              <p className="text-[11px] text-base-content/50">{member.isYou ? 'Local preview' : 'In meeting'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {isSidebarOpen && (
                    <aside className="flex min-h-0 w-full flex-col border-t border-base-200 bg-base-100 xl:border-l xl:border-t-0">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-200 px-4 py-4">
                        <div className="tabs tabs-boxed bg-base-200/70 p-1">
                          <button
                            onClick={() => setActiveSidebarTab('chat')}
                            className={`tab tab-sm ${activeSidebarTab === 'chat' ? 'tab-active' : ''}`}
                          >
                            In-Meet Chat
                          </button>
                          <button
                            onClick={() => setActiveSidebarTab('participants')}
                            className={`tab tab-sm ${activeSidebarTab === 'participants' ? 'tab-active' : ''}`}
                          >
                            Participants ({meetingRoster.length})
                          </button>
                      </div>
                      <button onClick={() => setIsSidebarOpen(false)} className="btn btn-ghost btn-sm btn-circle self-start">
                        <XIcon className="size-4" />
                      </button>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col">
                        {activeSidebarTab === 'chat' ? (
                          <>
                            <div className="max-h-[28vh] flex-1 space-y-3 overflow-y-auto px-4 py-4 xl:max-h-none">
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
                                          {isOwn ? 'Me' : message.userName}
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
                                  placeholder="Type a message..."
                                />
                                <button onClick={handleSendChatMessage} className="btn btn-primary btn-square">
                                  <SendIcon className="size-4" />
                                </button>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex-1 overflow-y-auto px-4 py-4">
                            <div className="space-y-3">
                              {meetingRoster.map((member, index) => (
                                <div key={`${member.id}-${index}`} className="flex items-center gap-3 rounded-2xl border border-base-300 bg-base-100 px-3 py-3 shadow-sm">
                                  <Avatar src={member.image} name={member.name} size="w-10 h-10" />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold">{member.isYou ? 'You' : member.name}</p>
                                    <p className="text-xs text-base-content/50">{member.isYou ? 'Organizer view' : 'Connected participant'}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  </aside>
                )}
              </div>

              {showWhiteboardPopup && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-2 sm:p-6">
                  <div className="flex h-full max-h-[95vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-base-300 bg-base-100 shadow-2xl">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-200 px-4 py-4 sm:px-5">
                      <div>
                        <div className="badge badge-outline mb-2">{popupBoardTitle}</div>
                        <h3 className="text-lg font-bold text-base-content">Infinite-style workspace</h3>
                        <p className="text-sm text-base-content/55">{popupBoardDescription}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {WHITEBOARD_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setBrushColor(color)}
                            className={`h-9 w-9 rounded-full border-2 transition ${brushColor === color ? 'border-base-content scale-110' : 'border-base-200'}`}
                            style={{ backgroundColor: color }}
                            title={`Brush ${color}`}
                          />
                        ))}

                        <select
                          value={brushWidth}
                          onChange={(event) => setBrushWidth(Number(event.target.value))}
                          className="select select-bordered select-sm w-28"
                        >
                          {[2, 3, 4, 6].map((width) => (
                            <option key={width} value={width}>{width}px</option>
                          ))}
                        </select>

                        <button onClick={clearWhiteboard} className="btn btn-ghost btn-sm gap-2 text-error">
                          <Trash2Icon className="size-4" /> Clear
                        </button>
                        {!isWhiteboardShared && (
                          <button onClick={shareWhiteboard} className="btn btn-primary btn-sm gap-2">
                            <PenToolIcon className="size-4" /> Share to meeting
                          </button>
                        )}
                        <button onClick={() => setShowWhiteboardPopup(false)} className="btn btn-primary btn-sm gap-2">
                          <XIcon className="size-4" /> Close
                        </button>
                      </div>
                    </div>

                    <div className="border-b border-base-200 px-4 py-3 text-sm text-base-content/55 sm:px-5">
                      {isWhiteboardShared
                        ? 'Scroll in any direction and keep drawing. The board expands automatically when you approach an edge.'
                        : 'Your personal board stays private until you decide to share it with the meeting.'}
                    </div>

                    <div ref={whiteboardScrollRef} className="min-h-0 flex-1 overflow-auto bg-base-200/60 p-4 sm:p-6">
                      <div
                        ref={whiteboardRef}
                        className="relative rounded-3xl border border-base-300 bg-white shadow-inner touch-none"
                        style={{ width: `${activeBoardSize.width}px`, height: `${activeBoardSize.height}px` }}
                        onPointerDown={startDrawing}
                        onPointerMove={continueDrawing}
                        onPointerUp={stopDrawing}
                        onPointerLeave={stopDrawing}
                      >
                        <svg className="pointer-events-none absolute inset-0 h-full w-full">
                          {activeRenderedStrokes.map((stroke) => (
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

                        {activeRenderedStrokes.length === 0 && (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-base-content/35">
                            <div>
                              <PenToolIcon className="mx-auto mb-3 size-10" />
                              <p className="font-medium">{isWhiteboardShared ? 'Start drawing on the whiteboard' : 'Start sketching on your private board'}</p>
                              <p className="mt-1 text-sm">Open more space just by drawing toward the edges.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              </div>
            </StreamCall>
          </StreamVideo>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="grid h-full w-full max-w-5xl gap-0 overflow-hidden border border-base-300 bg-base-100 shadow-2xl sm:rounded-3xl lg:h-auto lg:grid-cols-[1.1fr_0.9fr] lg:gap-6">
              <div className="relative flex min-h-[300px] items-center justify-center bg-neutral text-neutral-content sm:min-h-[420px]">
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

              <div className="flex flex-col justify-center p-5 sm:p-8">
                <div className="badge badge-outline mb-4 w-fit">{callType === 'video' ? 'Video Call' : 'Voice Call'}</div>
                <h2 className="text-2xl font-bold text-base-content sm:text-3xl">Ready to join?</h2>
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
                    <p className="mt-1 text-sm font-medium text-base-content">Live chat, whiteboard on demand, screen sharing, recording, microphone control, camera control</p>
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

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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
