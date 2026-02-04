"use client";

import { useState, useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import {
  sendMessage,
  getGreeting,
  confirmAction,
  deleteEmail,
  getEmailById,
} from "@/lib/api";

type Props = {
  token: string;
  action?: "summarize" | "delete" | "respond" | "read" | null;
  onClose: () => void;
};

type Email = {
  id: string;
  subject: string;
  from: string;
  snippet?: string;
  summary?: string;
  email_number?: number;
  date?: string;
};

type Category = { id: string; label: string };

type EmailContent = {
  from: string;
  to: string;
  date: string;
  subject: string;
  body: string;
};

type Message = {
  role: "user" | "assistant";
  text: string;
  emails?: Email[];
  email_id?: string;
  email_content?: EmailContent;
  generated_reply?: string;
  original_email?: { from: string; subject: string };
  action_required?: string;
  showActionButtons?: boolean;
  actionType?: string;
  categories?: Category[];
  showCategoryButtons?: boolean;
};

export default function ChatWindow({ token, action, onClose }: Props) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL!;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: "send_reply" | "delete" | "compose_reply";
    emailId: string;
    replyText?: string;
  } | null>(null);
  const [currentActionType, setCurrentActionType] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    initializeChat();
  }, []);

  async function initializeChat() {
    setLoading(true);
    try {
      const greetingData = await getGreeting(backendUrl, token);
      setMessages([
        {
          role: "assistant",
          text: greetingData.reply || "Hello! I'm your AI email assistant. How can I help you manage your emails today?",
          showActionButtons: true,
        },
      ]);
    } catch (error) {
      setMessages([
        {
          role: "assistant",
          text: "Hello! I'm your AI email assistant. How can I help you manage your emails today?",
          showActionButtons: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleActionButtonClick(action: string) {
    setLoading(true);
    
    const actionMap: Record<string, { type: string; message: string; command: string }> = {
      "view_read": { type: "read", message: "View & Read Emails", command: "View & Read Emails" },
      "summarize": { type: "summarize", message: "Summarize Emails", command: "Summarize Emails" },
      "reply_compose": { type: "reply", message: "Reply & Compose", command: "Reply & Compose" },
      "delete_organize": { type: "delete", message: "Delete & Organize", command: "Delete & Organize" },
      "daily_digest": { type: "digest", message: "Daily Digest", command: "daily digest" },
      "categorize_mails": { type: "categorize", message: "Categorize Mails", command: "categorize mails" },
    };
    
    const actionInfo = actionMap[action];
    if (!actionInfo) {
      setLoading(false);
      return;
    }
    
    if (action !== "daily_digest" && action !== "categorize_mails") {
      setCurrentActionType(actionInfo.type);
    } else {
      setCurrentActionType(null);
    }
    
    const userMessage = actionInfo.message;
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);

    try {
      const command = actionInfo.command;
      const data = await sendMessage(backendUrl, token, command);

      if (data.action_required) {
        if (data.action_required === "confirm_send" && data.email_id && data.generated_reply) {
          setPendingAction({
            type: "send_reply",
            emailId: data.email_id,
            replyText: data.generated_reply,
          });
        } else if (data.action_required === "confirm_delete" && data.email_id) {
          setPendingAction({
            type: "delete",
            emailId: data.email_id,
          });
        }
      } else {
        setPendingAction(null);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply,
          emails: data.emails,
          email_id: data.email_id,
          generated_reply: data.generated_reply,
          original_email: data.original_email,
          action_required: data.action_required,
          showActionButtons: false,
          actionType: data.action_type || actionInfo.type,
          categories: data.categories,
          showCategoryButtons: data.show_category_buttons,
        },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Sorry, I encountered an error: ${error.message || "Please try again."}`,
          showActionButtons: false,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCategoryClick(categoryId: string, categoryLabel: string) {
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", text: categoryLabel }]);
    try {
      const command = `category:${categoryId}`;
      const data = await sendMessage(backendUrl, token, command);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply,
          emails: data.emails,
          actionType: data.action_type || "read",
          showActionButtons: false,
        },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Sorry, I encountered an error: ${error.message || "Please try again."}`,
          showActionButtons: false,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailClick(emailId: string, actionType: string) {
    if (!actionType) return;
    
    setLoading(true);

    try {
      const command = `email_id:${emailId} action_type:${actionType}`;
      const data = await sendMessage(backendUrl, token, command);

      if (data.action_required) {
        if (data.action_required === "compose_reply" && data.email_id) {
          setPendingAction({
            type: "compose_reply",
            emailId: data.email_id,
          });
        } else if (data.action_required === "confirm_send" && data.email_id && data.generated_reply) {
          setPendingAction({
            type: "send_reply",
            emailId: data.email_id,
            replyText: data.generated_reply,
          });
        } else if (data.action_required === "confirm_delete" && data.email_id) {
          setPendingAction({
            type: "delete",
            emailId: data.email_id,
          });
        }
      } else {
        setPendingAction(null);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply,
          emails: data.emails,
          email_id: data.email_id,
          email_content: data.email_content,
          generated_reply: data.generated_reply,
          original_email: data.original_email,
          action_required: data.action_required,
          showActionButtons: false,
        },
      ]);
      
      setCurrentActionType(null);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Sorry, I encountered an error: ${error.message || "Please try again."}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);

    try {
      if (pendingAction && pendingAction.type === "compose_reply") {
        try {
          const replyMessage = `reply_text:${pendingAction.emailId}:${userMessage}`;
          const data = await sendMessage(backendUrl, token, replyMessage);
          
          if (data.action_required === "confirm_send" && data.email_id && data.generated_reply) {
            setPendingAction({
              type: "send_reply",
              emailId: data.email_id,
              replyText: data.generated_reply,
            });
          }
          
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: data.reply,
              email_id: data.email_id,
              generated_reply: data.generated_reply,
              original_email: data.original_email,
              action_required: data.action_required,
            },
          ]);
          setLoading(false);
          return;
        } catch (error: any) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: `Sorry, I couldn't process your reply. ${error.message || "Please try again."}`,
            },
          ]);
          setLoading(false);
          return;
        }
      }

      if (pendingAction && (pendingAction.type === "send_reply" || pendingAction.type === "delete")) {
        const confirmation = userMessage.toLowerCase().trim();
        const isConfirm = ["yes", "confirm", "send", "y"].includes(confirmation) ||
          confirmation.includes("yes") || confirmation.includes("confirm");
        if (isConfirm) {
          try {
            const result = await confirmAction(
              backendUrl,
              token,
              pendingAction.type,
              pendingAction.emailId,
              pendingAction.replyText || null,
              confirmation
            );
            
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                text: result.reply,
              },
            ]);
            setPendingAction(null);
            setLoading(false);
            return;
          } catch (error: any) {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                text: `Sorry, I couldn't complete that action. ${error.message || "Please try again."}`,
              },
            ]);
            setPendingAction(null);
            setLoading(false);
            return;
          }
        } else if (confirmation.includes("no") || confirmation.includes("cancel")) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: "Action cancelled. Is there anything else I can help you with?",
            },
          ]);
          setPendingAction(null);
          setLoading(false);
          return;
        }
      }

      const data = await sendMessage(backendUrl, token, userMessage);

      if (data.action_required) {
        if (data.action_required === "confirm_send" && data.email_id && data.generated_reply) {
          setPendingAction({
            type: "send_reply",
            emailId: data.email_id,
            replyText: data.generated_reply,
          });
        } else if (data.action_required === "confirm_delete" && data.email_id) {
          setPendingAction({
            type: "delete",
            emailId: data.email_id,
          });
        }
      } else {
        setPendingAction(null);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply,
          emails: data.emails,
          email_id: data.email_id,
          generated_reply: data.generated_reply,
          original_email: data.original_email,
          action_required: data.action_required,
        },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Sorry, I encountered an error: ${error.message || "Please try again."}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-lg z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-3xl shadow-2xl shadow-purple-500/10 w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-gray-700/50">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900/80 via-indigo-900/80 to-blue-900/80 p-6 flex items-center justify-between border-b border-gray-700/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full border-2 border-gray-900 animate-pulse"></div>
            </div>
            <div>
              <h2 className="font-bold text-2xl bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                AI Email Assistant
              </h2>
              <p className="text-sm text-gray-300/80 font-medium flex items-center gap-2 mt-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                {pendingAction
                  ? pendingAction.type === "compose_reply"
                    ? "Compose your reply"
                    : pendingAction.type === "send_reply"
                    ? "Confirm sending"
                    : "Confirm deletion"
                  : "Ready to assist"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="group w-10 h-10 rounded-xl bg-gray-800/50 hover:bg-red-500/20 border border-gray-700/50 hover:border-red-500/30 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95"
          >
            <svg
              className="w-5 h-5 text-gray-400 group-hover:text-red-400 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 bg-gradient-to-b from-gray-900 to-black">
          <div className="max-w-3xl mx-auto space-y-6 min-w-0">
            {messages.length === 0 && !loading && (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-900/30 to-indigo-900/30 rounded-2xl mb-4">
                  <svg
                    className="w-10 h-10 text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                </div>
                <p className="text-gray-400 text-lg font-medium">Starting conversation...</p>
              </div>
            )}
            
            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                role={m.role}
                text={m.text}
                emails={m.emails}
                emailContent={m.email_content}
                showActionButtons={m.showActionButtons}
                onActionButtonClick={handleActionButtonClick}
                actionType={m.actionType}
                onEmailClick={handleEmailClick}
                categories={m.categories}
                showCategoryButtons={m.showCategoryButtons}
                onCategoryClick={handleCategoryClick}
              />
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl rounded-tl-none p-5 border border-gray-700/50 max-w-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex space-x-1">
                      <div className="w-2.5 h-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2.5 h-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2.5 h-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full animate-bounce"></div>
                    </div>
                    <span className="text-sm font-medium bg-gradient-to-r from-gray-300 to-gray-400 bg-clip-text text-transparent">
                      Processing...
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {pendingAction && (
              <div className="mt-4 p-5 bg-gradient-to-r from-yellow-900/20 to-amber-900/10 backdrop-blur-sm rounded-2xl border border-yellow-700/30">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-yellow-300 text-sm">Action Required</p>
                    <p className="text-xs text-yellow-200/70">Confirmation needed</p>
                  </div>
                </div>
                <p className="text-sm text-yellow-100/90">
                  {pendingAction.type === "compose_reply"
                    ? "Type your reply message below. I'll show you a preview before sending."
                    : pendingAction.type === "send_reply"
                    ? "Type 'yes' or 'send' to confirm sending the reply, or 'no' to cancel."
                    : "Type 'yes' or 'confirm' to delete the email, or 'no' to cancel."}
                </p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-6 bg-gradient-to-t from-gray-900 via-gray-900 to-transparent border-t border-gray-800/50">
          <div className="max-w-3xl mx-auto">
            <div className="relative group">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                className="w-full bg-gray-800/50 backdrop-blur-sm border-2 border-gray-700/50 rounded-2xl px-5 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 transition-all duration-300 text-base font-normal"
                style={{ color: input ? "#ffffff" : "#6b7280" }}
                placeholder={
                  pendingAction
                    ? pendingAction.type === "compose_reply"
                      ? "Type your reply message here..."
                      : pendingAction.type === "send_reply"
                      ? "Type 'yes' to send or 'no' to cancel..."
                      : "Type 'yes' to delete or 'no' to cancel..."
                    : "Type your message... (e.g., 'show me my last 5 emails')"
                }
                disabled={loading}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="group relative bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-800 text-white px-6 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40"
                >
                  <span className="relative flex items-center gap-2">
                    {loading ? (
                      <>
                        <svg
                          className="w-5 h-5 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        <span className="text-sm">Processing</span>
                      </>
                    ) : (
                      <>
                        <span>Send</span>
                        <svg
                          className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                          />
                        </svg>
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 px-2">
              <p className="text-xs text-gray-500">
                Press <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Enter</kbd> to send • <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Shift + Enter</kbd> for new line
              </p>
              <div className="flex items-center gap-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500"></div>
                  <div className="w-2 h-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 opacity-50"></div>
                  <div className="w-2 h-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 opacity-25"></div>
                </div>
                <span className="text-xs text-gray-500">AI Ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}