'use client';

import SlotUploader from './SlotUploader';
import GalleryManager from './GalleryManager';

export interface HomeMediaRow {
  slot: string;
  publicUrl: string;
  altText: string | null;
  width: number | null;
  height: number | null;
  updatedAt: string | Date;
}

export interface GalleryRow {
  id: string;
  publicUrl: string;
  caption: string | null;
  altText: string | null;
  displayOrder: number;
  width: number | null;
  height: number | null;
}

export default function HomepageMediaManager({
  initialHero,
  initialEditorial,
  initialGallery,
}: {
  initialHero: HomeMediaRow | null;
  initialEditorial: HomeMediaRow | null;
  initialGallery: GalleryRow[];
}) {
  return (
    <div className="space-y-6">
      <SlotUploader
        slot="hero"
        label="Hero image"
        hint="The tall portrait in the hero section. Portrait orientation works best (4:5)."
        initial={initialHero}
      />
      <SlotUploader
        slot="editorial"
        label="Editorial image"
        hint="The portrait beside the brand statement. Portrait orientation works best (3:4)."
        initial={initialEditorial}
      />
      <GalleryManager initialImages={initialGallery} />
    </div>
  );
}
