import { Dashboard } from "@/components/dashboard";
import { SmartPanel } from "@/components/shared/assistant";
import { Footer } from "@/components/layout";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="page-home">
      <main className="flex-1 overflow-auto">
        <Dashboard />
      </main>
      
      <SmartPanel />
      
      <Footer />
    </div>
  );
}
