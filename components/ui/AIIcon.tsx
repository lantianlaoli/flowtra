interface AIIconProps {
  className?: string;
}

export default function AIIcon({ className = "w-6 h-6" }: AIIconProps) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 4h4l2 2-2 2H4V4zM16 4h4v4l-2 2-2-2V4zM4 16v4h4l2-2-2-2H4zM16 16l2 2-2 2h4v-4h-4z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M9 9h6v6H9z"
        fill="currentColor"
        opacity="0.6"
      />
      <circle
        cx="12"
        cy="12"
        r="2"
        fill="currentColor"
      />
    </svg>
  );
}