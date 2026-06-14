export default function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M3.2 11.3 L12 4 L20.8 11.3 V19.4 a1.1 1.1 0 0 1-1.1 1.1 H4.3 a1.1 1.1 0 0 1-1.1-1.1 Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M12.7 8.4 L9.6 13.4 H11.8 L11.1 16.8 L14.6 11.6 H12.2 Z" fill="#3B82F6" />
    </svg>
  )
}
