"use client";

import React from "react";
import dynamic from "next/dynamic";

const BerylCap = dynamic(() => import("@/components/BerylCap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-20 h-20 rounded-2xl border border-white/10 animate-pulse bg-white/5" />
    </div>
  ),
});

interface GlassKeycapWidgetProps {
  legend?: string;
  size?: number;
  className?: string;
}

export default function GlassKeycapWidget({
  legend = "esc.",
  size = 280,
  className = "",
}: GlassKeycapWidgetProps) {
  // Always pure sleek black in both dark and white mode as requested
  const bgHex = "#000000";
  const legendHex = "#ffffff";

  return (
    <div
      className={`relative rounded-3xl border flex items-center justify-center transition-all duration-300 overflow-hidden shadow-2xl ${className}`}
      style={{
        background: "radial-gradient(ellipse at 50% 40%, rgba(255, 90, 42, 0.09), rgba(58, 91, 255, 0.06) 50%, #000000 90%)",
        borderColor: "rgba(255, 255, 255, 0.12)",
        backgroundColor: "#000000",
      }}
    >
      {/* Ambient subtle glow / reflection */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* 3D Glass Keycap Element (Generous Size) */}
      <div className="w-full h-full min-h-[250px] relative flex items-center justify-center select-none">
        <BerylCap
          legend={legend}
          size={size}
          background={bgHex}
          legendColor={legendHex}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
}
