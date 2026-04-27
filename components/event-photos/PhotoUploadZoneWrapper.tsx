"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhotoUploadZone } from "./PhotoUploadZone";

export function PhotoUploadZoneWrapper({ eventId }: { eventId: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (
    <PhotoUploadZone
      eventId={eventId}
      onUploaded={() => startTransition(() => router.refresh())}
    />
  );
}
