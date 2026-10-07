import { describe, expect, it } from "vitest";
import { identity } from "../src/identity.js";

describe("identity", () => {
  it("returns the supplied value", () => {
    expect(identity("hibiki")).toBe("hibiki");
  });
});
