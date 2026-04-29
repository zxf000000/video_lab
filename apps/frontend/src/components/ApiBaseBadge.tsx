"use client";

import { useEffect, useState } from "react";
import { getApiBase } from "../api";

export default function ApiBaseBadge({ className = "" }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <span className={className} suppressHydrationWarning>
      {mounted ? getApiBase() : ""}
    </span>
  );
}
