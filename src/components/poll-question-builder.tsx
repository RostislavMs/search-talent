"use client";

import FormSelect from "@/components/ui/form-select";
import type { PollQuestionType } from "@/lib/polls";

export type OptionDraft = { id: string; label: string };
export type QuestionDraft = {
  id: string;
  type: PollQuestionType;
  prompt: string;
  options: OptionDraft[];
  ratingMin: number;
  ratingMax: number;
};

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

export function emptyQuestion(): QuestionDraft {
  return {
    id: uid(),
    type: "single",
    prompt: "",
    options: [
      { id: uid(), label: "" },
      { id: uid(), label: "" },
    ],
    ratingMin: 1,
    ratingMax: 5,
  };
}

// Maps the client drafts to the API question payload shape.
export function serializeQuestions(questions: QuestionDraft[]) {
  return questions.map((question) => ({
    question_type: question.type,
    prompt: question.prompt.trim(),
    prompt_uk: null as string | null,
    options:
      question.type === "rating"
        ? []
        : question.options
            .map((option) => ({ label: option.label.trim(), label_uk: null as string | null }))
            .filter((option) => option.label.length > 0),
    rating_min: question.type === "rating" ? question.ratingMin : null,
    rating_max: question.type === "rating" ? question.ratingMax : null,
    multi_min: null as number | null,
    multi_max: null as number | null,
  }));
}

