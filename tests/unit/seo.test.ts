import { describe, expect, it } from "vitest";
import {
  buildArticleSchema,
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildOrganizationSchema,
  buildPersonSameAs,
  buildPersonSchema,
  buildProfilePageSchema,
  buildProjectSchema,
  buildWebSiteSchema,
  countWords,
  safeJsonLd,
} from "@/lib/seo";

describe("safeJsonLd", () => {
  it("escapes < and > characters", () => {
    const result = safeJsonLd({ text: "</script>" });

    expect(result).not.toContain("</script>");
    expect(result).toContain("\\u003c");
    expect(result).toContain("\\u003e");
  });

  it("escapes & character", () => {
    const result = safeJsonLd({ text: "A & B" });

    expect(result).toContain("\\u0026");
  });

  it("escapes line separator (U+2028) and paragraph separator (U+2029)", () => {
    const result = safeJsonLd({ text: "line\u2028break\u2029end" });

    expect(result).toContain("\\u2028");
    expect(result).toContain("\\u2029");
  });

  it("returns valid JSON structure for simple objects", () => {
    const obj = { name: "Test", value: 42 };
    const result = safeJsonLd(obj);

    expect(result).toContain('"name"');
    expect(result).toContain('"Test"');
    expect(result).toContain("42");
  });
});

describe("buildFaqSchema", () => {
  it("returns a valid FAQPage schema", () => {
    const schema = buildFaqSchema([
      { question: "What?", answer: "This." },
      { question: "Why?", answer: "Because." },
    ]);

    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("FAQPage");
    expect(schema.mainEntity).toHaveLength(2);
    expect(schema.mainEntity[0]["@type"]).toBe("Question");
    expect(schema.mainEntity[0].acceptedAnswer["@type"]).toBe("Answer");
  });

  it("handles empty items array", () => {
    const schema = buildFaqSchema([]);

    expect(schema.mainEntity).toHaveLength(0);
  });
});

describe("buildPersonSameAs", () => {
  it("returns URLs for all provided social links", () => {
    const result = buildPersonSameAs({
      website: "https://example.com",
      github: "johndoe",
      twitter: "@johndoe",
      linkedin: "johndoe",
    });

    expect(result).toContain("https://example.com");
    expect(result).toContain("https://github.com/johndoe");
    expect(result).toContain("https://twitter.com/johndoe");
    expect(result).toContain("https://www.linkedin.com/in/johndoe");
  });

  it("strips @ prefix from twitter handle", () => {
    const result = buildPersonSameAs({
      website: null,
      github: null,
      twitter: "@@johndoe",
      linkedin: null,
    });

    expect(result).toContain("https://twitter.com/johndoe");
  });

  it("returns empty array when all links are null", () => {
    const result = buildPersonSameAs({
      website: null,
      github: null,
      twitter: null,
      linkedin: null,
    });

    expect(result).toEqual([]);
  });

  it("keeps full URLs as-is for website", () => {
    const result = buildPersonSameAs({
      website: "https://my-portfolio.dev",
      github: null,
      twitter: null,
      linkedin: null,
    });

    expect(result).toEqual(["https://my-portfolio.dev"]);
  });

  it("filters out empty strings", () => {
    const result = buildPersonSameAs({
      website: "",
      github: "",
      twitter: "",
      linkedin: "",
    });

    expect(result).toEqual([]);
  });
});

describe("countWords", () => {
  it("returns 0 for null/undefined/empty", () => {
    expect(countWords(null)).toBe(0);
    expect(countWords(undefined)).toBe(0);
    expect(countWords("")).toBe(0);
  });

  it("counts words separated by whitespace", () => {
    expect(countWords("hello world")).toBe(2);
    expect(countWords("one two three four")).toBe(4);
  });

  it("handles multiple spaces between words", () => {
    expect(countWords("hello   world")).toBe(2);
  });

  it("ignores leading/trailing whitespace", () => {
    expect(countWords("  hello world  ")).toBe(2);
  });

  it("counts single word", () => {
    expect(countWords("hello")).toBe(1);
  });
});

