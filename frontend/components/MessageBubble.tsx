"use client";

import React, { useState } from "react";

const EMAILS_PER_PAGE = 10;

type Email = {
  id: string;
  subject: string;
  from: string;
  snippet?: string;
  summary?: string;
  email_number?: number;
  date?: string;
};

type EmailContent = {
  from: string;
  to: string;
  date: string;
  subject: string;
  body: string;
};

type Category = { id: string; label: string };

type MessageBubbleProps = {
  role: "user" | "assistant";
  text: string;
  emails?: Email[];
  emailContent?: EmailContent | null;
  showActionButtons?: boolean;
  onActionButtonClick?: (action: string) => void;
  actionType?: string;
  onEmailClick?: (emailId: string, actionType: string) => void;
  categories?: Category[];
  showCategoryButtons?: boolean;
  onCategoryClick?: (categoryId: string, categoryLabel: string) => void;
};

const actionButtons = [
  { id: "view_read", label: "View & Read", icon: "👁️", color: "from-blue-600 to-cyan-500" },
  { id: "summarize", label: "Summarize", icon: "📝", color: "from-purple-600 to-pink-500" },
  { id: "reply_compose", label: "Reply & Compose", icon: "✉️", color: "from-green-600 to-emerald-500" },
  { id: "delete_organize", label: "Delete & Organize", icon: "🗑️", color: "from-orange-600 to-red-500" },
  { id: "daily_digest", label: "Daily Digest", icon: "📈", color: "from-indigo-600 to-purple-500" },
  { id: "categorize_mails", label: "Categorize", icon: "📂", color: "from-yellow-600 to-amber-500" },
];

