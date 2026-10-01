import { describe, expect, it } from "vitest";
import {
  autoModerationCategories,
  buildModerationNote,
  collectVacancyModerationText,
  describeModerationResult,
  hasScamSignals,
  screenContentForModeration,
} from "@/lib/auto-moderation";

const demands = [
  "Оплатіть навчання перед стартом.",
  "Спершу оплатіть навчання",
  "Потрібно внести депозит, і ми надішлемо завдання.",
  "Необхідно сплатити за реєстрацію в системі.",
  "Внесіть депозит за навчання.",
  "Сплатіть страховий внесок 500 грн.",
  "Гарантійний внесок повертаємо через місяць.",
  "Пишіть у телеграм, там деталі.",
  "Пишіть нам у Telegram",
  "Пишіть мені на вайбер",
  "Нужно оплатить обучение.",
  "Оплатите стажировку и начинайте.",
  "You only need to pay a registration fee.",
  "There is a small training fee.",
  "An upfront payment is required for the equipment.",
  "Please send a deposit before the interview.",
  "Message me on Telegram for details.",
  "Contact us via WhatsApp.",
  "ВНЕСІТЬ ДЕПОЗИТ",
  // A Latin "i" inside a Cyrillic word is still the same word.
  "Оплатiть навчання перед стартом.",
  "Write to me on Telegram.",
  "Напишіть у телеграм.",
  // A negation earlier in the text does not cover a later demand.
  "No experience needed, just pay a registration fee.",
];

/** Honest vacancies that say the opposite, or name the tool they work with. */
const honest = [
  "We will never ask you to pay a fee or a deposit.",
  "No upfront payment required.",
  "There is no registration fee.",
  "No training fee.",
  "Вам не потрібно оплатити навчання — воно безкоштовне.",
  "Пишемо у Telegram Mini Apps на React.",
  "Пишемо на Viber API боти.",
];

const perks = [
  "Оплачуване навчання для нових людей.",
  "Компанія оплачує курси англійської.",
  "Передоплата 50% фрилансеру перед стартом.",
  "Оплата навчання за рахунок компанії.",
  "Paid training and a mentor.",
  "We pay for your courses.",
  "Telegram-бот для клієнтів: досвід з Telegram API.",
  "Ми пишемо у TypeScript.",
  "Депозитні продукти банку: знання фінансів буде плюсом.",
];

describe("hasScamSignals", () => {
  it.each(demands)("flags a demand: %s", (text) => {
    expect(hasScamSignals(text)).toBe(true);
  });

  it.each(perks)("does not flag a perk or an ordinary mention: %s", (text) => {
    expect(hasScamSignals(text)).toBe(false);
  });

  it.each(honest)("does not flag a negation or the tool itself: %s", (text) => {
    expect(hasScamSignals(text)).toBe(false);
  });

  it("does not match inside longer words", () => {
    expect(hasScamSignals("переоплатіть навчання")).toBe(false);
    expect(hasScamSignals("внесіть депозитарій")).toBe(false);
  });
});

describe("screenContentForModeration with the scam option", () => {
  it("adds the scam category for vacancies", () => {
    const result = screenContentForModeration(
      collectVacancyModerationText({
        title: "Junior менеджер",
        description: "<p>Робота з клієнтами. <strong>Внесіть депозит</strong> за навчання.</p>",
        city: "Київ",
      }),
      { scam: true },
    );
    expect(result.flagged).toBe(true);
    expect(result.categories).toEqual(["scam"]);
    expect(result.matches).toEqual([{ category: "scam" }]);
    expect(result.note).toBe(buildModerationNote(["scam"]));
    expect(result.note).toContain("[авто]");
    expect(result.note).toContain("шахрайства");
  });

  it("looks at the title and the city too", () => {
    expect(
      screenContentForModeration(["Pay a registration fee", "<p>Nice job</p>", null], { scam: true }).categories,
    ).toEqual(["scam"]);
    expect(
      screenContentForModeration(["Designer", "<p>Nice job</p>", "Пишіть у телеграм"], { scam: true }).categories,
    ).toEqual(["scam"]);
  });

  it("does not flag perks", () => {
    const result = screenContentForModeration(perks, { scam: true });
    expect(result.flagged).toBe(false);
    expect(result.categories).toEqual([]);
  });

  it("is off without the option", () => {
    for (const text of demands.slice(0, -1)) {
      const result = screenContentForModeration([text]);
      expect(result.categories, text).not.toContain("scam");
      expect(result.flagged, text).toBe(false);
    }
    expect(screenContentForModeration(demands, { scam: false }).categories).not.toContain("scam");
  });

  it("is listed after the existing categories", () => {
    expect(autoModerationCategories[autoModerationCategories.length - 1]).toBe("scam");
  });
});

describe("collectVacancyModerationText", () => {
  it("screens the title, the description and the city", () => {
    expect(collectVacancyModerationText({ title: "T", description: "<p>D</p>", city: null })).toEqual([
      "T",
      "<p>D</p>",
      null,
    ]);
  });
});

describe("describeModerationResult", () => {
  const result = screenContentForModeration(["Оплатіть навчання"], { scam: true });

  it("names the scam rule in both languages", () => {
    expect(describeModerationResult(result, "uk")).toBe(
      "Контент не пройшов автоматичну перевірку: схоже на вимогу заплатити кандидату чи перейти в месенджер. Відредагуйте текст і спробуйте ще раз.",
    );
    expect(describeModerationResult(result, "en")).toBe(
      "This content didn't pass the automatic check: it reads like asking candidates to pay or to move to a messenger. Edit the text and try again.",
    );
  });

  it("names it from the bare category too", () => {
    expect(describeModerationResult({ categories: ["scam"] }, "en")).toContain("asking candidates to pay");
  });
});
