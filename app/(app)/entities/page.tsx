import { getEntities } from "@/actions/entities";
import EntityIndexScreen from "@/components/entity-index-screen";

export const dynamic = "force-dynamic";

export default async function EntitiesPage() {
  const entities = await getEntities();
  return <EntityIndexScreen entities={entities} />;
}
