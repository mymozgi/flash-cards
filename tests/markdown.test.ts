import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/lib/markdown";

/**
 * Рендерер вставляет результат через dangerouslySetInnerHTML, поэтому
 * экранирование здесь — вопрос безопасности, а не оформления. Тексты
 * приходят в том числе из чужих CSV на импорте.
 */
describe("renderMarkdown — безопасность", () => {
  it("экранирует теги, а не вставляет их", () => {
    const html = renderMarkdown("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("оставляет обработчики безобидным текстом, а не атрибутом", () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)">');
    // Само слово onerror в выводе есть — важно, что тега нет и кавычки экранированы,
    // поэтому браузеру нечего исполнять
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&quot;");
    expect(html.match(/<[a-z]+/g)).toEqual(["<p"]);
  });

  it("пропускает только http и https в ссылках", () => {
    expect(renderMarkdown("[ok](https://example.com)")).toContain('href="https://example.com"');
    expect(renderMarkdown("[bad](javascript:alert(1))")).not.toContain("href=");
    expect(renderMarkdown("[bad](data:text/html;base64,PHN2Zz4=)")).not.toContain("href=");
  });

  it("не превращает разметку внутри кода в теги", () => {
    const html = renderMarkdown("`<b>literal</b>`");
    expect(html).toContain("<code>");
    expect(html).not.toContain("<b>literal</b>");
  });
});

describe("renderMarkdown — разметка", () => {
  it("делает абзацы и переносы", () => {
    const html = renderMarkdown("first\nsecond\n\nthird");
    expect(html).toBe("<p>first<br />second</p><p>third</p>");
  });

  it("собирает маркированный список", () => {
    expect(renderMarkdown("- a\n- b")).toBe("<ul><li>a</li><li>b</li></ul>");
  });

  it("собирает нумерованный список", () => {
    expect(renderMarkdown("1. a\n2. b")).toBe("<ol><li>a</li><li>b</li></ol>");
  });

  it("понимает жирный и курсив", () => {
    expect(renderMarkdown("**bold**")).toContain("<strong>bold</strong>");
    expect(renderMarkdown("_italic_")).toContain("<em>italic</em>");
  });

  it("не путает подстановку кода с обычными цифрами в тексте", () => {
    // Внутренний плейсхолдер кода не должен схлопываться с текстом вида « 1 »
    const html = renderMarkdown("step 1 and `code` and 2 more");
    expect(html).toContain("step 1 and");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain("2 more");
  });

  it("возвращает пустую строку на пустом вводе", () => {
    expect(renderMarkdown("")).toBe("");
    expect(renderMarkdown("\n\n")).toBe("");
  });
});