describe("buildBreadcrumbSchema", () => {
  it("returns a valid BreadcrumbList schema", () => {
    const schema = buildBreadcrumbSchema([
      { name: "Home", url: "https://example.com" },
      { name: "Projects", url: "https://example.com/projects" },
    ]);

    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("BreadcrumbList");
    expect(schema.itemListElement).toHaveLength(2);
    expect(schema.itemListElement[0].position).toBe(1);
    expect(schema.itemListElement[1].position).toBe(2);
    expect(schema.itemListElement[0].name).toBe("Home");
  });

  it("handles empty array", () => {
    const schema = buildBreadcrumbSchema([]);

    expect(schema.itemListElement).toHaveLength(0);
  });
});

describe("buildOrganizationSchema", () => {
  it("returns a valid Organization schema", () => {
    const schema = buildOrganizationSchema();

    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("Organization");
    expect(schema.name).toBe("SearchTalent");
    expect(schema.url).toBeTruthy();
    expect(schema.logo).toContain("favicon.webp");
  });
});

describe("buildWebSiteSchema", () => {
  it("returns a valid WebSite schema with search action", () => {
    const schema = buildWebSiteSchema();

    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("WebSite");
    expect(schema.name).toBe("SearchTalent");
    expect(schema.potentialAction["@type"]).toBe("SearchAction");
    expect(schema.potentialAction.target.urlTemplate).toContain("{search_term_string}");
  });
});

describe("buildPersonSchema", () => {
  it("returns schema with minimal fields", () => {
    const schema = buildPersonSchema({
      name: null,
      username: null,
      headline: null,
      avatarUrl: null,
      skills: [],
      url: "https://example.com/u/test",
    });

    expect(schema["@type"]).toBe("Person");
    expect(schema.name).toBe("Specialist");
    expect(schema.url).toBe("https://example.com/u/test");
    expect(schema).not.toHaveProperty("jobTitle");
    expect(schema).not.toHaveProperty("image");
    expect(schema).not.toHaveProperty("knowsAbout");
  });

  it("includes all optional fields when provided", () => {
    const schema = buildPersonSchema({
      name: "John Doe",
      username: "johndoe",
      headline: "Developer",
      avatarUrl: "https://example.com/avatar.jpg",
      skills: ["TypeScript", "React"],
      url: "https://example.com/u/johndoe",
      sameAs: ["https://github.com/johndoe"],
      languages: ["English", "Ukrainian"],
      currentPosition: { position: "Lead", company: "Acme" },
      mostRecentEducation: { institution: "MIT", degree: "CS" },
    });

    expect(schema.name).toBe("John Doe");
    expect(schema.jobTitle).toBe("Developer");
    expect(schema.image).toEqual({ "@type": "ImageObject", url: "https://example.com/avatar.jpg" });
    expect(schema.knowsAbout).toEqual(["TypeScript", "React"]);
    expect(schema.sameAs).toEqual(["https://github.com/johndoe"]);
    expect(schema.knowsLanguage).toEqual(["English", "Ukrainian"]);
    expect(schema.worksFor).toEqual({ "@type": "Organization", name: "Acme", roleName: "Lead" });
    expect(schema.alumniOf).toEqual({
      "@type": "EducationalOrganization",
      name: "MIT",
      description: "CS",
    });
  });

  it("uses username when name is null", () => {
    const schema = buildPersonSchema({
      name: null,
      username: "alice",
      headline: null,
      avatarUrl: null,
      skills: [],
      url: "https://example.com",
    });

    expect(schema.name).toBe("alice");
  });

  it("omits worksFor when company is null", () => {
    const schema = buildPersonSchema({
      name: "Test",
      username: null,
      headline: null,
      avatarUrl: null,
      skills: [],
      url: "https://example.com",
      currentPosition: { position: "Dev", company: null },
    });

    expect(schema).not.toHaveProperty("worksFor");
  });

  it("omits alumniOf when institution is null", () => {
    const schema = buildPersonSchema({
      name: "Test",
      username: null,
      headline: null,
      avatarUrl: null,
      skills: [],
      url: "https://example.com",
      mostRecentEducation: { institution: null, degree: "CS" },
    });

    expect(schema).not.toHaveProperty("alumniOf");
  });
});

