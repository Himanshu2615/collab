import { useState, useEffect, useRef } from "react";
import { FileText, Image, FileCode, FileSpreadsheet, FileIcon, Download, Eye, Trash2, MoreVertical } from "lucide-react";
import { formatFileSize } from "../lib/utils";
import Avatar from "./Avatar";

/* ── File type helpers ──────────────────────────── */
const ICON_MAP = {
  image:       { icon: Image,           bg: "bg-emerald-50",   color: "text-emerald-500" },
  document:    { icon: FileText,        bg: "bg-blue-50",      color: "text-blue-500"    },
  spreadsheet: { icon: FileSpreadsheet, bg: "bg-green-50",     color: "text-green-600"   },
  code:        { icon: FileCode,        bg: "bg-indigo-50",    color: "text-indigo-500"  },
};
const DEFAULT_ICON = { icon: FileIcon, bg: "bg-gray-50", color: "text-gray-400" };

const getIconConfig = (type) => ICON_MAP[type] || DEFAULT_ICON;

const relativeTime = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  1) return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  <  7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric" });
};

/* ── Component ──────────────────────────────────── */
const FileCard = ({ file, onSelect, isSelected, viewMode = "grid", onDelete, onDragStart, onDragEnd }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const menuRef = useRef(null);
  const { icon: Icon, bg, color } = getIconConfig(file.type);

  const handleDragStart = (e) => {
    e.dataTransfer.setData("fileId", file._id);
    e.dataTransfer.effectAllowed = "move";
    setIsDragging(true);
    onDragStart?.(file);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    onDragEnd?.(file);
  };

  // Close menu when clicking anywhere outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleDownload = (e) => {
    e.stopPropagation();
    const a = document.createElement("a");
    a.href = file.url;
    a.download = file.name;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.click();
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (window.confirm(`Delete "${file.name}"?`)) onDelete?.(file._id);
  };

  const handleView = (e) => {
    e.stopPropagation();
    window.open(file.url, "_blank", "noreferrer");
  };

  /* ── LIST ROW ─────────────────────────────────── */
  if (viewMode === "list") {
    return (
      <tr
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={() => onSelect(file)}
        className={`group cursor-pointer transition-colors ${
          isDragging ? "opacity-50" : isSelected ? "bg-blue-50" : "hover:bg-gray-50/70"
        }`}
      >
        {/* Type icon */}
        <td className="px-4 py-3 w-10">
          <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
            <Icon className={`size-4 ${color}`} />
          </div>
        </td>

        {/* Name */}
        <td className="px-4 py-3">
          <p className="font-medium text-gray-900 truncate max-w-[240px]">{file.name}</p>
          <p className="text-xs text-gray-400 uppercase mt-0.5">{file.type}</p>
        </td>

        {/* Uploader */}
        <td className="px-4 py-3 hidden md:table-cell">
          {file.sharedBy ? (
            <div className="flex items-center gap-2">
              <Avatar src={file.sharedBy.profilePic} name={file.sharedBy.fullName} size="w-6 h-6" />
              <span className="text-sm text-gray-700 truncate max-w-[120px]">{file.sharedBy.fullName}</span>
            </div>
          ) : (
            <span className="text-sm text-gray-400">—</span>
          )}
        </td>

        {/* Size */}
        <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell whitespace-nowrap">
          {formatFileSize(file.size)}
        </td>

        {/* Date */}
        <td className="px-4 py-3 text-sm text-gray-400 hidden lg:table-cell whitespace-nowrap">
          {relativeTime(file.createdAt)}
        </td>

        {/* Actions */}
        <td className="px-4 py-3 w-20">
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleView}
              title="View file"
              className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
            >
              <Eye className="size-3.5" />
            </button>
            <button
              onClick={handleDownload}
              title="Download"
              className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
            >
              <Download className="size-3.5" />
            </button>
            {onDelete && (
              <button
                onClick={handleDelete}
                title="Delete"
                className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  /* ── GRID CARD ────────────────────────────────── */
  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onSelect(file)}
      className={`group relative bg-white rounded-xl border transition-all cursor-pointer ${
        isDragging
          ? "opacity-50 scale-95"
          : isSelected
          ? "border-blue-400 ring-2 ring-blue-100 shadow-sm"
          : "border-gray-100 hover:border-gray-200 hover:shadow-md"
      }`}
    >
      {/* Preview area — overflow-hidden here clips the image to the rounded top corners */}
      <div
        className="aspect-video w-full rounded-t-xl bg-gray-50 flex items-center justify-center relative overflow-hidden bg-center bg-cover"
        style={file.type === "image" ? { backgroundImage: `url(${file.url})` } : {}}
      >
        {file.type !== "image" && (
          <div className={`p-4 rounded-2xl ${bg}`}>
            <Icon className={`size-7 ${color}`} />
          </div>
        )}

        {/* Hover action overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={handleView}
            title="View"
            className="p-2 bg-white/90 hover:bg-white rounded-lg shadow text-gray-700 transition"
          >
            <Eye className="size-4" />
          </button>
          <button
            onClick={handleDownload}
            title="Download"
            className="p-2 bg-white/90 hover:bg-white rounded-lg shadow text-gray-700 transition"
          >
            <Download className="size-4" />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm text-gray-900 truncate leading-tight">{file.name}</p>
            <p className="text-[11px] text-gray-400 mt-0.5 uppercase font-medium">
              {formatFileSize(file.size)} · {file.type}
            </p>
          </div>
          <div ref={menuRef} className="relative shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
            >
              <MoreVertical className="size-3.5" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-50 py-1 min-w-[130px]"
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={handleView}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  <Eye className="size-3.5" /> View
                </button>
                <button
                  onClick={handleDownload}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  <Download className="size-3.5" /> Download
                </button>
                {onDelete && (
                  <>
                    <div className="my-1 border-t border-gray-100" />
                    <button
                      onClick={handleDelete}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition"
                    >
                      <Trash2 className="size-3.5" /> Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Uploader */}
        {file.sharedBy && (
          <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-gray-50">
            <Avatar src={file.sharedBy.profilePic} name={file.sharedBy.fullName} size="w-4 h-4" />
            <span className="text-[11px] text-gray-400 truncate">{file.sharedBy.fullName}</span>
            <span className="text-[11px] text-gray-300 ml-auto shrink-0">{relativeTime(file.createdAt)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileCard;

