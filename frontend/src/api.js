const BASE_URL = "";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(typeof body.detail === "string" ? body.detail : `Request failed (${res.status})`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

const post = (path, data) => request(path, { method: "POST", body: data ? JSON.stringify(data) : undefined });

export const api = {
  health: () => request("/health"),
  catalog: (scenario) => request(`/catalog?scenario=${scenario}`),
  compile: (text) => post("/mandates/compile", { text }),
  createMandate: (text, policy) => post("/mandates", { text, policy }),
  mandate: (id) => request(`/mandates/${id}`),
  carts: (id) => request(`/mandates/${id}/carts`),
  shop: (id, task, scenario) => post(`/mandates/${id}/shop`, { task, scenario }),
  revoke: (id) => post(`/mandates/${id}/revoke`),
  audit: (id) => request(id ? `/audit/${id}` : "/audit"),
  verifyChain: () => request("/audit/verify"),
  attemptAgentHack: async () => {
    const res = await fetch(`${BASE_URL}/demo/attempt-agent-hack`, { method: "POST" });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  },
  isolationProof: () => request("/demo/isolation-proof"),
};

export const usd = (cents) =>
  cents == null ? "—" : (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