describe("buildProfilePageSchema", () => {
  it("returns a valid ProfilePage schema", () => {
    const person = buildPersonSchema({
      name: "Test",
      username: null,
      headline: null,
      avatarUrl: null,
      skills: [],
      url: "https://example.com",
    });
    const schema = buildProfilePageSchema({
      url: "https://example.com/u/test",
      person,
      dateCreated: "2024-01-01",
      dateModified: "2024-06-01",
    });

    expect(schema["@type"]).toBe("ProfilePage");
    expect(schema.mainEntity).toBe(person);
    expect(schema.dateCreated).toBe("2024-01-01");
    expect(schema.dateModified).toBe("2024-06-01");
  });

  it("omits dates when null", () => {
    const person = buildPersonSchema({
      name: "Test",
      username: null,
      headline: null,
      avatarUrl: null,
      skills: [],
      url: "https://example.com",
    });
    const schema = buildProfilePageSchema({
      url: "https://example.com",
      person,
      dateCreated: null,
      dateModified: null,
    });

    expect(schema).not.toHaveProperty("dateCreated");
    expect(schema).not.toHaveProperty("dateModified");
  });
});

describe("buildProjectSchema", () => {
  it("returns a valid CreativeWork schema with all fields", () => {
    const schema = buildProjectSchema({
      title: "My Project",
      description: "A cool project",
      url: "https://example.com/projects/1",
      imageUrl: "https://example.com/img.jpg",
      authorName: "John",
      authorUrl: "https://example.com/u/john",
      technologies: ["React", "Node"],
      dateCreated: "2024-01-01",
      dateModified: "2024-06-01",
      demoUrl: "https://demo.example.com",
      codeRepository: "https://github.com/john/project",
    });

    expect(schema["@type"]).toBe("CreativeWork");
    expect(schema.name).toBe("My Project");
    expect(schema.description).toBe("A cool project");
    expect(schema.creator).toEqual({
      "@type": "Person",
      name: "John",
      url: "https://example.com/u/john",
    });
    expect(schema.keywords).toBe("React, Node");
    expect(schema.codeRepository).toBe("https://github.com/john/project");
    expect(schema.sameAs).toBe("https://demo.example.com");
  });

  it("omits optional fields when null", () => {
    const schema = buildProjectSchema({
      title: "Minimal",
      description: null,
      url: "https://example.com",
      imageUrl: null,
      authorName: null,
      authorUrl: null,
      technologies: [],
      dateCreated: null,
    });

    expect(schema).not.toHaveProperty("description");
    expect(schema).not.toHaveProperty("image");
    expect(schema).not.toHaveProperty("creator");
    expect(schema).not.toHaveProperty("keywords");
    expect(schema).not.toHaveProperty("dateCreated");
  });
});

describe("buildArticleSchema", () => {
  it("returns a valid Article schema", () => {
    const schema = buildArticleSchema({
      title: "My Article",
      excerpt: "Summary",
      url: "https://example.com/articles/my-article",
      imageUrl: "https://example.com/img.jpg",
      authorName: "Alice",
      authorUrl: "https://example.com/u/alice",
      datePublished: "2024-01-01",
      dateModified: "2024-02-01",
      articleSection: "Technology",
      keywords: ["react", "nextjs"],
      wordCount: 1500,
    });

    expect(schema["@type"]).toBe("Article");
    expect(schema.headline).toBe("My Article");
    expect(schema.description).toBe("Summary");
    expect(schema.author.name).toBe("Alice");
    expect(schema.publisher["@type"]).toBe("Organization");
    expect(schema.articleSection).toBe("Technology");
    expect(schema.keywords).toBe("react, nextjs");
    expect(schema.wordCount).toBe(1500);
  });

  it("omits optional fields when null", () => {
    const schema = buildArticleSchema({
      title: "Minimal",
      excerpt: null,
      url: "https://example.com",
      imageUrl: null,
      authorName: null,
      authorUrl: null,
      datePublished: null,
      dateModified: null,
    });

    expect(schema).not.toHaveProperty("description");
    expect(schema).not.toHaveProperty("image");
    expect(schema).not.toHaveProperty("author");
    expect(schema).not.toHaveProperty("datePublished");
    expect(schema).not.toHaveProperty("wordCount");
  });

  it("omits wordCount when zero or negative", () => {
    const schema = buildArticleSchema({
      title: "Test",
      excerpt: null,
      url: "https://example.com",
      imageUrl: null,
      authorName: null,
      authorUrl: null,
      datePublished: null,
      dateModified: null,
      wordCount: 0,
    });

    expect(schema).not.toHaveProperty("wordCount");
  });
});
