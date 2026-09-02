import { describe, expect, it } from "vitest";
import { hostLabel, safeUrl } from "@/lib/url";

describe("разбор ссылки", () => {
  it("пропускает http и https", () => {
    expect(safeUrl("https://example.com/page")).toBe("https://example.com/page");
    expect(safeUrl("http://example.com/")).toBe("http://example.com/");
  });

  it("дописывает схему, когда её не написали", () => {
    // человек чаще пишет «example.com», чем «https://example.com»
    expect(safeUrl("example.com/a")).toBe("https://example.com/a");
  });

  it("отказывает javascript: — это исполнение кода, а не ссылка", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("  JavaScript:alert(1)  ")).toBeNull();
  });

  it("отказывает остальным схемам, которых нет в списке разрешённых", () => {
    expect(safeUrl("data:text/html,<script>x</script>")).toBeNull();
    expect(safeUrl("vbscript:msgbox(1)")).toBeNull();
    expect(safeUrl("file:///etc/passwd")).toBeNull();
  });

  it("пустое поле — это норма, а не ошибка", () => {
    expect(safeUrl("")).toBeNull();
    expect(safeUrl("   ")).toBeNull();
    expect(safeUrl(null)).toBeNull();
    expect(safeUrl(undefined)).toBeNull();
  });

  it("мусор ссылкой не становится", () => {
    expect(safeUrl("://")).toBeNull();
  });
});

describe("подпись ссылки", () => {
  it("показывает домен без www", () => {
    expect(hostLabel("https://www.goodreads.com/book/show/11468377")).toBe("goodreads.com");
  });

  it("работает и без написанной схемы", () => {
    expect(hostLabel("example.com/a/b/c?utm=1")).toBe("example.com");
  });

  it("на отказанной ссылке подписи нет", () => {
    expect(hostLabel("javascript:alert(1)")).toBe("");
    expect(hostLabel("")).toBe("");
  });
});
