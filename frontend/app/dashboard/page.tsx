import { Suspense } from "react";
import DashboardClient from "./DashboardClient";

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
          <p className="text-white/80">Loading dashboard...</p>
        </div>
      }
    >
      <DashboardClient />
    </Suspense>
  );
}
