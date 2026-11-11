import { useEffect, useMemo, useState } from "react";
import { api, titleCase, usd } from "../api";
import PerspectiveTunnelHero from "@/components/ui/perspective-tunnel-hero";

/** The store as the agent sees it: every listing flies past; the two carrying injected text are flagged. */
export default function AgentReads() {
  const [catalog, setCatalog] = useState(null);
  useEffect(() => { api.catalog("attack").then(setCatalog).catch(() => {}); }, []);

  const items = useMemo(() => (catalog?.products || []).map((p) => {
    const attack = p.reviews.find((r) => r.simulated_attack)?.text || (p.note_is_simulated_attack ? p.merchandising_note : null);
    const review = p.reviews.find((r) => !r.simulated_attack)?.text;
    return {
      title: p.name,
      meta: usd(p.price_cents),
      subtitle: `${titleCase(p.category)}, contains ${p.allergen_tags.contains?.join(", ") || "nothing listed"}`,
      body: attack || review || p.description,
      flagged: Boolean(attack),
      flagLabel: "Simulated hidden instruction",
    };
  }), [catalog]);

  // Hold the space while the catalog loads so the page does not jump.
  if (!items.length) return <div className="-mt-14 h-[100svh]" aria-hidden="true" />;
  return (
    <PerspectiveTunnelHero
      items={[...items, ...items.slice(0, 2)]}
      eyebrow="What your agent reads"
      title={<>Every listing<br />can talk back.</>}
      hint="Your agent reads all of this before it shops. Two listings carry text written to hijack it. Scroll to fly through the store."
      prompt="Scroll"
      length={2.6}
      startAt={0.14}
      className="-mt-14"
    />
  );
}
