"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function FlowtraLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="flex items-center gap-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: "loop",
            ease: "easeInOut",
          }}
        >
          <Image
            src="/logo.svg"
            alt="Flowtra"
            width={160}
            height={160}
            className="w-40 h-40"
          />
        </motion.div>

        <div className="w-[2px] h-32 bg-gray-200" />

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: "loop",
            ease: "easeInOut",
            delay: 0.1,
          }}
        >
          <span className="text-6xl font-bold text-black tracking-tight whitespace-nowrap">
            Turn Viral Videos Into Your Own
          </span>
        </motion.div>
      </div>
    </div>
  );
}
