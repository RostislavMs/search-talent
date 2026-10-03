import { describe, expect, it } from "vitest";
import { buildApplicationReceivedEmail, buildApplicationStatusEmail } from "@/lib/email/templates";

const URL = "https://searchtalent.example/uk/my-space/vacancies/v1";

describe("buildApplicationReceivedEmail", () => {
  it("says who applied to what, and links to the applications", () => {
    const email = buildApplicationReceivedEmail({
      recipientName: "Олена",
      applicantName: "Carol",
      vacancyTitle: "Junior designer",
      companyName: "Acme",
      url: URL,
      locale: "uk",
    });

    expect(email.subject).toBe("Новий відгук на «Junior designer»");
    expect(email.text).toContain("Привіт, Олена!");
    expect(email.text).toContain("Carol відгукнувся(-лася) на вакансію «Junior designer» у компанії Acme.");
    expect(email.text).toContain(URL);
    expect(email.html).toContain(`href="${URL}"`);
  });

  it("escapes what people typed in the HTML, not in the plain text or subject", () => {
    const email = buildApplicationReceivedEmail({
      recipientName: "",
      applicantName: "<b>Eve</b>",
      vacancyTitle: "Dev & <script>",
      companyName: "A&B",
      url: URL,
      locale: "en",
    });

    expect(email.subject).toBe("New application for “Dev & <script>”");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;b&gt;Eve&lt;/b&gt;");
    expect(email.html).toContain("A&amp;B");
    expect(email.text).toContain("<b>Eve</b> applied to “Dev & <script>” at A&B.");
    // No name: a greeting without one.
    expect(email.text.startsWith("Hi!")).toBe(true);
  });

  it("does not leak the message or contacts into the mailbox", () => {
    const email = buildApplicationReceivedEmail({
      recipientName: "Ann",
      applicantName: "",
      vacancyTitle: "Designer",
      companyName: "Acme",
      url: URL,
      locale: "en",
    });
    expect(email.text).toContain("A candidate applied");
    expect(email.text).not.toMatch(/@|\+380/);
  });
});

describe("buildApplicationStatusEmail", () => {
  const build = (notice: "shortlisted" | "rejected" | "hired", locale: "en" | "uk" = "en") =>
    buildApplicationStatusEmail({
      recipientName: "Carol",
      vacancyTitle: "Designer",
      companyName: "Acme",
      notice,
      url: "https://searchtalent.example/en/my-space/applications",
      locale,
    });

  it("has a subject and a kind word for each decision", () => {
    expect(build("shortlisted").subject).toBe("Acme would like to talk about “Designer”");
    expect(build("rejected").subject).toBe("Your application to “Designer”");
    expect(build("hired").subject).toBe("Acme chose you for “Designer”");
    expect(build("rejected").text).toContain("This time Acme chose other candidates.");
    expect(build("rejected").text).toContain("That's not a verdict on your work.");
    expect(build("hired", "uk").text).toContain("Вітаємо! Компанія Acme обрала вас на «Designer».");
  });

  it("links to My applications", () => {
    const email = build("shortlisted");
    expect(email.text).toContain("My applications: https://searchtalent.example/en/my-space/applications");
    expect(email.html).toContain('href="https://searchtalent.example/en/my-space/applications"');
    expect(email.text.startsWith("Hi, Carol!")).toBe(true);
  });
});
