export const getPresenceMeta = (user) => {
  if (!user) {
    return {
      dotClassName: "bg-base-content/30",
      label: "Offline",
      textClassName: "text-base-content/55",
      isOnline: false,
    };
  }

  if (user.online) {
    return {
      dotClassName: "bg-success animate-pulse",
      label: "Online",
      textClassName: "text-success",
      isOnline: true,
    };
  }

  if (user.last_active) {
    const lastActive = new Date(user.last_active);
    const diffMinutes = Math.max(0, Math.floor((Date.now() - lastActive.getTime()) / 60000));

    if (diffMinutes < 1) {
      return {
        dotClassName: "bg-success",
        label: "Active just now",
        textClassName: "text-success",
        isOnline: true,
      };
    }

    if (diffMinutes < 60) {
      return {
        dotClassName: "bg-base-content/30",
        label: `Active ${diffMinutes}m ago`,
        textClassName: "text-base-content/55",
        isOnline: false,
      };
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return {
        dotClassName: "bg-base-content/30",
        label: `Active ${diffHours}h ago`,
        textClassName: "text-base-content/55",
        isOnline: false,
      };
    }

    const diffDays = Math.floor(diffHours / 24);
    return {
      dotClassName: "bg-base-content/30",
      label: `Active ${diffDays}d ago`,
      textClassName: "text-base-content/55",
      isOnline: false,
    };
  }

  return {
    dotClassName: "bg-base-content/30",
    label: "Offline",
    textClassName: "text-base-content/55",
    isOnline: false,
  };
};

export const mergePresenceUser = (baseUser, presenceUser) => {
  if (!baseUser && !presenceUser) return null;
  return {
    ...(baseUser || {}),
    ...(presenceUser || {}),
    image: presenceUser?.image || baseUser?.image || baseUser?.profilePic || "",
    profilePic: presenceUser?.image || baseUser?.profilePic || baseUser?.image || "",
    name: presenceUser?.name || baseUser?.name || baseUser?.fullName || "",
    fullName: presenceUser?.name || baseUser?.fullName || baseUser?.name || "",
    id: presenceUser?.id || baseUser?.id || baseUser?._id,
    _id: presenceUser?.id || baseUser?._id || baseUser?.id,
  };
};
