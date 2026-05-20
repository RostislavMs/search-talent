import { describe, expect, it } from "vitest";
import { safeJsonLd } from "@/lib/seo";

describe("safeJsonLd", () => {
  it("escapes </script> so it cannot break out of a script tag", () => {
    const evil = "</script><img src=x onerror=alert(1)>";
    const out = safeJsonLd({ title: evil });

    expect(out.includes("</script>")).toBe(false);
    expect(out.includes("<img")).toBe(false);
  });

  it("escapes ampersands to avoid HTML-entity interpretation", () => {
    const out = safeJsonLd({ q: "a & b" });
    expect(out).not.toContain(" & ");
    expect(out).toContain("\\u0026");
  });

  it("escapes line separators U+2028 and U+2029", () => {
    const sep28 = String.fromCharCode(0x2028);
    const sep29 = String.fromCharCode(0x2029);
    const out = safeJsonLd({ a: `x${sep28}y`, b: `x${sep29}y` });

    expect(out.includes(sep28)).toBe(false);
    expect(out.includes(sep29)).toBe(false);
    expect(out).toContain("\\u2028");
    expect(out).toContain("\\u2029");
  });

  it("round-trips through JSON.parse without losing data", () => {
    const value = {
      title: "</script>",
      desc: "tags <b> & < and > and >",
      list: ["a&b", "c<d"],
    };
    expect(JSON.parse(safeJsonLd(value))).toEqual(value);
  });

  it("leaves benign payloads readable", () => {
    expect(safeJsonLd({ a: 1, b: "hello world" })).toBe(
      '{"a":1,"b":"hello world"}',
    );
  });
});
