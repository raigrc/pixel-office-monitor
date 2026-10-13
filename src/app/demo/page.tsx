import StaticOfficeDemo from "@/components/scene/StaticOfficeDemo";

export default function DemoPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--canvas)]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="mb-4 text-lg font-bold text-[var(--text)] sm:text-2xl" style={{ fontFamily: "var(--font-pixel), monospace" }}>
          Static Office Demo
        </h1>
        <p className="mb-8 text-[var(--muted)]">
          Angled 2.5D office, 512×384 logical pixels, 16px tiles, 11 default desks
        </p>
        <StaticOfficeDemo scale={2} />
      </div>
    </div>
  );
}
