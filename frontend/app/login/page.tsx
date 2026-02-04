import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
          <p className="text-gray-600">Loading...</p>
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
