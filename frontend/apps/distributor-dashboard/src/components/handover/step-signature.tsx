'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@lynia/utils';
import { PenLine, RotateCcw, CheckCircle2 } from 'lucide-react';

interface Props {
  signatureUrl: string | null;
  onUpdate: (url: string | null) => void;
}

export function StepSignature({ signatureUrl, onUpdate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    // Draw signature line
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, rect.height - 30);
    ctx.lineTo(rect.width - 20, rect.height - 30);
    ctx.stroke();
    // Reset stroke style for drawing
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasStrokes(true);
  };

  const stopDraw = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Redraw line
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, rect.height - 30);
    ctx.lineTo(rect.width - 20, rect.height - 30);
    ctx.stroke();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    setHasStrokes(false);
    onUpdate(null);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onUpdate(dataUrl);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Customer must sign below to confirm receipt of the device and acceptance of loan terms.
      </p>

      {signatureUrl ? (
        <div className="space-y-3">
          <div className="rounded-lg border overflow-hidden">
            <div className="bg-white p-4 flex items-center justify-center" style={{ minHeight: 180 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signatureUrl}
                alt="Customer signature"
                className="max-h-[160px] object-contain"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 p-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">Signature captured</p>
          </div>
          <Button variant="outline" className="w-full" onClick={handleClear}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Re-sign
          </Button>
        </div>
      ) : (
        <>
          {/* Canvas — taller on tablets (md: 280px) for comfortable signing */}
          <div className="rounded-lg border overflow-hidden bg-white relative">
            <canvas
              ref={canvasRef}
              className="w-full touch-none cursor-crosshair h-[200px] md:h-[280px]"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
            {!hasStrokes && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-muted-foreground/30 text-lg font-medium select-none">
                  Sign here
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <PenLine className="h-3.5 w-3.5" />
            <span>Draw signature using finger or stylus</span>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClear}
              disabled={!hasStrokes}
            >
              <RotateCcw className="h-4 w-4 mr-1.5" /> Clear
            </Button>
            <Button
              className="flex-1"
              disabled={!hasStrokes}
              onClick={handleConfirm}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> Confirm Signature
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
