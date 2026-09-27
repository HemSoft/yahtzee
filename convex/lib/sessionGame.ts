// Keep the online API on the same rules as the standalone offline edition.
export { newSessionGame as newGuestGame, applySessionMove as applyMove, type Move } from "../../packages/game-engine/src/session";
