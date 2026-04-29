"use client";

import ReactPlayer from "react-player";

export default function VideoPlayer({ src, aspectRatio = "16 / 9" }: any) {
  return (
    <div className="relative w-full overflow-hidden rounded-[20px]" style={{ aspectRatio }}>
      <ReactPlayer
        src={src}
        controls
        width="100%"
        height="100%"
        style={{ position: "absolute", top: 0, left: 0 }}
      />
    </div>
  );
}
