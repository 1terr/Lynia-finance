'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  X,
  Maximize2,
  CreditCard,
  User,
} from 'lucide-react';
import { cn } from '@lynia/utils';
import { Button } from '@/components/ui/button';

interface DocumentViewerProps {
  idDocumentUrl: string;
  selfieUrl: string;
  idDocumentType?: string;
  className?: string;
}

export function DocumentViewer({
  idDocumentUrl,
  selfieUrl,
  idDocumentType = 'National ID',
  className,
}: DocumentViewerProps) {
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const openFullscreen = useCallback((url: string) => {
    setFullscreenImage(url);
    setZoom(1);
    setRotation(0);
  }, []);

  const closeFullscreen = useCallback(() => {
    setFullscreenImage(null);
    setZoom(1);
    setRotation(0);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  return (
    <>
      <div className={cn('space-y-4', className)}>
        {/* ID Document */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {idDocumentType}
            </span>
          </div>
          <div
            className="relative aspect-[1.6/1] overflow-hidden rounded-lg border border-border bg-muted cursor-pointer group"
            onClick={() => openFullscreen(idDocumentUrl)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFullscreen(idDocumentUrl); } }}
          >
            <Image
              src={idDocumentUrl}
              alt="ID Document"
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
            </div>
          </div>
        </div>

        {/* Selfie */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Live Selfie
            </span>
          </div>
          <div
            className="relative aspect-square max-w-[200px] overflow-hidden rounded-lg border border-border bg-muted cursor-pointer group"
            onClick={() => openFullscreen(selfieUrl)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFullscreen(selfieUrl); } }}
          >
            <Image
              src={selfieUrl}
              alt="Customer Selfie"
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="200px"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Modal */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={closeFullscreen}
          role="presentation"
        >
          {/* Toolbar */}
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-lg bg-card/90 px-3 py-2 shadow-lg backdrop-blur z-10"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="toolbar"
          >
            <Button variant="ghost" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium text-muted-foreground min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button variant="ghost" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <div className="h-4 w-px bg-border" />
            <Button variant="ghost" size="sm" onClick={handleRotate}>
              <RotateCw className="h-4 w-4" />
            </Button>
            <div className="h-4 w-px bg-border" />
            <Button variant="ghost" size="sm" onClick={closeFullscreen}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Image */}
          <div
            className="relative max-w-[90vw] max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="toolbar"
          >
            <Image
              src={fullscreenImage}
              alt="Document full view"
              width={1200}
              height={800}
              className="rounded-lg transition-transform"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
