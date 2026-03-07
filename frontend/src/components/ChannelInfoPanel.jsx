import { useState } from "react";
import { XIcon, HashIcon, BellIcon, BellOffIcon, PinIcon, SearchIcon } from "lucide-react";

const ChannelInfoPanel = ({ channel, isChannel, isOpen, onClose }) => {
  const [notifications, setNotifications] = useState(true);

  if (!isOpen) return null;

  const otherMember = !isChannel && channel?.state?.members 
    ? Object.values(channel.state.members).find(m => m.user_id !== channel._client?.userID)
    : null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div 
        className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-base-300 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isChannel ? (
              <>
                <div className="bg-primary/10 p-2 rounded-lg">
                  <HashIcon className="size-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{channel?.data?.name}</h3>
                  <p className="text-xs text-base-content/50">Channel Details</p>
                </div>
              </>
            ) : (
              <>
                <div className="avatar">
                  <div className="w-12 rounded-full ring ring-primary/10 ring-offset-base-100 ring-offset-2">
                    <img src={otherMember?.user?.image} alt={otherMember?.user?.name} />
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-lg">{otherMember?.user?.name}</h3>
                  <p className="text-xs text-success flex items-center gap-1">
                    <span className="size-2 rounded-full bg-success inline-block" />
                    Active
                  </p>
                </div>
              </>
            )}
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            <XIcon className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(80vh-100px)] p-6 space-y-6">
          {/* About Section */}
          <div>
            <h4 className="font-bold mb-3 text-sm uppercase tracking-wide text-base-content/50">About</h4>
            <p className="text-sm text-base-content/70">
              {isChannel 
                ? `This is the ${channel?.data?.name} channel for team collaboration and discussions.`
                : `Direct message conversation with ${otherMember?.user?.name}.`
              }
            </p>
          </div>

          {/* Actions */}
          <div>
            <h4 className="font-bold mb-3 text-sm uppercase tracking-wide text-base-content/50">Actions</h4>
            <div className="space-y-2">
              <button 
                className="btn btn-ghost justify-start w-full"
                onClick={() => setNotifications(!notifications)}
              >
                {notifications ? (
                  <><BellOffIcon className="size-4" /> Mute Notifications</>
                ) : (
                  <><BellIcon className="size-4" /> Unmute Notifications</>
                )}
              </button>
              <button className="btn btn-ghost justify-start w-full">
                <PinIcon className="size-4" />
                View Pinned Messages
              </button>
              <button className="btn btn-ghost justify-start w-full">
                <SearchIcon className="size-4" />
                Search in Conversation
              </button>
            </div>
          </div>

          {/* Stats */}
          {isChannel && (
            <div>
              <h4 className="font-bold mb-3 text-sm uppercase tracking-wide text-base-content/50">Statistics</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-base-200 p-4 rounded-xl text-center">
                  <div className="text-2xl font-bold text-primary">
                    {channel?.state?.members ? Object.keys(channel.state.members).length : 0}
                  </div>
                  <div className="text-xs text-base-content/60 mt-1">Members</div>
                </div>
                <div className="bg-base-200 p-4 rounded-xl text-center">
                  <div className="text-2xl font-bold text-secondary">
                    {channel?.state?.messages?.length || 0}
                  </div>
                  <div className="text-xs text-base-content/60 mt-1">Messages</div>
                </div>
              </div>
            </div>
          )}

          {/* Created Info */}
          <div className="pt-4 border-t border-base-300">
            <p className="text-xs text-base-content/50">
              Created {channel?.data?.created_at ? new Date(channel.data.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'recently'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChannelInfoPanel;
