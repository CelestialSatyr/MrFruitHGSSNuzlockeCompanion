import { getHgssPokemonTypes } from "@nuzlocke/hgss";
import type { EventDraftInput } from "./eventBuilder";

export function isSecondaryFlyingCapture(types: readonly string[]): boolean {
  return types[1] === "flying";
}

/**
 * New/edited Flying-eligible captures must make the clause decision explicitly.
 * Historical non-Flying catches are allowed to keep the field absent.
 */
export async function assertEncounterTypingDeclarations(form: EventDraftInput): Promise<void> {
  if (form.type !== "encounter") return;

  for (const [label, side] of [
    ["Player one", form.left],
    ["Player two", form.right],
  ] as const) {
    if (side.result !== "caught") continue;

    const speciesId = Number(side.speciesId);
    if (!Number.isFinite(speciesId) || speciesId <= 0) continue;

    // A non-null value is already an explicit decision. A true declaration is
    // still verified so stale UI state can never mark a non-eligible capture.
    if (side.flyingTypeDeclared === false) continue;

    const types = await getHgssPokemonTypes(speciesId);
    const eligible = isSecondaryFlyingCapture(types);

    if (side.flyingTypeDeclared === true && !eligible) {
      throw new Error(
        `${label}: only a Pokémon caught with Flying as its secondary type can be declared Flying.`,
      );
    }

    if (eligible && side.flyingTypeDeclared === null) {
      throw new Error(
        `${label}: choose whether this Flying capture uses its normal primary typing or declares Flying before saving.`,
      );
    }
  }
}
