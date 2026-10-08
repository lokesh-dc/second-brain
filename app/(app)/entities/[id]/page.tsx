import { notFound } from "next/navigation";
import { getEntityDetails } from "@/actions/entities";
import EntityDetailScreen from "@/components/entity-detail-screen";

export const dynamic = "force-dynamic";

export default async function EntityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await getEntityDetails(id);
  if (!res.ok) notFound();

  return (
    <EntityDetailScreen
      entity={res.entity}
      entries={res.entries}
      stats={res.stats}
    />
  );
}
