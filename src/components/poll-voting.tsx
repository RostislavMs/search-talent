"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";
import { createLocalePath } from "@/lib/i18n/config";
import type { PollQuestion } from "@/lib/polls";

type Selection = { optionIds: string[]; rating: number | null };

function buildSelections(questions: PollQuestion[]): Record<string, Selection> {
  const result: Record<string, Selection> = {};
  for (const question of questions) {
    result[question.id] = {
      optionIds: [...question.selectedOptionIds],
      rating: question.selectedRating,
    };
  }
  return result;
}

export default function PollVoting({
  locale,
  pollId,
  questions: initialQuestions,
  hasVoted: initialHasVoted,
  isClosed,
  resultsVisible,
  isAuthenticated,
}: {
  locale: string;
  pollId: string;
  questions: PollQuestion[];
  hasVoted: boolean;
  isClosed: boolean;
  resultsVisible: boolean;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const isUkrainian = locale === "uk";
  const loginPath = createLocalePath(locale === "uk" ? "uk" : "en", "/login");

  const [questions, setQuestions] = useState<PollQuestion[]>(initialQuestions);
  const [hasVoted, setHasVoted] = useState(initialHasVoted);
  const [editing, setEditing] = useState(false);
  const [selections, setSelections] = useState<Record<string, Selection>>(() =>
    buildSelections(initialQuestions),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Results are shown to voters, on closed polls, and to owners/admins.
  const showResults = (resultsVisible || hasVoted) && !editing;
  const canVote = isAuthenticated && !isClosed;

  const ui = useMemo(
    () =>
      isUkrainian
        ? {
            vote: "Проголосувати",
            voting: "Надсилання...",
            change: "Змінити голос",
            cancel: "Скасувати",
            loginToVote: "Увійдіть, щоб проголосувати",
            closed: "Опитування завершено",
            selectOne: "Оберіть один варіант",
            selectMany: "Оберіть один або декілька варіантів",
            yourAnswer: "Ваша відповідь",
            votes: "голосів",
            average: "Середня оцінка",
            responses: "відповідей",
            noResults: "Результати з'являться після голосування.",
          }
        : {
            vote: "Vote",
            voting: "Submitting...",
            change: "Change vote",
            cancel: "Cancel",
            loginToVote: "Log in to vote",
            closed: "This poll is closed",
            selectOne: "Choose one option",
            selectMany: "Choose one or more options",
            yourAnswer: "Your answer",
            votes: "votes",
            average: "Average rating",
            responses: "responses",
            noResults: "Results appear after you vote.",
          },
    [isUkrainian],
  );

  const toggleOption = (question: PollQuestion, optionId: string) => {
    setSelections((prev) => {
      const current = prev[question.id] ?? { optionIds: [], rating: null };
      if (question.type === "single") {
        return { ...prev, [question.id]: { optionIds: [optionId], rating: null } };
      }
      const has = current.optionIds.includes(optionId);
      const optionIds = has
        ? current.optionIds.filter((id) => id !== optionId)
        : [...current.optionIds, optionId];
      return { ...prev, [question.id]: { ...current, optionIds } };
    });
  };

  const setRating = (questionId: string, rating: number) => {
    setSelections((prev) => ({
      ...prev,
      [questionId]: { optionIds: [], rating },
    }));
  };

  const submit = async () => {
    if (!isAuthenticated) {
      router.push(loginPath);
      return;
    }

    // Build answers, validating client-side for friendlier errors.
    const answers: Array<{
      question_id: string;
      option_ids: string[];
      rating_value: number | null;
    }> = [];

    for (const question of questions) {
      const selection = selections[question.id] ?? { optionIds: [], rating: null };
      if (question.type === "rating") {
        if (selection.rating === null) {
          setError(
            isUkrainian
              ? "Оцініть кожне питання перед надсиланням."
              : "Rate every question before submitting.",
          );
          return;
        }
        answers.push({ question_id: question.id, option_ids: [], rating_value: selection.rating });
      } else {
        if (selection.optionIds.length === 0) {
          setError(
            isUkrainian
              ? "Оберіть варіант у кожному питанні."
              : "Pick an option for every question.",
          );
          return;
        }
        answers.push({
          question_id: question.id,
          option_ids: selection.optionIds,
          rating_value: null,
        });
      }
    }

    setSubmitting(true);
    setError(null);

    const result = await apiFetch<{ results?: PollQuestion[] }>(
      `/api/polls/${pollId}/vote`,
      { method: "POST", body: { answers } },
    );

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (result.data.results) {
      setQuestions(result.data.results);
      setSelections(buildSelections(result.data.results));
    }
    setHasVoted(true);
    setEditing(false);
    router.refresh();
  };

  return (
    <section className="space-y-6">
      {questions.map((question, index) => {
        const selection = selections[question.id] ?? { optionIds: [], rating: null };

        return (
          <div key={question.id} className="rounded-panel app-card p-5 sm:p-6">
            <div className="flex items-baseline gap-2">
              {questions.length > 1 ? (
                <span className="font-display text-sm font-semibold app-soft">{index + 1}.</span>
              ) : null}
              <h3 className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
                {question.prompt}
              </h3>
            </div>

            {!showResults ? (
              <p className="mt-1 text-xs app-soft">
                {question.type === "single"
                  ? ui.selectOne
                  : question.type === "multiple"
                    ? ui.selectMany
                    : null}
              </p>
            ) : null}

            <div className="mt-4 space-y-2.5">
              {question.type === "rating" ? (
                <RatingInput
                  question={question}
                  value={selection.rating}
                  showResults={showResults}
                  disabled={!canVote && !showResults}
                  onChange={(value) => setRating(question.id, value)}
                  averageLabel={ui.average}
                  responsesLabel={ui.responses}
                />
              ) : (
                question.options.map((option) => {
                  const checked = selection.optionIds.includes(option.id);
                  const percent =
                    showResults && question.responsesCount > 0
                      ? Math.round((option.votesCount / question.responsesCount) * 100)
                      : 0;

                  if (showResults) {
                    return (
                      <div
                        key={option.id}
                        className={`relative overflow-hidden rounded-2xl border p-3 ${
                          option.selected
                            ? "border-[color:var(--brand)]"
                            : "app-border"
                        }`}
                      >
                        <div
                          className="absolute inset-y-0 left-0 bg-[color:var(--brand)]/15"
                          style={{ width: `${percent}%` }}
                          aria-hidden="true"
                        />
                        <div className="relative flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium text-[color:var(--foreground)]">
                            {option.label}
                            {option.selected ? (
                              <span className="ml-2 text-xs text-[color:var(--brand-strong)]">
                                ✓ {ui.yourAnswer}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 tabular-nums app-muted">
                            {percent}% · {option.votesCount} {ui.votes}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <label
                      key={option.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-sm transition ${
                        checked
                          ? "border-[color:var(--brand)] bg-[color:var(--brand)]/8"
                          : "app-border hover:bg-[color:var(--surface-muted)]"
                      }`}
                    >
                      <input
                        type={question.type === "single" ? "radio" : "checkbox"}
                        name={`q-${question.id}`}
                        checked={checked}
                        onChange={() => toggleOption(question, option.id)}
                        className="h-4 w-4 accent-[color:var(--brand)]"
                      />
                      <span className="text-[color:var(--foreground)]">{option.label}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        );
      })}

      {error ? <p className="text-sm text-rose-500">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        {!showResults ? (
          <>
            <Button disabled={submitting} onClick={() => void submit()}>
              {submitting ? ui.voting : isAuthenticated ? ui.vote : ui.loginToVote}
            </Button>
            {hasVoted ? (
              <Button variant="ghost" disabled={submitting} onClick={() => setEditing(false)}>
                {ui.cancel}
              </Button>
            ) : null}
          </>
        ) : isClosed ? (
          <span className="rounded-full app-panel px-4 py-2 text-sm app-muted">{ui.closed}</span>
        ) : canVote && hasVoted ? (
          <Button
            variant="secondary"
            onClick={() => {
              setEditing(true);
              setError(null);
            }}
          >
            {ui.change}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function RatingInput({
  question,
  value,
  showResults,
  disabled,
  onChange,
  averageLabel,
  responsesLabel,
}: {
  question: PollQuestion;
  value: number | null;
  showResults: boolean;
  disabled: boolean;
  onChange: (value: number) => void;
  averageLabel: string;
  responsesLabel: string;
}) {
  const min = question.ratingMin ?? 1;
  const max = question.ratingMax ?? 5;
  const steps = [];
  for (let i = min; i <= max; i += 1) steps.push(i);

  if (showResults) {
    const average = question.ratingAverage;
    return (
      <div className="rounded-2xl app-panel p-4">
        <p className="font-display text-2xl font-semibold text-[color:var(--foreground)]">
          {average !== null ? average.toFixed(1) : "—"}
          <span className="text-base app-muted"> / {max}</span>
        </p>
        <p className="mt-1 text-xs app-soft">
          {averageLabel} · {question.responsesCount} {responsesLabel}
        </p>
        {value !== null ? (
          <p className="mt-1 text-xs text-[color:var(--brand-strong)]">
            ✓ {value}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {steps.map((step) => (
        <button
          key={step}
          type="button"
          disabled={disabled}
          onClick={() => onChange(step)}
          className={`flex h-11 min-w-11 items-center justify-center rounded-2xl border px-3 text-sm font-semibold transition ${
            value === step
              ? "border-[color:var(--brand)] bg-[color:var(--brand)]/12 text-[color:var(--foreground)]"
              : "app-border app-muted hover:bg-[color:var(--surface-muted)]"
          }`}
        >
          {step}
        </button>
      ))}
    </div>
  );
}
