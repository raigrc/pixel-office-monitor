import StaticOfficeDemo from "@/components/scene/StaticOfficeDemo";

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[#0F172A]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[#F1F5F9] mb-4 font-mono">
          Static Office Demo
        </h1>
        <p className="text-[#94A3B8] mb-8">
          Warm Modern Office — 384×256 logical pixels, 16px tiles, 6 desks + orchestrator
        </p>
        <StaticOfficeDemo scale={2} />
      </div>
    </div>
  );
}