import { describe, expect, it, vi } from "vitest";

const {
  revokeRefreshTokensMock,
  deleteUserMock,
  getUserMock,
  getUserByEmailMock,
  batchDeleteMock,
  batchCommitMock,
} = vi.hoisted(() => ({
  revokeRefreshTokensMock: vi.fn().mockResolvedValue(undefined),
  deleteUserMock: vi.fn().mockResolvedValue(undefined),
  getUserMock: vi.fn().mockResolvedValue({ uid: "doc_uid_1", email: "vendeur@test.com" }),
  getUserByEmailMock: vi.fn().mockResolvedValue({ uid: "orphan_auth_uid_2", email: "vendeur@test.com" }),
  batchDeleteMock: vi.fn(),
  batchCommitMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/firebase-admin", () => {
  const emptySnap = {
    forEach: () => {},
    docs: [],
  };
  const makeQuery = () => ({
    where: () => makeQuery(),
    select: () => makeQuery(),
    limit: () => makeQuery(),
    get: vi.fn().mockResolvedValue(emptySnap),
  });
  return {
    adminAuth: {
      revokeRefreshTokens: revokeRefreshTokensMock,
      deleteUser: deleteUserMock,
      getUser: getUserMock,
      getUserByEmail: getUserByEmailMock,
    },
    adminDb: {
      collection: (name: string) => ({
        doc: (id: string) => ({
          path: `${name}/${id}`,
          get: vi.fn().mockResolvedValue({
            exists: name === "users",
            data: () => ({ email: "vendeur@test.com" }),
          }),
        }),
        where: () => makeQuery(),
      }),
      batch: () => ({
        delete: batchDeleteMock,
        commit: batchCommitMock,
      }),
    },
  };
});

import { purgeUserAccountCompletely } from "@/lib/purgeUserAccount";

describe("purgeUserAccountCompletely", () => {
  it("deletes Firebase Auth user by BOTH uid and email so email is immediately reusable", async () => {
    const result = await purgeUserAccountCompletely("doc_uid_1", {
      email: "vendeur@test.com",
    });

    expect(result.authDeleted).toBe(true);
    expect(revokeRefreshTokensMock).toHaveBeenCalledWith("doc_uid_1");
    expect(deleteUserMock).toHaveBeenCalledWith("doc_uid_1");
    expect(getUserByEmailMock).toHaveBeenCalledWith("vendeur@test.com");
    expect(revokeRefreshTokensMock).toHaveBeenCalledWith("orphan_auth_uid_2");
    expect(deleteUserMock).toHaveBeenCalledWith("orphan_auth_uid_2");
    expect(batchCommitMock).toHaveBeenCalled();
  });
});
