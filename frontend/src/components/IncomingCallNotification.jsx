import { PhoneIcon, SmartphoneIcon, VideoIcon, Volume2Icon, XIcon, UserIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const IncomingCallNotification = ({ isOpen, onAccept, onDecline, callerName, callerImage, callType = 'video', ringtoneVolume = 0.6, vibrate = true }) => {
  const [ringingTime, setRingingTime] = useState(0);
  const audioContextRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const playTone = () => {
      try {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) return;

        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextCtor();
        }

        const ctx = audioContextRef.current;
        const now = ctx.currentTime;
        const safeVolume = Math.max(0, Math.min(1, ringtoneVolume));

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.001, safeVolume * 0.3), now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
        gain.connect(ctx.destination);

        const oscillator = ctx.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, now);
        oscillator.frequency.linearRampToValueAtTime(660, now + 0.3);
        oscillator.connect(gain);
        oscillator.start(now);
        oscillator.stop(now + 0.5);

        if (vibrate && navigator.vibrate) {
          navigator.vibrate([180, 120, 180]);
        }
      } catch {
        // Ignore audio API failures caused by browser restrictions.
      }
    };

    playTone();
    const ringLoop = setInterval(playTone, 1800);

    const interval = setInterval(() => {
      setRingingTime(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(ringLoop);
      clearInterval(interval);
      if (navigator.vibrate) navigator.vibrate(0);
      audioContextRef.current?.close?.();
      audioContextRef.current = null;
      setRingingTime(0);
    };
  }, [isOpen, ringtoneVolume, vibrate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-gradient-to-b from-base-100 to-base-200 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-300">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-success/5 animate-pulse" />
        
        {/* Content */}
        <div className="relative p-8 text-center">
          {/* Caller Avatar with pulse animation */}
          <div className="relative mx-auto mb-6">
            <div className="avatar online">
              <div className="w-32 rounded-full ring-4 ring-primary ring-offset-4 ring-offset-base-100 animate-pulse">
                {callerImage ? (
                  <img src={callerImage} alt={callerName} />
                ) : (
                  <div className="bg-primary/20 flex items-center justify-center">
                    <UserIcon className="size-16 text-primary" />
                  </div>
                )}
              </div>
            </div>
            {/* Ripple effect */}
            <div className="absolute inset-0 rounded-full border-4 border-primary animate-ping opacity-20" />
          </div>

          {/* Call Info */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-base-content mb-2">
              {callerName}
            </h2>
            <div className="flex items-center justify-center gap-2 text-base-content/60">
              {callType === 'video' ? (
                <>
                  <VideoIcon className="size-5" />
                  <span>Incoming video call</span>
                </>
              ) : (
                <>
                  <PhoneIcon className="size-5" />
                  <span>Incoming voice call</span>
                </>
              )}
            </div>
            <p className="text-sm text-base-content/40 mt-2">
              {ringingTime}s
            </p>
            <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
              <span className="badge badge-outline gap-1">
                <Volume2Icon className="size-3.5" />
                {Math.round(Math.max(0, Math.min(1, ringtoneVolume)) * 100)}%
              </span>
              <span className="badge badge-outline gap-1">
                <SmartphoneIcon className="size-3.5" />
                {vibrate ? 'Vibrate on' : 'Vibrate off'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-6">
            {/* Decline Button */}
            <button
              onClick={onDecline}
              className="btn btn-circle btn-error btn-lg shadow-lg hover:scale-110 transition-transform"
              title="Decline"
            >
              <XIcon className="size-8" />
            </button>

            {/* Accept Button */}
            <button
              onClick={onAccept}
              className="btn btn-circle btn-success btn-lg shadow-lg hover:scale-110 transition-transform animate-bounce"
              title="Accept"
            >
              {callType === 'video' ? (
                <VideoIcon className="size-8" />
              ) : (
                <PhoneIcon className="size-8" />
              )}
            </button>
          </div>

          {/* Hint text */}
          <p className="text-xs text-base-content/40 mt-6">
            Press decline to send to voicemail
          </p>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallNotification;
