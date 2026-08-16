import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../password.js";

describe("password hashing", () => {
  it("hashes a password to a bcrypt string distinct from the plaintext", async () => {
    const hash = await hashPassword("Correct-Horse-Battery-1");
    expect(hash).not.toBe("Correct-Horse-Battery-1");
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it("verifies the correct password against its own hash", async () => {
    const hash = await hashPassword("Correct-Horse-Battery-1");
    await expect(verifyPassword("Correct-Horse-Battery-1", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("Correct-Horse-Battery-1");
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const [hashA, hashB] = await Promise.all([
      hashPassword("same-password"),
      hashPassword("same-password"),
    ]);
    expect(hashA).not.toBe(hashB);
  });
});
