'use client';

import { useEffect, useState } from 'react';

interface HandDrawnArrowProps {
  className?: string;
}

export default function HandDrawnArrow({ className = "w-8 h-8" }: HandDrawnArrowProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    setAnimated(true);
  }, []);

  return (
    <div className="flex justify-center">
      <div className="bg-white rounded-full p-3 border border-gray-200 shadow-sm">
        <svg 
          className={`${className} text-gray-600`}
          viewBox="0 0 32 32" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Hand-drawn style arrow path */}
          <path
            d="M16 4 C15.8 5 15.9 6 16 7 C16.1 8 16 9 15.9 10 C15.8 11 15.7 12 15.8 13 C15.9 14 16.1 15 16.2 16 C16.1 17 15.9 18 16 19 C16.1 20 16.2 21 16.1 22 C16 23 15.9 24 16 25 C16.1 26 16.2 27 16 28"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="40"
            strokeDashoffset={animated ? "0" : "40"}
            style={{
              transition: "stroke-dashoffset 1s ease-in-out",
              filter: "url(#roughPaper)"
            }}
          />
          {/* Arrow head */}
          <path
            d="M12 24 C13 25 14 26 16 28 C18 26 19 25 20 24"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="16"
            strokeDashoffset={animated ? "0" : "16"}
            style={{
              transition: "stroke-dashoffset 1.2s ease-in-out 0.2s",
              filter: "url(#roughPaper)"
            }}
          />
          
          {/* SVG Filter for rough paper effect */}
          <defs>
            <filter id="roughPaper" x="-50%" y="-50%" width="200%" height="200%">
              <feTurbulence 
                baseFrequency="0.04" 
                numOctaves="3" 
                seed="1" 
                stitchTiles="stitch"
              />
              <feDisplacementMap 
                in="SourceGraphic" 
                scale="0.8"
              />
            </filter>
          </defs>
        </svg>
      </div>
    </div>
  );
}