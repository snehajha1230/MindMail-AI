"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import ChatWindow from "@/components/ChatWindow";
import { getUserProfile } from "@/lib/api";

const AUTH_MESSAGE_ORIGIN = typeof window !== "undefined" ? window.location.origin : "";

export default function DashboardPage() {
  const params = useSearchParams();
  const token = params.get("token");
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showChat, setShowChat] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isPopupAuth, setIsPopupAuth] = useState(false);

  // When opened in popup or iframe after OAuth callback: send token to opener/parent and close (popup only)
  useEffect(() => {
    if (typeof window === "undefined" || !token) return;
    const target = window.opener ?? (window !== window.top ? window.parent : null);
    if (target) {
      setIsPopupAuth(true);
      try {
        target.postMessage(
          { type: "auth-success", token },
          AUTH_MESSAGE_ORIGIN
        );
      } finally {
        if (window.opener) window.close();
      }
    }
  }, [token]);

  useEffect(() => {
    if (token && !isPopupAuth) {
      loadUserProfile();
    }
  }, [token, isPopupAuth]);

  async function loadUserProfile() {
    try {
      setIsLoading(true);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL!;
      const profile = await getUserProfile(backendUrl, token!);
      setUserProfile(profile);
    } catch (error) {
      console.error("Failed to load user profile:", error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isPopupAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <p className="text-white/80">Signing you in...</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent"></div>
        <div className="absolute inset-0 bg-grid-white/5 bg-[size:20px_20px]"></div>
        
        {/* Floating Particles */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-purple-500/30 rounded-full animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 bg-gray-900/80 backdrop-blur-xl rounded-3xl border border-gray-700/50 p-12 max-w-md w-full mx-4 shadow-2xl">
          <div className="flex flex-col items-center">
            {/* Animated Icon */}
            <div className="relative mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-full flex items-center justify-center animate-pulse">
                <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center">
                  <svg
                    className="w-10 h-10 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div className="absolute -inset-4 border-2 border-red-500/30 rounded-full animate-ping"></div>
              </div>
            </div>

            <h2 className="text-3xl font-bold text-white mb-3 text-center bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Authentication Failed
            </h2>
            <p className="text-gray-400 mb-8 text-center text-lg">
              Please log in again to access your dashboard
            </p>

            <a
              href="/"
              className="group relative overflow-hidden bg-gradient-to-r from-red-600 to-red-700 text-white px-10 py-4 rounded-2xl font-semibold text-lg transition-all duration-300 hover:from-red-700 hover:to-red-800 hover:shadow-2xl hover:shadow-red-500/25"
            >
              <span className="relative z-10">Go to Login</span>
              <div className="absolute inset-0 bg-gradient-to-r from-red-700 to-red-800 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            </a>
          </div>
        </div>
      </div>
    );
  }

  const guideFeatures = [
    {
      title: "View & Read",
      tagline: "Your inbox at a glance",
      description: "Browse and read your emails in one place. MailMind surfaces your messages so you can quickly see what needs attention—no more digging through folders.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      gradient: "from-violet-500 to-purple-600",
      accent: "text-violet-400",
    },
    {
      title: "Summarize, Reply & Compose",
      tagline: "Write smarter, not harder",
      description: "Get AI-powered summaries of long threads, one-tap smart replies that match your tone, and compose new emails with suggestions—so you spend less time typing and more time doing.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      gradient: "from-blue-500 to-cyan-500",
      accent: "text-cyan-400",
    },
    {
      title: "Delete & Organise",
      tagline: "Keep your inbox clean",
      description: "Bulk delete spam and old threads, move messages into labels or folders, and archive what you don’t need. MailMind helps you declutter so the important stuff stays visible.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      gradient: "from-emerald-500 to-teal-500",
      accent: "text-emerald-400",
    },
    {
      title: "Daily Digest & Categorise",
      tagline: "One summary, zero overwhelm",
      description: "Get a single daily digest of what matters—key senders, action items, and updates. Emails are auto-categorised (work, personal, promos) so you can focus on what’s relevant.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      gradient: "from-amber-500 to-orange-500",
      accent: "text-amber-400",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-grid-white/5 bg-[size:20px_20px]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/10 via-transparent to-transparent"></div>
      
      {/* Floating Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* Glassmorphism Header */}
      <div className="relative z-30 bg-gray-900/40 backdrop-blur-xl border-b border-gray-700/50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Logo with Glow */}
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-2xl blur-xl"></div>
                <div className="relative w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-2xl">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>

              {/* User Info */}
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-gray-200 to-gray-300 bg-clip-text text-transparent">
                  AI Email Assistant
                </h1>
                {userProfile && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <p className="text-gray-300 text-sm">
                      Welcome, <span className="font-semibold text-white">{userProfile.name || userProfile.given_name || "User"}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Toggle Chat Button */}
            <button
              onClick={() => setShowChat(!showChat)}
              className="group relative overflow-hidden px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold hover:shadow-2xl hover:shadow-purple-500/25 transition-all duration-300"
            >
              <span className="relative z-10 flex items-center gap-2">
                {showChat ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Hide Assistant
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Show Assistant
                  </>
                )}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-purple-700 to-pink-700 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-20 container mx-auto px-6 py-8">
        {!showChat ? (
          <div className="max-w-7xl mx-auto">
            {/* Hero Welcome Card */}
            <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl border border-gray-700/50 p-8 shadow-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-purple-600/10 to-transparent rounded-full blur-3xl"></div>
              
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-600/20 to-pink-600/20">
                        <svg className="w-8 h-8 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.996 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.984zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white">Good day!</h2>
                        <p className="text-gray-400">Your AI assistant is ready to help</p>
                      </div>
                    </div>
                    
                    <blockquote className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight max-w-3xl">
                      "Welcome back! Your inbox is your command center. Let AI help you
                      manage it effortlessly."
                    </blockquote>
                    
                    <div className="flex items-center gap-2 text-gray-400">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">— Your AI Email Assistant is online</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* MailMind AI Guide */}
            <div className="mb-8">
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm font-medium mb-4">
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                  Getting started
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  MailMind AI Guide
                </h3>
                <p className="text-gray-400 max-w-2xl">
                  Here’s what you can do with MailMind. Ask the assistant for any of these—in plain English—and it’ll help you get there.
                </p>
              </div>

              <div className="space-y-4">
                {guideFeatures.map((feature, idx) => (
                  <div
                    key={idx}
                    className="group relative overflow-hidden rounded-2xl bg-gray-900/50 backdrop-blur-xl border border-gray-700/50 hover:border-gray-600/60 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative flex flex-col sm:flex-row sm:items-start gap-5 p-6">
                      <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-white shadow-lg`}>
                        {feature.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h4 className={`text-lg font-semibold ${feature.accent}`}>
                            {feature.title}
                          </h4>
                          <span className="text-xs text-gray-500 font-medium">
                            {feature.tagline}
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                      <button
                        onClick={() => setShowChat(true)}
                        className="flex-shrink-0 flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-purple-400 transition-colors"
                      >
                        Try in assistant
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Section */}
            <div className="mt-8 text-center">
              <button
                onClick={() => setShowChat(true)}
                className="group relative overflow-hidden inline-flex items-center gap-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-10 py-5 rounded-2xl font-bold text-lg transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/25 hover:scale-105"
              >
                <span className="relative z-10 flex items-center gap-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Launch AI Assistant
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-700 to-pink-700 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-600/50 to-pink-600/50 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-300"></div>
              </button>
              <p className="text-gray-400 mt-4 text-sm">
                Get instant AI-powered assistance with your emails
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-gray-200 to-gray-300 bg-clip-text text-transparent mb-2">
                AI Assistant is Active
              </h2>
              <p className="text-gray-400">Your AI assistant is ready to help manage your emails</p>
            </div>
          </div>
        )}
      </div>

      {/* Chat Window */}
      {showChat && (
        <div className="relative z-40">
          <ChatWindow token={token!} action={null} onClose={() => setShowChat(false)} />
        </div>
      )}

      {/* Add custom animations */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
            opacity: 0.5;
          }
          50% {
            transform: translateY(-20px) rotate(10deg);
            opacity: 1;
          }
        }
        
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        
        .bg-grid-white\/5 {
          background-image: linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
        }
      `}</style>
    </div>
  );
}