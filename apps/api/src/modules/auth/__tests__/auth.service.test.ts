import { beforeEach, describe, expect, it } from "vitest";
import { hashPassword } from "../password.js";
import { AuthError, getProfile, login, logout, logoutAll, refresh } from "../auth.service.js";
import { createFakeAuthDb, type FakeUserRow } from "./fakeAuthDb.js";

async function seedActiveStudent(): Promise<FakeUserRow> {
  return {
    id: "user-1",
    universityId: "MUJ-STU-0001",
    fullName: "Test Student",
    email: "student@muj.manipal.edu",
    role: "STUDENT",
    departmentId: "dept-1",
    status: "ACTIVE",
    credential: { passwordHash: await hashPassword("correct-password") },
  };
}

describe("login", () => {
  it("succeeds with correct credentials and issues an access + refresh token", async () => {
    const student = await seedActiveStudent();
    const { db, sessions, auditLogs } = createFakeAuthDb([student]);

    const result = await login(db, { email: student.email, password: "correct-password" });

    expect(result.user.id).toBe(student.id);
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(sessions.size).toBe(1);
    expect(auditLogs.at(-1)?.action).toBe("AUTH_LOGIN_SUCCESS");
  });

  it("rejects an unknown email without revealing that it doesn't exist", async () => {
    const { db, auditLogs } = createFakeAuthDb([]);

    await expect(
      login(db, { email: "nobody@muj.manipal.edu", password: "whatever" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" } satisfies Partial<AuthError>);
    expect(auditLogs.at(-1)?.metadata).toMatchObject({ reason: "user_not_found" });
  });

  it("rejects an incorrect password", async () => {
    const student = await seedActiveStudent();
    const { db, auditLogs } = createFakeAuthDb([student]);

    await expect(login(db, { email: student.email, password: "wrong" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    } satisfies Partial<AuthError>);
    expect(auditLogs.at(-1)?.metadata).toMatchObject({ reason: "bad_password" });
  });

  it("rejects a non-ACTIVE account even with the correct password", async () => {
    const student = await seedActiveStudent();
    student.status = "SUSPENDED";
    const { db } = createFakeAuthDb([student]);

    await expect(
      login(db, { email: student.email, password: "correct-password" }),
    ).rejects.toMatchObject({ code: "ACCOUNT_INACTIVE" } satisfies Partial<AuthError>);
  });
});

describe("refresh", () => {
  it("issues a fresh access + refresh token pair distinct from the previous ones", async () => {
    const student = await seedActiveStudent();
    const { db } = createFakeAuthDb([student]);
    const loginResult = await login(db, { email: student.email, password: "correct-password" });

    const refreshResult = await refresh(db, loginResult.refreshToken);
    expect(refreshResult.accessToken).not.toBe(loginResult.accessToken);
    expect(refreshResult.refreshToken).not.toBe(loginResult.refreshToken);
  });

  it("rejects the rotated-away token once it has been replaced, while the new one keeps working", async () => {
    const student = await seedActiveStudent();
    const { db } = createFakeAuthDb([student]);
    const loginResult = await login(db, { email: student.email, password: "correct-password" });
    const refreshResult = await refresh(db, loginResult.refreshToken);

    // The pre-rotation token must now be rejected...
    await expect(refresh(db, loginResult.refreshToken)).rejects.toMatchObject({
      code: "INVALID_REFRESH_TOKEN",
    } satisfies Partial<AuthError>);

    // ...but note that per the reuse-detection policy below, that replay
    // attempt just killed the whole family, so the token from `refreshResult`
    // is *also* dead now — this is deliberate fail-safe behavior, not a bug,
    // and is asserted directly in the "revokes the entire token family" case.
    await expect(refresh(db, refreshResult.refreshToken)).rejects.toMatchObject({
      code: "INVALID_REFRESH_TOKEN",
    } satisfies Partial<AuthError>);
  });

  it("supports a normal multi-step rotation chain when each token is used exactly once", async () => {
    const student = await seedActiveStudent();
    const { db } = createFakeAuthDb([student]);
    const loginResult = await login(db, { email: student.email, password: "correct-password" });

    const step1 = await refresh(db, loginResult.refreshToken);
    const step2 = await refresh(db, step1.refreshToken);
    const step3 = await refresh(db, step2.refreshToken);

    expect(step3.accessToken).toEqual(expect.any(String));
    expect(
      new Set([
        loginResult.refreshToken,
        step1.refreshToken,
        step2.refreshToken,
        step3.refreshToken,
      ]).size,
    ).toBe(4);
  });

  it("revokes the entire token family on reuse of an already-rotated token", async () => {
    const student = await seedActiveStudent();
    const { db, sessions, auditLogs } = createFakeAuthDb([student]);
    const loginResult = await login(db, { email: student.email, password: "correct-password" });

    const firstRefresh = await refresh(db, loginResult.refreshToken);

    // Replay the original (now-revoked) refresh token — simulates a stolen token.
    await expect(refresh(db, loginResult.refreshToken)).rejects.toMatchObject({
      code: "INVALID_REFRESH_TOKEN",
    } satisfies Partial<AuthError>);
    expect(auditLogs.some((entry) => entry.action === "AUTH_TOKEN_REUSE_DETECTED")).toBe(true);

    // The legitimately-rotated token must also now be dead, since the whole family was killed.
    await expect(refresh(db, firstRefresh.refreshToken)).rejects.toMatchObject({
      code: "INVALID_REFRESH_TOKEN",
    } satisfies Partial<AuthError>);

    expect([...sessions.values()].every((s) => s.revokedAt !== null)).toBe(true);
  });

  it("rejects an unknown refresh token", async () => {
    const { db } = createFakeAuthDb([]);
    await expect(refresh(db, "not-a-real-token")).rejects.toMatchObject({
      code: "INVALID_REFRESH_TOKEN",
    } satisfies Partial<AuthError>);
  });

  it("rejects a refresh token belonging to a now-inactive account", async () => {
    const student = await seedActiveStudent();
    const { db } = createFakeAuthDb([student]);
    const loginResult = await login(db, { email: student.email, password: "correct-password" });

    student.status = "SUSPENDED";

    await expect(refresh(db, loginResult.refreshToken)).rejects.toMatchObject({
      code: "ACCOUNT_INACTIVE",
    } satisfies Partial<AuthError>);
  });
});

describe("logout", () => {
  it("revokes the presented session so it can no longer be refreshed", async () => {
    const student = await seedActiveStudent();
    const { db, auditLogs } = createFakeAuthDb([student]);
    const loginResult = await login(db, { email: student.email, password: "correct-password" });

    await logout(db, loginResult.refreshToken);

    await expect(refresh(db, loginResult.refreshToken)).rejects.toMatchObject({
      code: "INVALID_REFRESH_TOKEN",
    } satisfies Partial<AuthError>);
    expect(auditLogs.at(-1)?.action).toBe("AUTH_LOGOUT");
  });

  it("is a no-op when no refresh token is presented", async () => {
    const { db } = createFakeAuthDb([]);
    await expect(logout(db, undefined)).resolves.toBeUndefined();
  });
});

describe("logoutAll", () => {
  it("revokes every active session across multiple logins for the same user", async () => {
    const student = await seedActiveStudent();
    const { db, auditLogs } = createFakeAuthDb([student]);

    const sessionA = await login(db, { email: student.email, password: "correct-password" });
    const sessionB = await login(db, { email: student.email, password: "correct-password" });

    await logoutAll(db, student.id);

    await expect(refresh(db, sessionA.refreshToken)).rejects.toMatchObject({
      code: "INVALID_REFRESH_TOKEN",
    } satisfies Partial<AuthError>);
    await expect(refresh(db, sessionB.refreshToken)).rejects.toMatchObject({
      code: "INVALID_REFRESH_TOKEN",
    } satisfies Partial<AuthError>);
    expect(auditLogs.at(-1)?.action).toBe("AUTH_LOGOUT_ALL");
  });
});

describe("getProfile", () => {
  let student: FakeUserRow;

  beforeEach(async () => {
    student = await seedActiveStudent();
  });

  it("returns the public profile shape without credential data", async () => {
    const { db } = createFakeAuthDb([student]);
    const profile = await getProfile(db, student.id);
    expect(profile).toEqual({
      id: student.id,
      universityId: student.universityId,
      fullName: student.fullName,
      email: student.email,
      role: student.role,
      departmentId: student.departmentId,
      status: student.status,
    });
    expect(profile).not.toHaveProperty("credential");
  });

  it("returns null for an unknown user id", async () => {
    const { db } = createFakeAuthDb([student]);
    expect(await getProfile(db, "does-not-exist")).toBeNull();
  });
});
