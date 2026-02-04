"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import DraggableAuthWindow from "@/components/DraggableAuthWindow";

const AUTH_MESSAGE_ORIGIN = typeof window !== "undefined" ? window.location.origin : "";

export default function LoginClient() {
  const params = useSearchParams();
  const error = params.get("error");
  const [backendUrl, setBackendUrl] = useState("");
  const [popupError, setPopupError] = useState<string | null>(null);

  useEffect(() => {
    setBackendUrl(process.env.NEXT_PUBLIC_BACKEND_URL || "");
  }, []);

  // When opened in popup or iframe after OAuth error: send error to opener/parent and close (popup only)
  useEffect(() => {
    if (typeof window === "undefined" || !error) return;
    const target = window.opener ?? (window !== window.top ? window.parent : null);
    if (target) {
      try {
        target.postMessage(
          { type: "auth-error", error },
          AUTH_MESSAGE_ORIGIN
        );
      } finally {
        if (window.opener) window.close();
      }
    }
  }, [error]);

  const getErrorMessage = (error: string | null) => {
    if (!error) return null;
    
    const errorMessages: Record<string, string> = {
      access_denied: "You denied access to your Google account. Please try again and grant the necessary permissions.",
      no_code: "Authentication failed. No authorization code received.",
      no_credentials: "Failed to obtain credentials. Please try again.",
      callback_error: "An error occurred during authentication. Please try again.",
    };

    return errorMessages[error] || "An authentication error occurred. Please try again.";
  };

  const displayError = popupError || error;
  const errorMessage = getErrorMessage(displayError);

  const [authWindowOpen, setAuthWindowOpen] = useState(false);

  useEffect(() => {
    if (!authWindowOpen) return;
    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "auth-success") {
        setAuthWindowOpen(false);
        window.removeEventListener("message", handleMessage);
        window.location.href = `/dashboard?token=${encodeURIComponent(e.data.token)}`;
      }
      if (e.data?.type === "auth-error") {
        setAuthWindowOpen(false);
        window.removeEventListener("message", handleMessage);
        setPopupError(e.data.error || "callback_error");
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [authWindowOpen]);

  const openGoogleAuth = () => {
    if (!backendUrl) return;
    setAuthWindowOpen(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-8 md:p-10 max-w-md w-full border border-indigo-100/50">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
            MailMind
          </h1>
          <p className="text-gray-600">Email Assistant</p>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-sm font-semibold text-red-800 mb-1">Authentication Error</p>
                <p className="text-sm text-red-700">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Info Message */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm text-blue-800">
            <strong>What you'll grant access to:</strong>
          </p>
          <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
            <li>Read your emails</li>
            <li>Send emails on your behalf</li>
            <li>Delete emails</li>
            <li>View your profile information</li>
          </ul>
        </div>

        {/* Google Sign In Button */}
        <button
          type="button"
          onClick={openGoogleAuth}
          disabled={!backendUrl}
          className="group relative w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 rounded-xl px-6 py-4 font-semibold text-gray-700 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/20 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span className="text-gray-700 group-hover:text-indigo-600 transition-colors">
            Continue with Google
          </span>
          <svg
            className="w-5 h-5 ml-auto text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </button>

        {/* Trust Indicators */}
        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <svg
              className="w-4 h-4 text-green-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>Secure</span>
          </div>
          <div className="flex items-center gap-1">
            <svg
              className="w-4 h-4 text-blue-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path
                fillRule="evenodd"
                d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                clipRule="evenodd"
              />
            </svg>
            <span>AI-Powered</span>
          </div>
          <div className="flex items-center gap-1">
            <svg
              className="w-4 h-4 text-purple-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
            <span>Fast</span>
          </div>
        </div>
      </div>

      <DraggableAuthWindow
        open={authWindowOpen}
        onClose={() => setAuthWindowOpen(false)}
        authUrl={backendUrl ? `${backendUrl}/auth/login` : ""}
      />
    </div>
  );
}
