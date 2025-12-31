import React, { useState, useRef } from "react";
import { motion, useAnimation } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { Trash2 } from "lucide-react";

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void | boolean | Promise<void | boolean>;
  threshold?: number; // Drag distance to trigger delete (e.g., -100)
}

export const SwipeableRow: React.FC<SwipeableRowProps> = ({
  children,
  onDelete,
  threshold = -100,
}) => {
  const controls = useAnimation();
  const [isDragging, setIsDragging] = useState(false);
  const dragStartTime = useRef<number>(0);

  const handleDragStart = () => {
    setIsDragging(true);
    dragStartTime.current = Date.now();
  };

  const handleDragEnd = async (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    // Keep dragging state for a short time to prevent immediate clicks
    setTimeout(() => setIsDragging(false), 100);

    // Trigger if dragged past threshold OR flicked fast to the left
    if (offset < threshold || (offset < -50 && velocity < -500)) {
      // Don't animate here - let AnimatePresence handle the exit animation
      const result = onDelete();
      
      // If the deletion is cancelled (returns false), snap back
      if (result === false) {
        controls.start({ x: 0 });
      } else if (result instanceof Promise) {
        result.then((res) => {
          if (res === false) controls.start({ x: 0 });
        });
      }
    } else {
      // "Rubber band" snap back to origin
      controls.start({ x: 0 });
    }
  };

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
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        animate={controls}
        className="relative bg-white dark:bg-zinc-900 z-10 rounded-xl"
        // Critical: "pan-y" allows vertical scrolling while touching this element
        style={{
          touchAction: "pan-y",
          pointerEvents: isDragging ? "none" : "auto"
        }}
      >
        {children}
      </motion.div>
    </div>
  );
};
