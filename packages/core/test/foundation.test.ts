import { describe, expect, it } from "vitest";
import { describeFoundation } from "../src/index";

describe("foundation", () => {
  it("keeps site and editor on one shared Core layer", () => {
    const ids = describeFoundation().layers.map((layer) => layer.id);

    expect(ids).toEqual(["site", "editor", "core"]);
  });
});
