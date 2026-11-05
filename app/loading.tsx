import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex min-h-dvh items-center justify-center bg-paper"
    >
      <Loader2 size={24} className="animate-spin text-ink-3" />
    </div>
  );
}

