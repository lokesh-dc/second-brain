"use server";

import { createClient } from "@/lib/supabase/server";
import { getDigest } from "@/lib/ai/digest";
import { Digest, DigestPeriod } from "@/types";

export async function fetchDigest(
  period: DigestPeriod,
  force = false,
): Promise<Digest | null> {
  const sb = await createClient();
  try {
    return await getDigest(sb, period, force);
  } catch (err) {
    console.error("[fetchDigest] failed:", err);
    return null;
  }
}
