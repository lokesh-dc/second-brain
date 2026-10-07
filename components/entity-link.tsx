"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getEntityIdByName } from "@/actions/entities";
import { formatEntityName } from "@/constants/entities";

/**
 * Tappable entity reference for spots that only carry a name
 * (digest topEntity, briefing chip). Resolves the id, then opens
 * the entity explorer page.
 */
export function EntityNameButton({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const open = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await getEntityIdByName(name);
      if (res.ok && res.id) {
        router.push(`/entities/${res.id}`);
      } else {
        toast.error("No linked drops found");
      }
    } catch {
      toast.error("Couldn't open entity");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation();
        void open();
      }}
      className={className}
    >
      {formatEntityName(name)}
    </button>
  );
}
