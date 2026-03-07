import { Link } from "react-router";
import { LANGUAGE_TO_FLAG } from "../constants";
import { MessageSquareIcon, UserIcon } from "lucide-react";
import Avatar from "./Avatar";


const FriendCard = ({ friend }) => {
  return (
    <div className="card bg-base-100 border border-base-300 hover:border-primary/50 transition-all hover:shadow-lg group">
      <div className="card-body p-5">
        <div className="flex items-start justify-between">
          <Avatar
            src={friend.profilePic}
            name={friend.fullName}
            size="w-12 h-12"
            rounded="rounded-xl"
            className="ring ring-primary/10 ring-offset-base-100 ring-offset-2"
          />

          <div className="badge badge-success badge-xs">Online</div>
        </div>

        <div className="mt-4">
          <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{friend.fullName}</h3>
          {(friend.location || friend.nativeLanguage) && (
            <p className="text-xs text-base-content/50 mb-4 capitalize">
              {friend.location || friend.nativeLanguage}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <span className="bg-base-200 text-base-content px-2 py-1 rounded text-[10px] font-semibold flex items-center">
            {getLanguageFlag(friend.nativeLanguage)}
            {friend.nativeLanguage}
          </span>
          <span className="bg-primary/10 text-primary px-2 py-1 rounded text-[10px] font-semibold flex items-center">
            {getLanguageFlag(friend.learningLanguage)}
            {friend.learningLanguage}
          </span>
        </div>

        <div className="flex gap-2">
          <Link to={`/chat/${friend._id}`} className="btn btn-primary btn-sm flex-1 text-white">
            <MessageSquareIcon className="size-3 mr-1" />
            Chat
          </Link>
          <button className="btn btn-ghost btn-sm btn-square border-base-300">
            <UserIcon className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
export default FriendCard;

export function getLanguageFlag(language) {
  if (!language) return null;

  const langLower = language.toLowerCase();
  const countryCode = LANGUAGE_TO_FLAG[langLower];

  if (countryCode) {
    return (
      <img
        src={`https://flagcdn.com/24x18/${countryCode}.png`}
        alt={`${langLower} flag`}
        className="h-3 mr-1 inline-block"
      />
    );
  }
  return null;
}
