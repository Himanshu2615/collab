import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { StreamVideoClient } from '@stream-io/video-react-sdk';
import { useQuery } from '@tanstack/react-query';
import useAuthUser from '../hooks/useAuthUser';
import { getStreamToken } from '../lib/api';
import { useStreamContext } from '../context/StreamContext';
import IncomingCallNotification from './IncomingCallNotification';
import VideoCallModal from './VideoCallModal';

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

/**
 * Mounts once at the app level (inside StreamProvider) and listens for
 * incoming call events regardless of which page the user is on.
 */
const GlobalVideoCallHandler = () => {
  const { authUser } = useAuthUser();
  const navigate = useNavigate();
  const { isCallMutedLive, getConversationPrefs } = useStreamContext();

  const { data: tokenData } = useQuery({
    queryKey: ['streamToken'],
    queryFn: getStreamToken,
    enabled: !!authUser,
  });

  const [incomingCall, setIncomingCall] = useState(null);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [callInfo, setCallInfo] = useState(null);

  const activeIncomingCallIdRef = useRef(null);
  const mutedIncomingCallRef = useRef(null);
  const incomingCallRef = useRef(null);
  const videoClientRef = useRef(null);
  // Stable ref so the event handler always reads the latest version
  const isCallMutedLiveRef = useRef(isCallMutedLive);
  useEffect(() => { isCallMutedLiveRef.current = isCallMutedLive; }, [isCallMutedLive]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);

  const appendCallLog = (entry) => {
    const logs = JSON.parse(localStorage.getItem('callLogs') || '[]');
    logs.unshift(entry);
    localStorage.setItem('callLogs', JSON.stringify(logs.slice(0, 50)));
  };

  useEffect(() => {
    if (!authUser || !tokenData?.token) return;

    const videoClient = StreamVideoClient.getOrCreateInstance({
      apiKey: STREAM_API_KEY,
      user: {
        id: authUser._id,
        name: authUser.fullName,
        image: authUser.profilePic?.startsWith('data:') ? '' : authUser.profilePic || '',
      },
      token: tokenData.token,
    });
    videoClientRef.current = videoClient;

    const unsubscribeRing = videoClient.on('call.ring', (event) => {
      if (!event?.call_cid || event.user?.id === authUser._id) return;

      const callId = event.call?.id || event.call_cid.split(':')[1] || event.call_cid;
      const callerUserId = event.user?.id || null;

      // Reconstruct the DM channel ID so we can check per-conversation mute
      const conversationId = callerUserId
        ? [authUser._id, callerUserId].sort().join('-')
        : null;

      const nextIncomingCall = {
        callId,
        callerName: event.user?.name || 'Someone',
        callerImage: event.user?.image || '',
        type: event.video ? 'video' : 'audio',
        conversationId,
        callerUserId,
        participantIds: (event.members || []).map((m) => m.user_id).filter(Boolean),
        participantNames: (event.members || [])
          .map((m) => m.user?.name || m.user_id)
          .filter((name) => name && name !== authUser.fullName),
        startedAt: event.created_at || new Date().toISOString(),
      };

      // Deduplicate identical ringing events
      if (activeIncomingCallIdRef.current === callId) return;
      activeIncomingCallIdRef.current = callId;

      // Respect per-conversation call mute preference
      if (isCallMutedLiveRef.current?.(conversationId)) {
        mutedIncomingCallRef.current = nextIncomingCall;
        return;
      }

      setIncomingCall(nextIncomingCall);

      // Browser notification when tab is hidden
      if (Notification.permission === 'granted' && document.visibilityState === 'hidden') {
        try {
          const n = new Notification(`${nextIncomingCall.callerName} is calling`, {
            body: nextIncomingCall.type === 'video' ? 'Incoming video call' : 'Incoming audio call',
            icon: nextIncomingCall.callerImage || '/favicon.ico',
            tag: `call-${callId}`,
            renotify: true,
          });
          n.onclick = () => {
            window.focus();
            if (callerUserId) navigate(`/chat/${callerUserId}`);
            n.close();
          };
        } catch (_) { /* ignore */ }
      }
    });

    const logMissedCall = (endedCallId) => {
      const current = incomingCallRef.current;
      const loggedCall =
        current?.callId === endedCallId
          ? current
          : mutedIncomingCallRef.current?.callId === endedCallId
          ? mutedIncomingCallRef.current
          : null;
      if (loggedCall) {
        appendCallLog({
          callId: endedCallId,
          type: loggedCall.type,
          startTime: loggedCall.startedAt || new Date().toISOString(),
          participants: loggedCall.participantNames?.length
            ? loggedCall.participantNames
            : [loggedCall.callerName],
          participantIds: loggedCall.participantIds || [],
          status: 'missed',
        });
      }
    };

    const unsubscribeReject = videoClient.on('call.rejected', (event) => {
      const id = event.call?.id || event.call_cid?.split(':')[1];
      if (id && activeIncomingCallIdRef.current === id) {
        logMissedCall(id);
        activeIncomingCallIdRef.current = null;
        mutedIncomingCallRef.current = null;
        setIncomingCall(null);
      }
    });

    const unsubscribeAccept = videoClient.on('call.accepted', (event) => {
      const id = event.call?.id || event.call_cid?.split(':')[1];
      if (id && activeIncomingCallIdRef.current === id) {
        activeIncomingCallIdRef.current = null;
        mutedIncomingCallRef.current = null;
      }
    });

    const unsubscribeEnd = videoClient.on('call.ended', (event) => {
      const id = event.call?.id || event.call_cid?.split(':')[1];
      if (id && activeIncomingCallIdRef.current === id) {
        logMissedCall(id);
        activeIncomingCallIdRef.current = null;
        mutedIncomingCallRef.current = null;
        setIncomingCall(null);
      }
    });

    return () => {
      unsubscribeRing?.();
      unsubscribeReject?.();
      unsubscribeAccept?.();
      unsubscribeEnd?.();
      videoClientRef.current = null;
    };
  }, [authUser, tokenData]);

  const handleAccept = () => {
    if (!incomingCall) return;
    const accepted = incomingCall;
    activeIncomingCallIdRef.current = null;
    setIncomingCall(null);

    setCallInfo({
      callId: accepted.callId,
      participantIds: accepted.participantIds || [],
      participantNames: accepted.participantNames?.length
        ? accepted.participantNames
        : [accepted.callerName],
      callType: accepted.type || 'video',
    });
    setShowVideoCall(true);

    // Navigate to the DM chat so the user is in context after the call
    if (accepted.callerUserId) {
      navigate(`/chat/${accepted.callerUserId}`);
    }
  };

  const handleDecline = async () => {
    if (!incomingCall) return;
    const declined = incomingCall;
    activeIncomingCallIdRef.current = null;
    setIncomingCall(null);

    try {
      if (videoClientRef.current && declined.callId) {
        const rejectedCall = videoClientRef.current.call('default', declined.callId);
        await rejectedCall.reject('decline');
      }
    } catch (err) {
      console.error('Error declining call:', err);
    }

    appendCallLog({
      callId: declined.callId,
      type: declined.type,
      startTime: declined.startedAt || new Date().toISOString(),
      participants: declined.participantNames?.length
        ? declined.participantNames
        : [declined.callerName],
      participantIds: declined.participantIds || [],
      status: 'missed',
    });
  };

  const callPrefs = incomingCall
    ? getConversationPrefs(incomingCall.conversationId)
    : { ringtoneVolume: 0.6, vibrate: true };

  if (!authUser || !tokenData?.token) return null;

  return (
    <>
      <IncomingCallNotification
        isOpen={!!incomingCall}
        onAccept={handleAccept}
        onDecline={handleDecline}
        callerName={incomingCall?.callerName || ''}
        callerImage={incomingCall?.callerImage || ''}
        callType={incomingCall?.type || 'video'}
        ringtoneVolume={callPrefs.ringtoneVolume}
        vibrate={callPrefs.vibrate}
      />
      {callInfo && (
        <VideoCallModal
          isOpen={showVideoCall}
          onClose={() => {
            setShowVideoCall(false);
            setCallInfo(null);
          }}
          callId={callInfo.callId}
          token={tokenData.token}
          user={authUser}
          isInitiator={false}
          participantIds={callInfo.participantIds}
          participantNames={callInfo.participantNames}
          callType={callInfo.callType}
        />
      )}
    </>
  );
};

export default GlobalVideoCallHandler;
