import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-[100dvh] flex flex-col bg-surface">
        <Navbar />
        <main className="flex-1">{children}</main>
      </div>
    </AuthGuard>
  );
}
