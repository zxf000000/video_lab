"use client";

import { API_BASE, type CharacterAsset } from "@/src/api";
import { StatusPill } from "@/src/components/project/project-ui";
import { Button } from "@/src/components/ui/button";
import ImagePreview from "@/src/components/project/ImagePreview";

export interface CharacterCardProps {
  character: CharacterAsset;
  onEdit: (c: CharacterAsset) => void;
  onDelete: (c: CharacterAsset) => void;
  onClick: (c: CharacterAsset) => void;
}

export function CharacterCard({
  character,
  onEdit,
  onDelete,
  onClick,
}: CharacterCardProps) {
  const photoUrl = character.photoPath ? `${API_BASE}/assets/${character.photoPath}` : null;
  const sketchUrl = character.imagePath ? `${API_BASE}/assets/${character.imagePath}` : null;
  const hasImages = photoUrl || sketchUrl;

  return (
    <div
      className="rounded-lg border border-line bg-panel2 overflow-hidden cursor-pointer transition hover:border-mint/40 hover:shadow-md"
      onClick={() => onClick(character)}
    >
      <div className="relative h-28 w-full bg-panel flex">
        {hasImages ? (
          <>
            <div className="w-1/2 h-full border-r border-line/30">
              {photoUrl ? (
                <ImagePreview src={photoUrl} alt={`${character.name} 真人参考`} className="w-full h-full">
                  <img
                    src={photoUrl}
                    alt={`${character.name} 真人参考`}
                    className="w-full h-full object-cover transition hover:opacity-85"
                  />
                </ImagePreview>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-[10px] text-gray-600">—</p>
                </div>
              )}
            </div>
            <div className="w-1/2 h-full">
              {sketchUrl ? (
                <ImagePreview src={sketchUrl} alt={character.name} className="w-full h-full">
                  <img
                    src={sketchUrl}
                    alt={character.name}
                    className="w-full h-full object-cover transition hover:opacity-85"
                  />
                </ImagePreview>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-[10px] text-gray-600">—</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-xs text-gray-500">待生成</p>
          </div>
        )}
      </div>
      <div className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-100 truncate">{character.name}</h3>
            <p className="mt-0.5 text-xs text-gray-500">{character.roleType || "未填写角色类型"}</p>
          </div>
          <StatusPill value={character.status} tone="purple" />
        </div>
        <div
          className="mt-3 flex items-center gap-1.5 flex-wrap"
          onClick={(e) => e.stopPropagation()}
        >
          <Button variant="secondary" size="sm" onClick={() => onEdit(character)}>
            编辑
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(character)}>
            删除
          </Button>
        </div>
      </div>
    </div>
  );
}
