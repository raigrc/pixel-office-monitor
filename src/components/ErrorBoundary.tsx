"use client";

import React from "react";

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = { hasError: boolean; message?: string };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(err: unknown): State {
    const message = err instanceof Error ? err.message : String(err);
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          className="rounded-[6px] border-2 bg-[#1E293B] px-4 py-6 text-center"
          style={{ borderColor: "#EF4444" }}
          role="alert"
        >
          <p
            className="text-[16px] font-bold text-[#EF4444]"
            style={{ fontFamily: "var(--font-vt), VT323, monospace" }}
          >
            ◩ office glitch — {this.state.message?.slice(0, 80) ?? "unknown error"}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: undefined })}
            className="mt-3 inline-flex items-center rounded-md border bg-[#0F172A] px-3 py-1.5 text-xs font-medium text-[#F1F5F9] transition-colors duration-200 cursor-pointer hover:bg-[#1E293B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]"
            style={{ borderColor: "#334155", fontFamily: "var(--font-inter), Inter, sans-serif" }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
