'use client';

import { useRef } from 'react';
import { Camera, X } from './icons';

interface UploadedPhoto {
  id: string;
  filename: string;
}

interface DetailsStepProps {
  isAuthenticated: boolean;
  user: { name: string; email: string; phone?: string | null } | null;
  phone: string;
  notes: string;
  photos: UploadedPhoto[];
  onPhoneChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onPhotoUploaded: (photo: UploadedPhoto) => void;
  onPhotoRemoved: (id: string) => void;
  onSignIn: () => void;
  uploadBookingId: string | null;
  onBookingIdAvailable?: (bookingId: string) => void;
}

const MAX_PHOTOS = 3;
const MAX_SIZE = 6 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

export default function DetailsStep({
  isAuthenticated,
  user,
  phone,
  notes,
  photos,
  onPhoneChange,
  onNotesChange,
  onPhotoUploaded,
  onPhotoRemoved,
  onSignIn,
  uploadBookingId,
  onBookingIdAvailable,
}: DetailsStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isUploading = useRef(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || isUploading.current) return;

    for (const file of Array.from(files)) {
      if (photos.length >= MAX_PHOTOS) break;

      if (!ALLOWED_TYPES.includes(file.type)) {
        alert(`${file.name}: only JPG, PNG, WEBP, and HEIC are allowed.`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        alert(`${file.name}: images must be 6 MB or smaller.`);
        continue;
      }

      isUploading.current = true;
      try {
        const formData = new FormData();
        formData.append('file', file);

        // If we have a bookingId, use it. Otherwise pass the booking intent
        // so the API can create a booking on the fly.
        if (uploadBookingId) {
          formData.append('bookingId', uploadBookingId);
        } else {
          // Pass the current booking intent so the API can create a booking
          // and attach the reference to it.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const w = window as any;
          const services = w.__bookingServices || '';
          const addons = w.__bookingAddons || '';
          const date = w.__bookingDate || '';
          const startTime = w.__bookingStartTime || '';
          const endTime = w.__bookingEndTime || '';
          const phone = w.__bookingPhone || '';
          const notes = w.__bookingNotes || '';

          if (services && date && startTime && endTime && phone) {
            formData.append('serviceIds', services);
            formData.append('addonIds', addons);
            formData.append('date', date);
            formData.append('startTime', startTime);
            formData.append('endTime', endTime);
            formData.append('phone', phone);
            if (notes) formData.append('notes', notes);
          } else {
            alert('Please complete the booking details before adding reference photos.');
            isUploading.current = false;
            return;
          }
        }

        const res = await fetch('/api/uploads/reference', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          onPhotoUploaded({ id: data.image.id, filename: data.image.originalFilename });
          // Store the bookingId for subsequent uploads in this session
          if (data.bookingId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).__bookingId = data.bookingId;
          }
        } else {
          alert(data.error || 'Upload failed.');
        }
      } finally {
        isUploading.current = false;
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const inputClass =
    'w-full px-4 py-3 border border-line dark:border-line-dark rounded-lg bg-white dark:bg-surface-dark text-ink dark:text-ink-dark focus:outline-none focus:ring-2 focus:ring-burgundy';

  return (
    <div className="space-y-6">
      {/* Auth interrupt */}
      {!isAuthenticated && (
        <div className="bg-burgundy/5 dark:bg-burgundy/10 border border-burgundy/20 rounded-xl p-5">
          <p className="font-medium text-ink dark:text-ink-dark">Sign in to complete your booking</p>
          <p className="text-sm text-ink-secondary dark:text-ink-dark-secondary mt-1">
            We&apos;ll keep everything you&apos;ve selected — it&apos;ll be right here when you return.
          </p>
          <button
            type="button"
            onClick={onSignIn}
            className="mt-3 px-5 py-2.5 bg-burgundy text-white rounded-lg font-medium hover:bg-burgundy-hover transition-colors"
          >
            Sign In / Sign Up
          </button>
        </div>
      )}

      {isAuthenticated && user && (
        <p className="text-sm text-ink-secondary dark:text-ink-dark-secondary">
          Booking as <span className="font-medium text-ink dark:text-ink-dark">{user.name}</span> ({user.email})
        </p>
      )}

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-ink dark:text-ink-dark mb-1.5">
          Phone number <span className="text-burgundy">*</span>
        </label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="+234 xxx xxxx xxxx"
          autoComplete="tel"
          className={inputClass}
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-ink dark:text-ink-dark mb-1.5">
          Anything we should know? <span className="text-ink-secondary dark:text-ink-dark-secondary font-normal">(optional)</span>
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Reference photos */}
      <div>
        <p className="text-sm font-medium text-ink dark:text-ink-dark mb-1.5">
          Reference photos <span className="text-ink-secondary dark:text-ink-dark-secondary font-normal">(optional)</span>
        </p>

        {uploadBookingId ? (
          <>
            <div className="flex gap-3">
              {photos.map((photo) => (
                <div key={photo.id} className="relative w-20 h-20 rounded-xl bg-surface-inset dark:bg-surface-inset-dark border border-line dark:border-line-dark flex items-center justify-center">
                  <Camera className="w-6 h-6 text-burgundy dark:text-burgundy-lifted" />
                  <button
                    type="button"
                    aria-label={`Remove ${photo.filename}`}
                    onClick={() => onPhotoRemoved(photo.id)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-ink dark:bg-ink-dark text-white rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Add reference photo"
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-line dark:border-line-dark hover:border-burgundy hover:text-burgundy dark:hover:text-burgundy-lifted text-ink-secondary dark:text-ink-dark-secondary flex items-center justify-center transition-colors"
                >
                  <Camera className="w-6 h-6" />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <p className="text-xs text-ink-secondary dark:text-ink-dark-secondary mt-2">
              Up to {MAX_PHOTOS} images, 6 MB each (JPG, PNG, WEBP, HEIC). Photos are private and
              automatically removed after 30 days.
            </p>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-3">
              {photos.map((photo) => (
                <div key={photo.id} className="relative w-20 h-20 rounded-xl bg-surface-inset dark:bg-surface-inset-dark border border-line dark:border-line-dark flex items-center justify-center">
                  <Camera className="w-6 h-6 text-burgundy dark:text-burgundy-lifted" />
                  <button
                    type="button"
                    aria-label={`Remove ${photo.filename}`}
                    onClick={() => onPhotoRemoved(photo.id)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-ink dark:bg-ink-dark text-white rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Add reference photo"
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-line dark:border-line-dark hover:border-burgundy hover:text-burgundy dark:hover:text-burgundy-lifted text-ink-secondary dark:text-ink-dark-secondary flex items-center justify-center transition-colors"
                >
                  <Camera className="w-6 h-6" />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <p className="text-xs text-ink-secondary dark:text-ink-dark-secondary">
              Up to {MAX_PHOTOS} images, 6 MB each (JPG, PNG, WEBP, HEIC). Photos are private and
              automatically removed after 30 days.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
