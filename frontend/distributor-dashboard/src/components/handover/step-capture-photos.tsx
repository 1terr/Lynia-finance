'use client';

import { cn } from '@/lib/utils';
import { Camera, X, ImagePlus, Smartphone } from 'lucide-react';

interface Props {
  photos: string[];
  onUpdate: (photos: string[]) => void;
}

const PHOTO_SLOTS = [
  { label: 'Front View', description: 'Screen facing camera' },
  { label: 'Back View', description: 'Back panel visible' },
  { label: 'Screen On', description: 'Device powered on, home screen visible' },
] as const;

// Generate a placeholder photo URL for demo purposes
function generateDemoPhoto(label: string): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" fill="#f3f4f6"><rect width="300" height="400"/><text x="150" y="200" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#6b7280">${label}</text></svg>`
  )}`;
}

export function StepCapturePhotos({ photos, onUpdate }: Props) {
  const handleCapture = (index: number) => {
    // In production, this would open the camera API
    // For demo, generate a placeholder
    const label = PHOTO_SLOTS[index]?.label ?? `Photo ${index + 1}`;
    const newPhotos = [...photos];
    newPhotos[index] = generateDemoPhoto(label);
    onUpdate(newPhotos);
  };

  const handleRemove = (index: number) => {
    const newPhotos = [...photos];
    newPhotos[index] = '';
    onUpdate(newPhotos.filter(Boolean).length > 0 ? newPhotos : []);
  };

  const capturedCount = photos.filter(Boolean).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Take photos of the device from multiple angles. At least 2 photos are required.
      </p>

      {/* Photo grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PHOTO_SLOTS.map((slot, i) => (
          <div key={slot.label} className="space-y-1.5">
            <span className="text-xs font-medium">{slot.label}</span>
            {photos[i] ? (
              <div className="relative rounded-lg border overflow-hidden aspect-[3/4] bg-muted">
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                  <div className="text-center">
                    <Smartphone className="h-8 w-8 text-muted-foreground/40 mx-auto mb-1" />
                    <span className="text-[10px] text-muted-foreground">{slot.label}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(i)}
                  className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-green-500/90 py-1 text-center">
                  <span className="text-[10px] text-white font-medium">Captured</span>
                </div>
              </div>
            ) : (
              <button
                onClick={() => handleCapture(i)}
                className={cn(
                  'w-full rounded-lg border-2 border-dashed aspect-[3/4] flex flex-col items-center justify-center gap-2 transition-colors',
                  'border-muted-foreground/20 hover:border-primary hover:bg-primary/5',
                )}
              >
                <Camera className="h-8 w-8 text-muted-foreground/40" />
                <span className="text-[10px] text-muted-foreground">{slot.description}</span>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add extra photo */}
      {capturedCount >= 3 && (
        <button
          onClick={() => handleCapture(photos.length)}
          className="w-full rounded-lg border-2 border-dashed border-muted-foreground/20 hover:border-primary p-4 flex items-center justify-center gap-2 transition-colors"
        >
          <ImagePlus className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Add another photo</span>
        </button>
      )}

      {/* Status */}
      <div
        className={cn(
          'rounded-lg border p-2.5 text-center text-xs font-medium',
          capturedCount >= 2
            ? 'border-green-200 bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800'
            : 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-800',
        )}
      >
        {capturedCount >= 2
          ? `${capturedCount} photos captured — ready to proceed`
          : `${capturedCount}/2 required photos captured`}
      </div>
    </div>
  );
}
