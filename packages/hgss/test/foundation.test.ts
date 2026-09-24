import { describe, expect, it } from "vitest";
import { HGSS_SCOPE } from "../src/index";

describe("HGSS foundation", () => {
  it("starts scoped to the main game", () => {
    expect(HGSS_SCOPE).toEqual({ mainGameOnly: true, postGameEnabled: false });
  });
});
