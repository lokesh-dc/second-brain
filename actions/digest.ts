"use server";

import { createClient } from "@/lib/supabase/server";
import { getDigest } from "@/lib/ai/digest";
import { Digest, DigestPeriod } from "@/types";

export type DigestResult = {
  digest: Digest | null;
  /** Set when generation failed — distinct from "no entries yet". */
  error: string | null;
};

export async function fetchDigest(
  period: DigestPeriod,
  force = false,
): Promise<DigestResult> {
  const sb = await createClient();
  try {
    return { digest: await getDigest(sb, period, force), error: null };
  } catch (err) {
    console.error("[fetchDigest] failed:", err);
    return {
      digest: null,
      error: "Couldn't generate insights right now. Check your connection and try again.",
    };
  }
}
