import { PhoneIcon, VideoIcon, XIcon, UserIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

const IncomingCallNotification = ({ isOpen, onAccept, onDecline, callerName, callerImage, callType = 'video' }) => {
  const [ringingTime, setRingingTime] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    // Play ring sound (you can add actual audio here)
    const audio = new Audio();
    // audio.src = '/ringtone.mp3';
    // audio.loop = true;
    // audio.play();

    const interval = setInterval(() => {
      setRingingTime(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
      // audio.pause();
      setRingingTime(0);
    };
  }, [isOpen]);

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
