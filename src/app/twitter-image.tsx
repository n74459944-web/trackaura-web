import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "TrackAura - Canadian Electronics Price Tracker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #06090f 0%, #0d1117 50%, #141a24 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              background: "linear-gradient(135deg, #00e5a0, #38bdf8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 800,
              color: "#06090f",
            }}
          >
            T
          </div>
          <span style={{ fontSize: 48, fontWeight: 700, color: "#e8edf5" }}>
            Track
            <span style={{ color: "#00e5a0" }}>Aura</span>
          </span>
        </div>
        <p
          style={{
            fontSize: 28,
            color: "#8994a7",
            textAlign: "center",
            maxWidth: 700,
            lineHeight: 1.4,
          }}
        >
          Canadian Electronics Price Tracker
        </p>
        <p
          style={{
            fontSize: 20,
            color: "#00e5a0",
            marginTop: 16,
          }}
        >
          Compare prices across Canada Computers, Newegg & Amazon
        </p>
      </div>
    ),
    { ...size }
  );
}
