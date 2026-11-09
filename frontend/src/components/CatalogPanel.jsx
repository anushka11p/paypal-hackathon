import { useEffect, useState } from "react";
import { api, usd } from "../api";

export default function CatalogPanel() {
  const [data, setData] = useState(null);
  useEffect(() => { api.catalog("attack").then(setData).catch(() => {}); }, []);
  if (!data) return null;
  return (
    <details className="step">
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
        The store: {data.merchant.name} ({data.products.length} products, two with simulated poisoned text)
      </summary>
      <p className="muted small">
        Leash's hard rules read only the structured fields (price, category, allergens). The text below is what
        the agent reads, and what an attacker controls.
      </p>
      <div className="products">
        {data.products.map((p) => {
          const attacks = p.reviews.filter((r) => r.simulated_attack).map((r) => r.text);
          if (p.note_is_simulated_attack) attacks.push(p.merchandising_note);
          return (
            <div className="product" key={p.sku}>
              <div className="name">{p.name}</div>
              <div className="meta"><code>{p.sku}</code> · {usd(p.price_cents)} · {p.category.replace("pet_", "")}</div>
              <div className="meta">Contains: {p.allergen_tags.contains?.join(", ") || "—"}</div>
              {attacks.map((t) => (
                <div className="attack-text" key={t}><span className="tag">Simulated attack</span>{t}</div>
              ))}
            </div>
          );
        })}
      </div>
    </details>
  );
}
