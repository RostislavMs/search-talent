"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import FormSelect from "@/components/ui/form-select";
import FormTextarea from "@/components/ui/form-textarea";
import LocalizedLink from "@/components/ui/localized-link";
import OptimizedImage from "@/components/ui/optimized-image";
import { apiFetch } from "@/lib/api-client";
import { compressImageFile } from "@/lib/image-compression";
import { useDictionary } from "@/lib/i18n/client";
import { uploadWithProgress } from "@/lib/storage/upload-with-progress";

const MAX_ATTACHMENTS = 5;

type Attachment = {
  url: string;
  contentType: string;
  name: string;
};

type FeedbackFormProps = {
  isSignedIn: boolean;
};

export default function FeedbackForm({ isSignedIn }: FeedbackFormProps) {
  const dictionary = useDictionary();
  const copy = dictionary.feedbackPage;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("idea");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = [
    { value: "idea", label: copy.categoryIdea },
    { value: "bug", label: copy.categoryBug },
    { value: "feedback", label: copy.categoryFeedback },
    { value: "complaint", label: copy.categoryComplaint },
  ];

  const handleFilesSelected = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    const room = MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) {
      setError(copy.attachTooMany);
      return;
    }

    setUploading(true);
    setError(null);

    const uploaded: Attachment[] = [];

    try {
      for (const rawFile of files.slice(0, room)) {
        const file = await compressImageFile(rawFile, "inline");
        const contentType = file.type || "image/webp";

        const presign = await apiFetch<{
          uploadUrl: string;
          publicUrl: string;
          storagePath: string;
        }>("/api/storage/presign", {
          method: "POST",
          body: {
            scope: "feedback",
            fileName: file.name,
            contentType,
            fileSize: file.size,
          },
        });

        if (!presign.ok) {
          throw new Error(presign.error || copy.attachFailed);
        }

        await uploadWithProgress({
          url: presign.data.uploadUrl,
          file,
          contentType,
        });

        uploaded.push({
          url: presign.data.publicUrl,
          contentType,
          name: rawFile.name,
        });
      }

      setAttachments((current) => [...current, ...uploaded]);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : copy.attachFailed,
      );
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (url: string) => {
    setAttachments((current) => current.filter((item) => item.url !== url));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || uploading || !message.trim()) return;

    setLoading(true);
    setError(null);

    const result = await apiFetch("/api/feedback", {
      method: "POST",
      body: { name, email, category, message, attachments },
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.error || "Something went wrong");
      return;
    }

    setSent(true);
  };

  const handleReset = () => {
    setName("");
    setEmail("");
    setCategory("idea");
    setMessage("");
    setAttachments([]);
    setSent(false);
    setError(null);
  };

  const canAddMore = attachments.length < MAX_ATTACHMENTS;

  return (
    <main className="mx-auto max-w-3xl px-0 py-10 sm:px-6">
      <section className="rounded-none sm:rounded-hero app-card p-6 sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
          {copy.eyebrow}
        </p>
        <h1 className="font-display mt-3 text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
          {copy.title}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-8 app-muted">
          {copy.description}
        </p>

        {sent ? (
          <div className="mt-8 rounded-panel app-panel p-6 text-center">
            <h2 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
              {copy.successTitle}
            </h2>
            <p className="mt-3 app-muted">{copy.successDescription}</p>
            <div className="mt-6">
              <Button variant="secondary" onClick={handleReset}>
                {copy.sendAnother}
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="mt-8 flex flex-col gap-5"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="feedback-name"
                  className="mb-2 block text-sm font-medium text-[color:var(--foreground)]"
                >
                  {copy.nameLabel}
                </label>
                <input
                  id="feedback-name"
                  type="text"
                  placeholder={copy.namePlaceholder}
                  className="app-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div>
                <label
                  htmlFor="feedback-email"
                  className="mb-2 block text-sm font-medium text-[color:var(--foreground)]"
                >
                  {copy.emailLabel}
                </label>
                <input
                  id="feedback-email"
                  type="email"
                  placeholder={copy.emailPlaceholder}
                  className="app-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={254}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--foreground)]">
                {copy.categoryLabel}
              </label>
              <FormSelect
                className="w-full"
                triggerClassName="w-full"
                value={category}
                onChange={(value) => setCategory(value)}
                options={categoryOptions}
              />
            </div>

            <div>
              <label
                htmlFor="feedback-message"
                className="mb-2 block text-sm font-medium text-[color:var(--foreground)]"
              >
                {copy.messageLabel}
              </label>
              <FormTextarea
                id="feedback-message"
                placeholder={copy.messagePlaceholder}
                className="min-h-36 p-4 text-[color:var(--foreground)]"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={5000}
                required
              />
            </div>

            <div>
              <span className="mb-2 block text-sm font-medium text-[color:var(--foreground)]">
                {copy.attachTitle}
              </span>

              {isSignedIn ? (
                <>
                  {attachments.length > 0 ? (
                    <ul className="mb-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
                      {attachments.map((item) => (
                        <li
                          key={item.url}
                          className="relative aspect-square overflow-hidden rounded-2xl border app-border bg-[color:var(--surface-muted)]"
                        >
                          <OptimizedImage
                            src={item.url}
                            alt={item.name}
                            fill
                            sizes="120px"
                            className="object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeAttachment(item.url)}
                            aria-label={copy.attachRemove}
                            className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full border app-border bg-[color:var(--surface)] text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
                          >
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              aria-hidden="true"
                            >
                              <path
                                d="M6 6l12 12M18 6L6 18"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {canAddMore ? (
                    <label
                      className={[
                        "inline-flex items-center rounded-full border app-border bg-[color:var(--surface)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition",
                        uploading
                          ? "cursor-not-allowed opacity-60"
                          : "cursor-pointer hover:bg-[color:var(--surface-muted)]",
                      ].join(" ")}
                    >
                      <span>
                        {uploading ? copy.attachUploading : copy.attachAction}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFilesSelected}
                        disabled={uploading}
                        className="sr-only"
                      />
                    </label>
                  ) : null}

                  <p className="mt-2 text-xs app-soft">{copy.attachHint}</p>
                </>
              ) : (
                <p className="text-sm app-muted">{copy.attachSignInHint}</p>
              )}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button
              type="submit"
              disabled={loading || uploading || !message.trim()}
              className="justify-center"
            >
              {loading ? copy.sending : copy.submit}
            </Button>
          </form>
        )}
      </section>

      <LocalizedLink
        href="/"
        className="mt-8 inline-block text-sm app-soft transition-colors hover:text-[color:var(--foreground)]"
      >
        ← {copy.backToHome}
      </LocalizedLink>
    </main>
  );
}
