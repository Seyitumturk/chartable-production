import React from 'react';
import { Button } from '@/components/ui/Button';

interface DiagramZoomControlsProps {
  scale: number;
  setScale: (scale: number) => void;
  setPosition: (position: { x: number; y: number }) => void;
}

const DiagramZoomControls: React.FC<DiagramZoomControlsProps> = ({
  scale,
  setScale,
  setPosition
}) => {
  // Zoom in by 20%
  const zoomIn = () => {
    setScale(Math.min(scale * 1.2, 5.0));
  };

  // Zoom out by 20%
  const zoomOut = () => {
    setScale(Math.max(scale / 1.2, 0.2));
  };

  // Reset zoom and position
  const resetView = () => {
    setScale(1.0);
    setPosition({ x: 0, y: 0 });
  };

  // Calculate the percentage display value
  const scalePercent = Math.round(scale * 100);

  return (
    <div className="flex items-center space-x-1 border rounded-md px-1">
      <Button
        size="sm"
        variant="ghost"
        onClick={zoomOut}
        disabled={scale <= 0.2}
        className="h-8 w-8 p-0"
        title="Zoom Out"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          <line x1="8" y1="11" x2="14" y2="11"></line>
        </svg>
      </Button>

      <button
        className="px-1 text-xs font-medium text-gray-700 dark:text-gray-300 min-w-[52px] text-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm"
        onClick={resetView}
        title="Reset Zoom"
      >
        {scalePercent}%
      </button>

      <Button
        size="sm"
        variant="ghost"
        onClick={zoomIn}
        disabled={scale >= 5.0}
        className="h-8 w-8 p-0"
        title="Zoom In"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          <line x1="11" y1="8" x2="11" y2="14"></line>
          <line x1="8" y1="11" x2="14" y2="11"></line>
        </svg>
      </Button>
    </div>
  );
};

export default DiagramZoomControls; 