"use client";

import { useState } from "react";
import { getApiBase } from "../api";
import { ImageViewer } from "./ui-legacy";
import VideoPlayer from "./VideoPlayer";

export default function AssetCard({ label, url, kind }: { label: string; url: string; kind: "image" | "video" }) {
  const absoluteUrl = url ? `${getApiBase()}${url}` : null;
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-line bg-panel px-4 py-4">
      <p className="mb-3 text-sm font-medium text-gray-300">{label}</p>
      {!absoluteUrl ? (
        <div className="rounded-[20px] border border-dashed border-line bg-panel2 px-4 py-10 text-center text-sm text-gray-500">
          尚未生成
        </div>
      ) : kind === "image" ? (
        <>
          <img
            className="h-44 w-full cursor-zoom-in rounded-[20px] object-cover transition hover:opacity-85"
            src={absoluteUrl}
            alt={label}
            onClick={() => setOpen(true)}
          />
          {open ? <ImageViewer src={absoluteUrl} alt={label} onClose={() => setOpen(false)} /> : null}
        </>
      ) : (
        <VideoPlayer src={absoluteUrl} />
      )}
    </div>
  );
}
