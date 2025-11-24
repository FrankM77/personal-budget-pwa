import React, { useState } from "react";
import { motion, useAnimation } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { Trash2 } from "lucide-react";

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
  threshold?: number; // Drag distance to trigger delete (e.g., -100)
}

export const SwipeableRow: React.FC<SwipeableRowProps> = ({
  children,
  onDelete,
  threshold = -100,
}) => {
  const controls = useAnimation();
  const [isDeleted, setIsDeleted] = useState(false);

  const handleDragEnd = async (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    // Trigger if dragged past threshold OR flicked fast to the left
    if (offset < threshold || (offset < -50 && velocity < -500)) {
      setIsDeleted(true);
      // Animate off screen to the left
      await controls.start({ x: -500, transition: { duration: 0.2 } });
      onDelete();
    } else {
      // "Rubber band" snap back to origin
      controls.start({ x: 0 });
    }
  };

  // If deleted, we keep it hidden until the parent removes it from the DOM
  if (isDeleted) return null;

  return (
    <div className="relative w-full overflow-hidden mb-2 rounded-xl group">
      {/* 1. Background Layer (Red Delete Zone) */}
      {/* This sits behind the content using absolute positioning */}
      <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-6 rounded-xl">
        <Trash2 className="text-white w-6 h-6" />
      </div>

      {/* 2. Foreground Layer (Draggable Content) */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -500, right: 0 }} // Cannot drag right
        dragElastic={0.1} // iOS-like resistance
        onDragEnd={handleDragEnd}
        animate={controls}
        className="relative bg-white dark:bg-zinc-900 z-10 rounded-xl"
        // Critical: "pan-y" allows vertical scrolling while touching this element
        style={{ touchAction: "pan-y" }} 
      >
        {children}
      </motion.div>
    </div>
  );
};