export default function MessageBubble({
  role,
  text,
  emails = [],
  emailContent,
  showActionButtons = false,
  onActionButtonClick,
  actionType,
  onEmailClick,
  categories = [],
  showCategoryButtons = false,
  onCategoryClick,
}: MessageBubbleProps) {
  const isUser = role === "user";
  const [visibleCount, setVisibleCount] = useState(EMAILS_PER_PAGE);
  const visibleEmails = emails.slice(0, visibleCount);
  const hasMore = emails.length > visibleCount;
  const remainingCount = Math.min(EMAILS_PER_PAGE, emails.length - visibleCount);

  const formatText = (text: string) => {
    return text.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line}
        {i < text.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === "N/A") return dateStr;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-6`}>
      <div className={`max-w-[85%] min-w-0 ${isUser ? "order-2" : "order-1"}`}>
        {/* Avatar */}
        <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isUser ? "bg-gradient-to-br from-indigo-600 to-purple-600" : "bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50"}`}>
            {isUser ? (
              <span className="text-white font-semibold text-sm">You</span>
            ) : (
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            )}
          </div>
          
          {/* Message Bubble */}
          <div className={`rounded-2xl ${isUser ? "rounded-br-none bg-gradient-to-r from-indigo-600 to-purple-600" : "rounded-bl-none bg-gray-800/50 backdrop-blur-sm border border-gray-700/50"} p-5 shadow-lg ${isUser ? "shadow-indigo-500/20" : "shadow-gray-900/20"} min-w-0 overflow-hidden`}>
            {/* Read-mail card: compact layout, no horizontal scroll */}
            {emailContent ? (
              <div className="space-y-4 w-full min-w-0 overflow-x-hidden">
                <div className="border-b border-gray-600/50 pb-3">
                  <h3 className="text-gray-100 font-semibold text-sm mb-2 break-words">
                    {emailContent.subject}
                  </h3>
                  <div className="grid gap-1.5 text-xs text-gray-400">
                    <p className="truncate" title={emailContent.from}>
                      <span className="text-gray-500">From:</span>{" "}
                      <span className="text-gray-300">{emailContent.from}</span>
                    </p>
                    <p className="truncate" title={emailContent.to}>
                      <span className="text-gray-500">To:</span>{" "}
                      <span className="text-gray-300">{emailContent.to}</span>
                    </p>
                    <p>
                      <span className="text-gray-500">Date:</span>{" "}
                      <span className="text-gray-300">{formatDate(emailContent.date)}</span>
                    </p>
                  </div>
                </div>
                <div className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap break-words max-w-full" style={{ wordBreak: "break-word" }}>
                  {emailContent.body || "No content."}
                </div>
              </div>
            ) : (
              /* Message Text */
              <div className={`${isUser ? "text-white" : "text-gray-100"} font-normal text-base leading-relaxed break-words whitespace-pre-wrap min-w-0`}>
                {formatText(text)}
              </div>
            )}

            {/* Action Buttons Grid */}
            {showActionButtons && (
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {actionButtons.map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => onActionButtonClick?.(btn.id)}
                    className={`group bg-gradient-to-r ${btn.color} hover:opacity-90 text-white rounded-xl p-4 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 border border-white/10 shadow-lg`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center text-lg">
                        {btn.icon}
                      </div>
                      <span className="font-semibold text-sm text-left">{btn.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Category Buttons */}
            {showCategoryButtons && categories && categories.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-300 mb-3 font-medium">Select a category:</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => onCategoryClick?.(cat.id, cat.label)}
                      className="px-4 py-2.5 bg-gray-700/50 hover:bg-gray-600/50 backdrop-blur-sm border border-gray-600/50 rounded-xl text-gray-200 hover:text-white transition-all duration-300 hover:scale-105 active:scale-95 text-sm font-medium"
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Email List */}
            {emails && emails.length > 0 && (
              <div className="mt-6 space-y-4">
                <p className="text-sm text-gray-300 font-medium mb-3">
                  📧 Select an email to {actionType === "summarize" ? "summarize" : actionType === "delete" ? "delete" : actionType === "reply" ? "reply to" : "view"}:
                </p>
                <div className="space-y-3">
                  {visibleEmails.map((email) => (
                    <div
                      key={email.id}
                      onClick={() => onEmailClick?.(email.id, actionType || "read")}
                      className="group bg-gray-800/30 hover:bg-gray-700/40 backdrop-blur-sm border border-gray-700/50 hover:border-purple-500/30 rounded-xl p-4 cursor-pointer transition-all duration-300 hover:translate-x-1"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-gray-100 font-semibold text-sm mb-1 truncate group-hover:text-white transition-colors">
                            {email.subject}
                          </h4>
                          <p className="text-gray-400 text-xs mb-1">
                            From: <span className="text-gray-300">{email.from}</span>
                          </p>
                          {email.date && (
                            <p className="text-gray-500 text-xs">
                              📅 {new Date(email.date).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          )}
                        </div>
                        <div className="ml-3 flex-shrink-0">
                          <span className="px-2.5 py-1 bg-gradient-to-r from-purple-900/30 to-indigo-900/30 text-purple-300 text-xs font-medium rounded-lg border border-purple-500/20">
                            #{email.email_number || email.id.slice(-4)}
                          </span>
                        </div>
                      </div>
                      
                      {(email.snippet || email.summary) && (
                        <p className="text-gray-400 text-sm mt-2 line-clamp-2 group-hover:text-gray-300 transition-colors">
                          {email.summary || email.snippet}
                        </p>
                      )}
                      
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-700/50">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                            actionType === "summarize" 
                              ? "bg-blue-900/30 text-blue-300 border border-blue-500/20" 
                              : actionType === "delete"
                              ? "bg-red-900/30 text-red-300 border border-red-500/20"
                              : actionType === "reply"
                              ? "bg-green-900/30 text-green-300 border border-green-500/20"
                              : "bg-gray-700/50 text-gray-300 border border-gray-600/50"
                          }`}>
                            {actionType === "summarize" ? "Summarize" : 
                             actionType === "delete" ? "Delete" : 
                             actionType === "reply" ? "Reply" : "View"}
                          </span>
                        </div>
                        <div className="text-gray-500 group-hover:text-gray-400 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                  {hasMore && (
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + EMAILS_PER_PAGE)}
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-gray-600 hover:border-purple-500/50 hover:bg-gray-800/30 text-gray-400 hover:text-purple-300 transition-all duration-300 group"
                      aria-label="Load next 10 emails"
                    >
                      <span className="w-8 h-8 rounded-full bg-gray-700/50 group-hover:bg-purple-500/20 flex items-center justify-center text-lg font-semibold transition-colors">
                        +
                      </span>
                      <span className="text-sm font-medium">
                        Show next {remainingCount} email{remainingCount !== 1 ? "s" : ""}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Timestamp */}
        <div className={`text-xs text-gray-500 mt-2 ${isUser ? "text-right" : "text-left"} px-2`}>
          {isUser ? "You" : "AI Assistant"}
        </div>
      </div>
    </div>
  );
}