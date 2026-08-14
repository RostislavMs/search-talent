import { describe, expect, it } from "vitest";
import { renderGithubReadme, resolveReadmeUrl } from "@/lib/github-readme";

const CTX = { fullName: "octo/repo" };

function render(markdown: string): string {
  return renderGithubReadme(markdown, CTX);
}

describe("renderGithubReadme", () => {
  it("returns an empty string for a blank readme", () => {
    expect(render("")).toBe("");
    expect(render("   \n\n  ")).toBe("");
  });

  it("shifts headings two levels down so the card keeps the only <h2>", () => {
    const html = render("# SearchTalent\n\n## Tech Stack\n\n### Setup\n\n#### Notes");

    expect(html).toContain("<h3>SearchTalent</h3>");
    expect(html).toContain("<h4>Tech Stack</h4>");
    expect(html).toContain("<h5>Setup</h5>");
    expect(html).toContain("<h6>Notes</h6>");
  });

  it("renders an underlined (setext) title as a heading", () => {
    expect(render("SearchTalent\n============")).toContain("<h3>SearchTalent</h3>");
  });

  it("renders a pipe table with its alignment", () => {
    const html = render(
      [
        "| Tool | Version | Role |",
        "| --- | :---: | ---: |",
        "| Next.js | 16.2.3 | React framework |",
        "| React | 19.2.3 | UI library |",
      ].join("\n"),
    );

    expect(html).toContain("<table><thead><tr><th>Tool</th>");
    expect(html).toContain('<th align="center">Version</th>');
    expect(html).toContain('<th align="right">Role</th>');
    expect(html).toContain("<td>Next.js</td>");
    // Body cells inherit the column's alignment, the way GitHub renders them.
    expect(html).toContain('<td align="right">UI library</td>');
    // Two body rows, one header row.
    expect(html.match(/<tr>/g)).toHaveLength(3);
  });

  it("pads a short table row so the columns stay aligned", () => {
    const html = render(
      ["| A | B |", "| --- | --- |", "| only |"].join("\n"),
    );

    expect(html).toContain("<tbody><tr><td>only</td><td></td></tr></tbody>");
  });

  it("keeps a fenced code block verbatim and escaped", () => {
    const html = render(
      ["```bash", "pnpm install", 'echo "<script>alert(1)</script>"', "```"].join("\n"),
    );

    expect(html).toContain("<pre><code>pnpm install\n");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("does not read Markdown syntax inside a fenced block", () => {
    const html = render(["```", "# not a heading", "- not a list", "```"].join("\n"));

    expect(html).toContain("# not a heading");
    expect(html).not.toContain("<h3>");
    expect(html).not.toContain("<li>");
  });

  it("renders an indented code block", () => {
    const html = render(["    const a = 1;", "    const b = 2;"].join("\n"));

    expect(html).toBe("<pre><code>const a = 1;\nconst b = 2;</code></pre>");
  });

  it("renders nested and loose lists as a single list each", () => {
    const html = render(
      ["- first", "  - nested", "- second", "", "1. one", "", "2. two"].join("\n"),
    );

    expect(html).toContain("<ul><li>first<ul><li>nested</li></ul></li><li>second</li></ul>");
    // A blank line between items must not restart the numbering with a new <ol>.
    expect(html.match(/<ol>/g)).toHaveLength(1);
    expect(html).toContain("<li>one</li><li>two</li>");
  });

  it("keeps the starting number of a list that does not begin at 1", () => {
    expect(render("3. third\n4. fourth")).toContain('<ol start="3">');
  });

  it("renders task list markers as glyphs, not as brackets", () => {
    const html = render("- [x] done\n- [ ] todo");

    expect(html).toContain("<li>☑ done</li>");
    expect(html).toContain("<li>☐ todo</li>");
    expect(html).not.toContain("[x]");
  });

  it("renders inline marks, strikethrough and code spans", () => {
    const html = render("**bold** and *italic* and ~~gone~~ and `npm i`");

    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<del>gone</del>");
    expect(html).toContain("<code>npm i</code>");
  });

  it("leaves snake_case identifiers alone", () => {
    const html = render("Set SUPABASE_SERVICE_ROLE_KEY in the env file.");

    expect(html).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(html).not.toContain("<em>");
  });

  it("keeps Markdown syntax inside a code span literal", () => {
    const html = render("Use `**not bold**` here");

    expect(html).toContain("<code>**not bold**</code>");
    expect(html).not.toContain("<strong>");
  });

  it("renders a linked badge as an anchor wrapping the image", () => {
    const html = render(
      "[![CI](https://img.shields.io/badge/ci-pass.svg)](https://github.com/octo/repo/actions)",
    );

    expect(html).toContain('href="https://github.com/octo/repo/actions"');
    expect(html).toContain('<img src="https://img.shields.io/badge/ci-pass.svg" alt="CI"');
    expect(html.indexOf("<a")).toBeLessThan(html.indexOf("<img"));
  });

  it("marks every link as external", () => {
    const html = render("[docs](https://example.com/docs)");

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer nofollow"');
  });

  it("autolinks bracketed and bare URLs", () => {
    const html = render("See <https://example.com/a> or https://example.com/b now");

    expect(html).toContain('href="https://example.com/a"');
    expect(html).toContain('href="https://example.com/b"');
  });

  it("renders a GitHub alert with its label instead of the raw marker", () => {
    const html = render("> [!WARNING]\n> Do not run this in production.");

    expect(html).toContain("<blockquote><p><strong>WARNING</strong></p>");
    expect(html).toContain("Do not run this in production.");
    expect(html).not.toContain("[!WARNING]");
  });

  it("renders a blockquote that holds its own blocks", () => {
    const html = render("> ## Quoted\n> - item");

    expect(html).toContain("<blockquote><h4>Quoted</h4><ul><li>item</li></ul></blockquote>");
  });

  it("renders a thematic break", () => {
    expect(render("intro\n\n---\n\nrest")).toContain("<hr>");
  });

  it("drops HTML comments", () => {
    const html = render("<!-- hidden note -->\n\nVisible");

    expect(html).not.toContain("hidden note");
    expect(html).toContain("Visible");
  });

  it("keeps the readme's own layout HTML and hardens its links", () => {
    const html = render('<p align="center"><a href="docs/api.md">API</a></p>');

    expect(html).toContain('align="center"');
    expect(html).toContain('href="https://github.com/octo/repo/blob/HEAD/docs/api.md"');
    expect(html).toContain('rel="noreferrer nofollow"');
  });

  it("resolves relative images against the repository's raw host", () => {
    const html = render("![logo](./assets/logo.png)");

    expect(html).toContain(
      'src="https://raw.githubusercontent.com/octo/repo/HEAD/assets/logo.png"',
    );
  });

  it("strips scripts, event handlers and javascript: URLs", () => {
    const html = render(
      [
        "<script>alert(1)</script>",
        '<img src="x" onerror="alert(1)">',
        "[click](javascript:alert)",
        '<a href="javascript:alert(1)">nope</a>',
      ].join("\n\n"),
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain('href="javascript');
    // A rejected target leaves the label as plain text.
    expect(html).toContain("click");
    expect(html).toContain("nope");
  });

  it("escapes text that only looks like markup", () => {
    const html = render("Use a < b > c in the formula");

    expect(html).toContain("a &lt; b &gt; c");
  });
});

describe("resolveReadmeUrl", () => {
  it("passes absolute http(s) and mailto URLs through", () => {
    expect(resolveReadmeUrl("https://example.com", "octo/repo", "link")).toBe(
      "https://example.com",
    );
    expect(resolveReadmeUrl("mailto:hi@example.com", "octo/repo", "link")).toBe(
      "mailto:hi@example.com",
    );
  });

  it("resolves a repository-relative link to the default branch on github.com", () => {
    expect(resolveReadmeUrl("docs/api.md", "octo/repo", "link")).toBe(
      "https://github.com/octo/repo/blob/HEAD/docs/api.md",
    );
    expect(resolveReadmeUrl("/CONTRIBUTING.md", "octo/repo", "link")).toBe(
      "https://github.com/octo/repo/blob/HEAD/CONTRIBUTING.md",
    );
  });

  it("resolves a relative image to the raw host", () => {
    expect(resolveReadmeUrl("../img/hero.png", "octo/repo", "image")).toBe(
      "https://raw.githubusercontent.com/octo/repo/HEAD/img/hero.png",
    );
  });

  it("resolves an in-document anchor to the repository page", () => {
    expect(resolveReadmeUrl("#install", "octo/repo", "link")).toBe(
      "https://github.com/octo/repo#install",
    );
  });

  it("rejects an unknown scheme", () => {
    expect(resolveReadmeUrl("javascript:alert(1)", "octo/repo", "link")).toBe("");
    expect(resolveReadmeUrl("data:text/html,<script>", "octo/repo", "image")).toBe("");
  });

  it("keeps an inline image data URL", () => {
    expect(resolveReadmeUrl("data:image/png;base64,AAA", "octo/repo", "image")).toBe(
      "data:image/png;base64,AAA",
    );
  });
});
