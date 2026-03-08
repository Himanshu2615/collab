import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { StreamVideoClient } from '@stream-io/video-react-sdk';
import { useQuery } from '@tanstack/react-query';
import useAuthUser from '../hooks/useAuthUser';
import { getStreamToken } from '../lib/api';
import { useStreamContext } from '../context/StreamContext';
import IncomingCallNotification from './IncomingCallNotification';
import VideoCallModal from './VideoCallModal';
import { removeActiveCall, saveCallLog, updateCallLog, upsertActiveCall } from '../lib/callHistory';

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

  const buildIncomingCallFromEvent = (event) => {
    if (!event?.call_cid) return null;

    const callId = event.call?.id || event.call_cid.split(':')[1] || event.call_cid;
    const members = Array.isArray(event.members) ? event.members : [];
    const createdBy = event.call?.created_by || event.created_by || null;
    const creator = createdBy?.id ? createdBy : (event.user?.id ? event.user : null);
    const callerUserId = creator?.id || null;
    const callerMember = callerUserId
      ? members.find((member) => member.user_id === callerUserId)
      : null;

    if (callerUserId && callerUserId === authUser._id) return null;

    const conversationId = callerUserId
      ? [authUser._id, callerUserId].sort().join('-')
      : null;

    const participantIds = members.map((m) => m.user_id).filter(Boolean);
    const participantNames = members
      .map((m) => m.user?.name || m.user_id)
      .filter((name) => name && name !== authUser.fullName);
    const participantProfiles = members.map((member) => ({
      id: member.user_id,
      name: member.user?.name || member.user_id,
      image: member.user?.image || member.user?.profilePic || '',
    }));

    return {
      callId,
      callerName: callerMember?.user?.name || creator?.name || createdBy?.name || event.user?.name || 'Someone',
      callerImage: callerMember?.user?.image || callerMember?.user?.profilePic || creator?.image || createdBy?.image || event.user?.image || '',
      type: (event.video ?? event.call?.video ?? true) ? 'video' : 'audio',
      conversationId,
      callerUserId,
      participantIds,
      participantNames,
      participantProfiles,
      startedAt: event.created_at || new Date().toISOString(),
    };
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

    const handleIncomingRingEvent = (event) => {
      const nextIncomingCall = buildIncomingCallFromEvent(event);
      if (!nextIncomingCall) return;

      // Deduplicate identical ringing events
      if (activeIncomingCallIdRef.current === nextIncomingCall.callId) return;
      activeIncomingCallIdRef.current = nextIncomingCall.callId;

      // Respect per-conversation call mute preference
      if (isCallMutedLiveRef.current?.(nextIncomingCall.conversationId)) {
        mutedIncomingCallRef.current = nextIncomingCall;
        upsertActiveCall({
          callId: nextIncomingCall.callId,
          conversationId: nextIncomingCall.conversationId,
          type: nextIncomingCall.type,
          participantIds: nextIncomingCall.participantIds,
          participantNames: nextIncomingCall.participantNames,
          participantProfiles: nextIncomingCall.participantProfiles,
          startedAt: nextIncomingCall.startedAt,
          status: 'ringing',
        });
        return;
      }

      upsertActiveCall({
        callId: nextIncomingCall.callId,
        conversationId: nextIncomingCall.conversationId,
        type: nextIncomingCall.type,
        participantIds: nextIncomingCall.participantIds,
        participantNames: nextIncomingCall.participantNames,
        participantProfiles: nextIncomingCall.participantProfiles,
        startedAt: nextIncomingCall.startedAt,
        status: 'ringing',
      });

      setIncomingCall(nextIncomingCall);

      // Browser notification when tab is hidden
      if (Notification.permission === 'granted' && document.visibilityState === 'hidden') {
        try {
          const n = new Notification(`${nextIncomingCall.callerName} is calling`, {
            body: nextIncomingCall.type === 'video' ? 'Incoming video call' : 'Incoming audio call',
            icon: nextIncomingCall.callerImage || '/favicon.ico',
            tag: `call-${nextIncomingCall.callId}`,
            renotify: true,
          });
          n.onclick = () => {
            window.focus();
            if (nextIncomingCall.callerUserId) navigate(`/chat/${nextIncomingCall.callerUserId}`);
            n.close();
          };
        } catch (_) { /* ignore */ }
      }
    };

    const unsubscribeRing = videoClient.on('call.ring', handleIncomingRingEvent);
    const unsubscribeNotification = videoClient.on('call.notification', handleIncomingRingEvent);

    const logMissedCall = (endedCallId) => {
      const current = incomingCallRef.current;
      const loggedCall =
        current?.callId === endedCallId
          ? current
          : mutedIncomingCallRef.current?.callId === endedCallId
          ? mutedIncomingCallRef.current
          : null;
      if (loggedCall) {
        saveCallLog({
          callId: endedCallId,
          conversationId: loggedCall.conversationId,
          type: loggedCall.type,
          startTime: loggedCall.startedAt || new Date().toISOString(),
          participants: loggedCall.participantNames?.length
            ? loggedCall.participantNames
            : [loggedCall.callerName],
          participantIds: loggedCall.participantIds || [],
          participantProfiles: loggedCall.participantProfiles || [],
          status: 'missed',
        });
        removeActiveCall(endedCallId);
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
      if (id) {
        updateCallLog(id, { endTime: new Date().toISOString(), status: 'ended' });
        removeActiveCall(id);
      }
      if (id && activeIncomingCallIdRef.current === id) {
        logMissedCall(id);
        activeIncomingCallIdRef.current = null;
        mutedIncomingCallRef.current = null;
        setIncomingCall(null);
      }
    });

    return () => {
      unsubscribeRing?.();
      unsubscribeNotification?.();
      unsubscribeReject?.();
      unsubscribeAccept?.();
      unsubscribeEnd?.();
      // Fully disconnect the video client so the next login starts fresh.
      if (videoClientRef.current) {
        videoClientRef.current.disconnectUser?.().catch(() => {});
        videoClientRef.current = null;
      }
    };
  }, [authUser, tokenData, navigate]);

  const handleAccept = () => {
    if (!incomingCall) return;
    const accepted = incomingCall;
    activeIncomingCallIdRef.current = null;
    setIncomingCall(null);

    setCallInfo({
      callId: accepted.callId,
      conversationId: accepted.conversationId,
      participantIds: accepted.participantIds || [],
      participantNames: accepted.participantNames?.length
        ? accepted.participantNames
        : [accepted.callerName],
      participantProfiles: accepted.participantProfiles || [],
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

    saveCallLog({
      callId: declined.callId,
      conversationId: declined.conversationId,
      type: declined.type,
      startTime: declined.startedAt || new Date().toISOString(),
      participants: declined.participantNames?.length
        ? declined.participantNames
        : [declined.callerName],
      participantIds: declined.participantIds || [],
      participantProfiles: declined.participantProfiles || [],
      status: 'missed',
    });
    removeActiveCall(declined.callId);
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
          participantProfiles={callInfo.participantProfiles}
          callType={callInfo.callType}
          conversationId={callInfo.conversationId}
        />
      )}
    </>
  );
};

export default GlobalVideoCallHandler;