export default function PollQuestionBuilder({
  locale,
  questions,
  onChange,
  locked = false,
}: {
  locale: string;
  questions: QuestionDraft[];
  onChange: (next: QuestionDraft[]) => void;
  /** Structural edits are frozen once a poll has votes. */
  locked?: boolean;
}) {
  const isUkrainian = locale === "uk";
  const ui = isUkrainian
    ? {
        heading: "Питання",
        hint: "Додайте одне питання для простого опитування або кілька — для анкети.",
        addQuestion: "Додати питання",
        removeQuestion: "Прибрати питання",
        question: "Питання",
        promptPlaceholder: "Сформулюйте питання",
        type: "Тип відповіді",
        single: "Один варіант",
        multiple: "Кілька варіантів",
        rating: "Оцінка / шкала",
        option: "Варіант",
        optionPlaceholder: "Текст варіанта",
        addOption: "Додати варіант",
        removeOption: "Прибрати",
        scaleFrom: "Від",
        scaleTo: "До",
        moveUp: "Вгору",
        moveDown: "Вниз",
        lockedNotice:
          "Це опитування вже має голоси — структуру питань змінювати не можна. Можна редагувати лише текст і опис.",
      }
    : {
        heading: "Questions",
        hint: "Add one question for a simple poll, or several for a survey.",
        addQuestion: "Add question",
        removeQuestion: "Remove question",
        question: "Question",
        promptPlaceholder: "Write your question",
        type: "Answer type",
        single: "Single choice",
        multiple: "Multiple choice",
        rating: "Rating / scale",
        option: "Option",
        optionPlaceholder: "Option text",
        addOption: "Add option",
        removeOption: "Remove",
        scaleFrom: "From",
        scaleTo: "To",
        moveUp: "Up",
        moveDown: "Down",
        lockedNotice:
          "This poll already has votes — the question structure is locked. Only text and the body can be edited.",
      };

  const patchQuestion = (id: string, patch: Partial<QuestionDraft>) =>
    onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const removeQuestion = (id: string) => onChange(questions.filter((q) => q.id !== id));

  const moveQuestion = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const addOption = (question: QuestionDraft) =>
    patchQuestion(question.id, {
      options: [...question.options, { id: uid(), label: "" }],
    });

  const patchOption = (question: QuestionDraft, optionId: string, label: string) =>
    patchQuestion(question.id, {
      options: question.options.map((o) => (o.id === optionId ? { ...o, label } : o)),
    });

  const removeOption = (question: QuestionDraft, optionId: string) =>
    patchQuestion(question.id, {
      options: question.options.filter((o) => o.id !== optionId),
    });

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
            {ui.heading}
          </h3>
          <p className="mt-1 text-sm app-muted">{ui.hint}</p>
        </div>
      </div>

      {locked ? (
        <p className="rounded-2xl app-panel-dashed p-4 text-sm app-muted">{ui.lockedNotice}</p>
      ) : null}

      <div className="space-y-4">
        {questions.map((question, index) => (
          <div key={question.id} className="rounded-panel border app-border bg-[color:var(--surface-muted)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
                {ui.question} {index + 1}
              </span>
              {!locked ? (
                <div className="flex items-center gap-1">
                  {questions.length > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => moveQuestion(index, -1)}
                        disabled={index === 0}
                        className="cursor-pointer rounded-full px-2 py-1 text-xs app-soft hover:text-[color:var(--foreground)] disabled:opacity-40"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveQuestion(index, 1)}
                        disabled={index === questions.length - 1}
                        className="cursor-pointer rounded-full px-2 py-1 text-xs app-soft hover:text-[color:var(--foreground)] disabled:opacity-40"
                      >
                        ↓
                      </button>
                    </>
                  ) : null}
                  {questions.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeQuestion(question.id)}
                      className="cursor-pointer rounded-full px-2 py-1 text-xs text-rose-500 hover:text-rose-600"
                    >
                      {ui.removeQuestion}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_12rem]">
              <input
                className="app-input w-full bg-[color:var(--surface)]"
                placeholder={ui.promptPlaceholder}
                value={question.prompt}
                disabled={locked}
                onChange={(event) => patchQuestion(question.id, { prompt: event.target.value })}
              />
              <FormSelect
                className="w-full"
                triggerClassName="w-full bg-[color:var(--surface)]"
                value={question.type}
                onChange={(value) =>
                  patchQuestion(question.id, { type: value as PollQuestionType })
                }
                options={[
                  { value: "single", label: ui.single },
                  { value: "multiple", label: ui.multiple },
                  { value: "rating", label: ui.rating },
                ]}
                disabled={locked}
              />
            </div>

            {question.type === "rating" ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm app-muted">
                  {ui.scaleFrom}
                  <input
                    type="number"
                    min={0}
                    max={98}
                    value={question.ratingMin}
                    disabled={locked}
                    onChange={(event) =>
                      patchQuestion(question.id, { ratingMin: Number(event.target.value) })
                    }
                    className="app-input w-20 bg-[color:var(--surface)]"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm app-muted">
                  {ui.scaleTo}
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={question.ratingMax}
                    disabled={locked}
                    onChange={(event) =>
                      patchQuestion(question.id, { ratingMax: Number(event.target.value) })
                    }
                    className="app-input w-20 bg-[color:var(--surface)]"
                  />
                </label>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {question.options.map((option) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <input
                      className="app-input w-full bg-[color:var(--surface)]"
                      placeholder={ui.optionPlaceholder}
                      value={option.label}
                      disabled={locked}
                      onChange={(event) => patchOption(question, option.id, event.target.value)}
                    />
                    {!locked && question.options.length > 2 ? (
                      <button
                        type="button"
                        aria-label={ui.removeOption}
                        onClick={() => removeOption(question, option.id)}
                        className="shrink-0 cursor-pointer rounded-full border app-border px-3 py-2 text-xs app-soft hover:text-rose-500"
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                ))}
                {!locked ? (
                  <button
                    type="button"
                    onClick={() => addOption(question)}
                    className="cursor-pointer text-sm font-medium text-[color:var(--brand-strong)] hover:opacity-80"
                  >
                    + {ui.addOption}
                  </button>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>

      {!locked ? (
        <button
          type="button"
          onClick={() => onChange([...questions, emptyQuestion()])}
          className="w-full cursor-pointer rounded-panel border border-dashed app-border py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
        >
          + {ui.addQuestion}
        </button>
      ) : null}
    </div>
  );
}
