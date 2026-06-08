export const colorStyles = [
    {
      color: "linear-gradient(135deg, #ea580c 0%, #f97316 50%, #fb923c 100%)",
      glow: "#f97316",
    },
    {
      color: "linear-gradient(135deg, #0891b2 0%, #06b6d4 50%, #22d3ee 100%)",
      glow: "#06b6d4",
    },
    {
      color: "linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%)",
      glow: "#3b82f6",
    },
    {
      color: "linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)",
      glow: "#10b981",
    },
    {
      color: "linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #c084fc 100%)",
      glow: "#a855f7",
    },
    {
      color: "linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)",
      glow: "#ef4444",
    },
    {
      color: "linear-gradient(135deg, #ea580c 0%, #f97316 50%, #fb923c 100%)",
      glow: "#f97316",
    },
    {
      color: "linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #f97316 100%)",
      glow: "#ea580c",
    },
    {
      color: "linear-gradient(135deg, #be123c 0%, #e11d48 50%, #f43f5e 100%)",
      glow: "#e11d48",
    },
    {
      color: "linear-gradient(135deg, #4338ca 0%, #6366f1 50%, #818cf8 100%)",
      glow: "#6366f1",
    },
    {
      color: "linear-gradient(135deg, #991b1b 0%, #dc2626 50%, #ef4444 100%)",
      glow: "#dc2626",
    },
    {
      color: "linear-gradient(135deg, #1f2937 0%, #374151 50%, #6b7280 100%)",
      glow: "#374151",
    },
  ]

// Дурын индекс явуулахад дарааллаар нь стайл олгоно.
  export const useColorStyle = (i) =>
  colorStyles[i < colorStyles.length ? i : i % colorStyles.length];
