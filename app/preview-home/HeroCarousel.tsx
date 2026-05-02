"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export interface HeroSlide {
  eyebrow: string;
  title: string;
  emphasis: string;
  byline: string;
  cta_label: string;
  cta_href: string;
  /** Background image URL. When null, a striped placeholder shows. */
  image_url: string | null;
  /** Desktop focal point (21:9 crop). */
  focal_point?: string;
  /** Desktop zoom factor. */
  zoom?: number;
  /** Mobile focal point (4:5 crop). Falls back to focal_point. */
  mobile_focal_point?: string;
  /** Mobile zoom factor. Falls back to zoom. */
  mobile_zoom?: number;
}

interface Props {
  slides: HeroSlide[];
  /** Seconds between auto-advances. */
  intervalSec?: number;
}

export function HeroCarousel({ slides, intervalSec = 7 }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % slides.length);
    }, intervalSec * 1000);
    return () => clearInterval(t);
  }, [slides.length, intervalSec]);

  if (slides.length === 0) return null;
  const slide = slides[idx];

  return (
    <section className="relative w-full bg-[color:var(--navy-ink)] overflow-hidden">
      {/* Background photo (or placeholder) */}
      <div className="relative w-full aspect-[4/5] sm:aspect-[21/9]">
        {slides.map((s, i) => (
          <div
            key={i}
            aria-hidden={i !== idx}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === idx ? "opacity-100" : "opacity-0"
            }`}
          >
            {s.image_url ? (
              <>
                {/* Desktop variant */}
                <Image
                  src={s.image_url}
                  alt=""
                  fill
                  priority={i === 0}
                  sizes="100vw"
                  className={`hidden sm:block ${(s.zoom ?? 1) < 1 ? "object-contain" : "object-cover"}`}
                  style={{
                    objectPosition: s.focal_point ?? "center",
                    transform: (s.zoom ?? 1) !== 1 ? `scale(${s.zoom})` : undefined,
                    transformOrigin: s.focal_point ?? "center",
                  }}
                />
                {/* Mobile variant — separate calibration for the 4:5 crop */}
                <Image
                  src={s.image_url}
                  alt=""
                  fill
                  priority={i === 0}
                  sizes="100vw"
                  className={`block sm:hidden ${(s.mobile_zoom ?? s.zoom ?? 1) < 1 ? "object-contain" : "object-cover"}`}
                  style={{
                    objectPosition: s.mobile_focal_point ?? s.focal_point ?? "center",
                    transform: (s.mobile_zoom ?? s.zoom ?? 1) !== 1 ? `scale(${s.mobile_zoom ?? s.zoom})` : undefined,
                    transformOrigin: s.mobile_focal_point ?? s.focal_point ?? "center",
                  }}
                />
              </>
            ) : (
              <div
                className="w-full h-full bg-[color:var(--navy-deep)]"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(135deg, transparent 0 14px, rgba(255,255,255,.04) 14px 28px)",
                }}
              />
            )}
          </div>
        ))}

        {/* Bottom gradient + content */}
        <div
          className="absolute inset-0 flex items-end px-6 pb-20 sm:px-16 sm:pb-[72px]"
          style={{
            background:
              "linear-gradient(180deg, rgba(11,37,69,.15) 0%, rgba(11,37,69,0) 35%, rgba(11,37,69,.85) 85%, rgba(11,37,69,.95) 100%)",
          }}
        >
          <div className="max-w-[760px]">
            <div className="text-[11px] font-bold tracking-[.28em] uppercase text-white/80">
              {slide.eyebrow}
            </div>
            <h1 className="mt-3.5 text-white font-serif font-semibold leading-[1.04] tracking-[-0.01em] text-balance text-[34px] sm:text-[64px]">
              {slide.title}{" "}
              <em
                className="italic font-semibold underline decoration-white/70 underline-offset-[8px] decoration-[3px]"
              >
                {slide.emphasis}
              </em>
            </h1>
            <div className="mt-4 text-white/80 text-[14px] sm:text-base leading-[1.5] max-w-[540px]">
              {slide.byline}
            </div>
          </div>
        </div>

        {/* Slide dots */}
        {slides.length > 1 && (
          <div className="absolute bottom-5 right-5 sm:bottom-7 sm:right-8 flex gap-2 items-center">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => setIdx(i)}
                className={`h-[7px] rounded-full transition-all ${
                  i === idx ? "w-[22px] bg-white" : "w-[7px] bg-white/40 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        )}

        {/* "See more photos →" link, top-right desktop only */}
        {slide.cta_href && (
          <a
            href={slide.cta_href}
            className="hidden sm:inline-block absolute top-7 right-8 text-[11px] font-bold tracking-[.22em] uppercase text-white/80 hover:text-white border-b border-white/50 hover:border-white pb-1"
          >
            {slide.cta_label}
          </a>
        )}
      </div>
    </section>
  );
}
