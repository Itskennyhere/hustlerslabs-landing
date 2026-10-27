"use client";

import { useState } from "react";

/** Remote photo with an initials fallback if it is missing or fails to load. */
export default function Avatar({ src, fallback, size = 56 }: { src: string | null; fallback: string; size?: number }) {
  const [failed, setFailed] = useState<string | null>(null);
  const show = src && failed !== src;
  return (
    <div className="avatar" style={{ width: size, height: size }}>
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setFailed(src)} />
      ) : (
        <span className="mono">{fallback}</span>
      )}
    </div>
  );
}
