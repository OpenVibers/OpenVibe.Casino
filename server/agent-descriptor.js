'use strict';
// What OpenVibe.Casino tells an agent about itself (openvibe-shared/agent-layer): /.well-known/agent.json (SEO-2).
// Every field is something this site really serves; the purpose is its own llms.txt summary.
module.exports = {
    id: "casino",
    name: "OpenVibe.Casino",
    purpose: "Learn casino games, play them with chips worth nothing, and see exactly what each bet costs: open engines, exact house edges, simulations in the browser. Never real money.",
    home: "https://openvibe.casino",
    site: "openvibe.casino",
    api: "/api/v1",
    docs: "/developers",
    openapi: '/openapi.json',
    policy: {
        auth: ["none", "Network OIDC"],
    },
};
