'use client';

interface SimpleArrowProps {
  className?: string;
  direction?: 'right' | 'down';
}

export default function SimpleArrow({ className = "w-6 h-6", direction = 'right' }: SimpleArrowProps) {
  return (
    <div className="flex items-center justify-center">
      <svg 
        className={`${className} text-gray-400`}
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {direction === 'right' ? (
          <path
            d="M8.5 5L15.5 12L8.5 19"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M5 8.5L12 15.5L19 8.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </div>
  );
}