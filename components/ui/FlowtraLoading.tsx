'use client';

import { motion } from 'framer-motion';

export default function FlowtraLoading() {
  const text = "Flowtra AI";
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="flex items-center justify-center space-x-[2px]">
        {text.split("").map((char, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0.2 }}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: "loop",
              delay: i * 0.15,
              ease: "easeInOut",
            }}
            className="text-2xl font-bold text-black tracking-tight"
          >
            {char === " " ? "\u00A0" : char}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
