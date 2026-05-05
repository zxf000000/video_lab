"use client";

import { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Video from "yet-another-react-lightbox/plugins/video";

export default function VideoPreview({
  src,
  poster,
  className,
}: {
  src: string;
  poster?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className={`cursor-pointer relative group ${className ?? ""}`}
        onClick={() => setOpen(true)}
      >
        {poster ? (
          <img
            src={poster}
            alt="视频预览"
            className="w-full h-full object-cover rounded-md"
          />
        ) : (
          <div className="w-full h-full bg-black rounded-md flex items-center justify-center" />
        )}
        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition rounded-md">
          <svg
            className="w-8 h-8 text-white/90 drop-shadow-lg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>

      <Lightbox
        open={open}
        close={() => setOpen(false)}
        slides={[{ type: "video", sources: [{ src, type: "video/mp4" }], poster }]}
        plugins={[Video]}
        carousel={{ finite: true }}
        render={{ buttonPrev: () => null, buttonNext: () => null }}
        controller={{ closeOnBackdropClick: true }}
      />
    </>
  );
}
