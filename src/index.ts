/**
 * @staklyapp/contracts — Lingua franca Stakly v3.
 *
 * Source unique de vérité des contrats UI/Hub. Tout pack, tout adapter,
 * tout composant Stakly UI doit IMPORTER ses types ici plutôt que de les
 * redéfinir.
 *
 * Modules :
 *  - `/44c`            — types 44C primitifs + helpers
 *  - `/display-engine` — slots, payloads, ACL multi-héritage
 *  - `/apps`           — 7 univers canon (App Launcher)
 *  - `/tools`          — 5 outils Z3 (Toolbar)
 *  - `/agents`         — AgentSnapshot / AgentDelta CQRS
 *  - `/runtime`        — MSG/INS/EVT/RSP + ROOM Matrix + ACL cascade
 *  - `/documents`      — Pack Base documentaire (PCKDOC) — entities + MCP tools + DLP
 *  - `/agents-instances` — Pack PCKAIE (Instance, Scope, Room, Instruction cascade L0-L3)
 *  - `/aie`            — Container stakly-v3-aie : mTLS, Killswitch, Inference, ACL intersection
 *  - `/marketplace`    — Federation v2 (PackManifest + FederatedPacks list/fetch)
 *  - `/errors`         — StaklyError discriminée
 *
 * @version 0.4.1
 * @see {@link https://github.com/StaklyApp/stakly-contracts}
 */

export * from "./44c/index.js";
export * from "./display-engine/index.js";
export * from "./apps/index.js";
export * from "./tools/index.js";
export * from "./agents/index.js";
export * from "./runtime/index.js";
export * from "./documents/index.js";
export * from "./agents-instances/index.js";
export * from "./aie/index.js";
export * from "./marketplace/index.js";
export * from "./errors/index.js";

/**
 * Version courante du package. Incrémenté à chaque release SemVer.
 */
export const CONTRACTS_VERSION = "0.4.1" as const;
