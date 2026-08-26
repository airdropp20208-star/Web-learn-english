import { describe, it, expect, beforeEach, vi } from "vitest";

type ActiveUserModule = typeof import("@/lib/active-user");

/**
 * Module giữ `activeUserId` ở cấp module, nên mỗi test phải nạp lại để không
 * rò trạng thái sang test sau.
 */
async function fresh(): Promise<ActiveUserModule> {
  vi.resetModules();
  localStorage.clear();
  return import("@/lib/active-user");
}

describe("phân vùng khoá theo người dùng", () => {
  beforeEach(() => localStorage.clear());

  it("mặc định là khách", async () => {
    const m = await fresh();
    expect(m.getActiveUserId()).toBe("local-user");
    expect(m.scopedKey("kho")).toBe("kho:local-user");
  });

  it("đổi người dùng thì đổi khoá và báo cho người nghe", async () => {
    const m = await fresh();
    const listener = vi.fn();
    m.subscribeActiveUser(listener);

    m.setActiveUserId("user-1");
    expect(m.scopedKey("kho")).toBe("kho:user-1");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("đặt lại đúng id đang dùng thì không báo gì — tránh nạp lại thừa", async () => {
    const m = await fresh();
    const listener = vi.fn();
    m.subscribeActiveUser(listener);

    m.setActiveUserId("local-user");
    expect(listener).not.toHaveBeenCalled();
  });

  it("huỷ đăng ký thì không nhận thông báo nữa", async () => {
    const m = await fresh();
    const listener = vi.fn();
    const unsub = m.subscribeActiveUser(listener);
    unsub();

    m.setActiveUserId("user-1");
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("readWithLegacyFallback", () => {
  beforeEach(() => localStorage.clear());

  it("khách nhận lại dữ liệu cũ ở khoá không phân vùng, và dữ liệu được dời sang khoá mới", async () => {
    const m = await fresh();
    localStorage.setItem("kho-cu", "gia-tri");

    expect(m.readWithLegacyFallback("kho", "kho-cu")).toBe("gia-tri");
    expect(localStorage.getItem("kho:local-user")).toBe("gia-tri");
    expect(localStorage.getItem("kho-cu")).toBeNull();
  });

  it("tài khoản đã đăng nhập KHÔNG được nhận dữ liệu cũ của khách", async () => {
    const m = await fresh();
    localStorage.setItem("kho-cu", "cua-khach");
    m.setActiveUserId("user-1");

    expect(m.readWithLegacyFallback("kho", "kho-cu")).toBeNull();
    // Và dữ liệu khách phải còn nguyên chỗ cũ, không bị chiếm mất.
    expect(localStorage.getItem("kho-cu")).toBe("cua-khach");
  });

  it("khoá đã phân vùng được ưu tiên hơn khoá cũ", async () => {
    const m = await fresh();
    localStorage.setItem("kho-cu", "cu");
    localStorage.setItem("kho:local-user", "moi");

    expect(m.readWithLegacyFallback("kho", "kho-cu")).toBe("moi");
  });
});

describe("readScopedFor / clearScopedFor", () => {
  beforeEach(() => localStorage.clear());

  it("đọc được kho của người khác mà không cần đổi người đang hoạt động", async () => {
    const m = await fresh();
    localStorage.setItem("kho:local-user", "cua-khach");
    m.setActiveUserId("user-1");

    expect(m.readScopedFor("kho", "local-user")).toBe("cua-khach");
    expect(m.getActiveUserId()).toBe("user-1");
  });

  it("xoá đúng kho được chỉ định, không đụng kho khác", async () => {
    const m = await fresh();
    localStorage.setItem("kho:local-user", "a");
    localStorage.setItem("kho:user-1", "b");

    m.clearScopedFor("kho", "local-user");
    expect(localStorage.getItem("kho:local-user")).toBeNull();
    expect(localStorage.getItem("kho:user-1")).toBe("b");
  });
});
