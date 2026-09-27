import React from "react";

type IconName = "dice" | "sun" | "moon" | "arrow" | "close" | "check" | "trophy" | "refresh";
const paths: Record<Exclude<IconName, "dice">, React.ReactNode> = {
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
  moon: <path d="M20 14a8.5 8.5 0 0 1-10-10A8.5 8.5 0 1 0 20 14Z" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  trophy: <><path d="M8 3h8v7a4 4 0 0 1-8 0V3Zm4 11v6m-4 1h8M8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1" /></>,
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "dice" ? <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="8" cy="8" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="16" cy="16" r="1" fill="currentColor" /></> : paths[name]}
  </svg>;
}
