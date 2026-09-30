"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import CompanyLogo from "@/components/company-logo";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { Button, ButtonLink } from "@/components/ui/Button";
import FormSelect from "@/components/ui/form-select";
import FormTextarea from "@/components/ui/form-textarea";
import SearchSelect from "@/components/ui/search-select";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import {
  COMPANY_LIMITS,
  COMPANY_LOGO_MAX_BYTES,
  COMPANY_LOGO_MIME_TYPES,
  COMPANY_SIZES,
  COMPANY_TYPES,
  isValidCompanySlug,
  normalizeCompanyWebsite,
  suggestCompanySlug,
  type CompanyDetails,
  type CompanySize,
  type CompanyType,
} from "@/lib/companies";
import { useCurrentLocale, useDictionary } from "@/lib/i18n/client";
import { createLocalePath } from "@/lib/i18n/config";
import { uploadWithProgress } from "@/lib/storage/upload-with-progress";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes";

type CountryOption = { id: number; name: string };

type FormState = {
  name: string;
  slug: string;
  type: CompanyType;
  website: string;
  description: string;
  size: CompanySize | "";
  countryId: number | null;
  city: string;
};

type FieldErrors = Partial<Record<"name" | "slug" | "website", string>>;

function toFormState(company?: CompanyDetails | null): FormState {
  return {
    name: company?.name ?? "",
    slug: company?.slug ?? "",
    type: company?.type ?? "company",
    website: company?.website ?? "",
    description: company?.description ?? "",
    size: company?.size ?? "",
    countryId: company?.countryId ?? null,
    city: company?.city ?? "",
  };
}

function sameState(a: FormState, b: FormState) {
  return (Object.keys(a) as Array<keyof FormState>).every((key) => a[key] === b[key]);
}

const LABEL_CLASS = "mb-2 block text-sm font-medium text-[color:var(--foreground)]";
const HINT_CLASS = "mt-1.5 text-xs leading-5 app-soft";
const ERROR_CLASS = "mt-1.5 text-xs leading-5 text-rose-500";

/**
 * Create or edit a company page. The logo is saved on its own right after the
 * upload (its storage key belongs to the company), so on the create form it
 * is kept aside and uploaded once the page exists.
 */
export default function CompanyForm({
  company,
  countries,
  siteHost,
  verified = false,
}: {
  /** The page being edited; absent on the create form. */
  company?: CompanyDetails | null;
  countries: CountryOption[];
  /** Shown before the address field, e.g. "searchtalent.com.ua". */
  siteHost: string;
  verified?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const locale = useCurrentLocale();
  const dictionary = useDictionary();
  const copy = dictionary.companies;
  const ui = copy.form;
  const isEditing = Boolean(company);
  const fieldId = useId();

  const [saved, setSaved] = useState<FormState>(() => toFormState(company));
  const [form, setForm] = useState<FormState>(() => toFormState(company));
  const [slugTouched, setSlugTouched] = useState(isEditing);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const [logoUrl, setLogoUrl] = useState<string | null>(company?.logoUrl ?? null);
  const [pendingLogo, setPendingLogo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isDirty = !sameState(form, saved) || Boolean(pendingLogo);
  const { isWarningOpen, confirmLeave, cancelLeave } = useUnsavedChangesGuard(
    isDirty && !saving,
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      // Until the address is edited by hand, it follows the name.
      if (key === "name" && !slugTouched) {
        next.slug = suggestCompanySlug(String(value));
      }
      return next;
    });
    if (key in errors) {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
  }

  function validate(state: FormState): FieldErrors {
    const next: FieldErrors = {};
    if (state.name.trim().length < COMPANY_LIMITS.nameMin) {
      next.name = ui.errors.nameShort;
    }
    if (!isValidCompanySlug(state.slug.trim())) {
      next.slug = ui.errors.slugInvalid;
    }
    if (state.website.trim() && !normalizeCompanyWebsite(state.website)) {
      next.website = ui.errors.websiteInvalid;
    }
    return next;
  }

  function checkLogoFile(file: File): string | null {
    if (!(COMPANY_LOGO_MIME_TYPES as readonly string[]).includes(file.type)) {
      return ui.logoNotImage;
    }
    if (file.size > COMPANY_LOGO_MAX_BYTES) {
      return ui.logoTooLarge;
    }
    return null;
  }

  async function uploadLogo(companyId: string, file: File): Promise<string | null> {
    const presign = await apiFetch<{ uploadUrl: string; publicUrl: string }>(
      "/api/storage/presign",
      {
        method: "POST",
        body: {
          scope: "company-logo",
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
          companyId,
        },
      },
    );

    if (!presign.ok) {
      return null;
    }

    try {
      await uploadWithProgress({
        url: presign.data.uploadUrl,
        file,
        contentType: file.type,
      });
    } catch {
      return null;
    }

    const stored = await apiFetch<{ logoUrl: string }>(`/api/companies/${companyId}/logo`, {
      method: "PUT",
      body: { logoUrl: `${presign.data.publicUrl}?v=${Date.now()}` },
    });

    return stored.ok ? stored.data.logoUrl : null;
  }

  async function handleLogoSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const problem = checkLogoFile(file);
    setLogoError(problem);
    if (problem) {
      return;
    }

    if (!company) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPendingLogo(file);
      setPreviewUrl(URL.createObjectURL(file));
      return;
    }

    setLogoBusy(true);
    const url = await uploadLogo(company.id, file);
    setLogoBusy(false);

    if (!url) {
      setLogoError(ui.logoFailed);
      return;
    }

    setLogoUrl(url);
    toast.success(ui.saved);
    router.refresh();
  }

  async function handleLogoRemove() {
    setLogoError(null);

    if (!company) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPendingLogo(null);
      setPreviewUrl(null);
      return;
    }

    setLogoBusy(true);
    const result = await apiFetch(`/api/companies/${company.id}/logo`, { method: "DELETE" });
    setLogoBusy(false);

    if (!result.ok) {
      setLogoError(ui.errors.generic);
      return;
    }

    setLogoUrl(null);
    router.refresh();
  }

  function errorMessage(code: string | undefined, status: number): string {
    switch (code) {
      case "slug_taken":
        return ui.errors.slugTaken;
      case "limit":
        return ui.errors.limit.replace("{max}", String(COMPANY_LIMITS.companiesPerCreator));
      case "membership_limit":
        return copy.team.errors.membership_limit.replace(
          "{limit}",
          String(COMPANY_LIMITS.membershipsPerUser),
        );
      case "email_unconfirmed":
        return ui.errors.emailUnconfirmed;
      case "invalid":
        return ui.errors.invalid;
      default:
        return status === 429 ? copy.team.errors.rate_limited : ui.errors.generic;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setSaving(true);

    const body = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      type: form.type,
      website: form.website.trim() || null,
      description: form.description.trim() || null,
      size: form.size || null,
      country_id: form.countryId,
      city: form.city.trim() || null,
    };

    const result = await apiFetch<{
      company: { id: string; slug: string };
      heldForReview?: boolean;
      verificationLost?: boolean;
    }>(company ? `/api/companies/${company.id}` : "/api/companies", {
      method: company ? "PATCH" : "POST",
      body,
    });

    if (!result.ok) {
      setSaving(false);
      if (result.code === "slug_taken") {
        setErrors((current) => ({ ...current, slug: ui.errors.slugTaken }));
      }
      toast.error(errorMessage(result.code, result.status));
      return;
    }

    const { company: savedCompany, heldForReview, verificationLost } = result.data;

    if (!company) {
      if (pendingLogo) {
        const url = await uploadLogo(savedCompany.id, pendingLogo);
        if (!url) {
          toast.warning(ui.logoFailed);
        }
      }

      if (heldForReview) toast.warning(ui.errors.heldForReview);
      else toast.success(ui.created);

      // Clear the guard first, or it would intercept this navigation.
      setPendingLogo(null);
      setSaved(form);
      router.push(createLocalePath(locale, `/companies/edit/${savedCompany.id}`));
      return;
    }

    setSaving(false);
    setSaved(form);

    if (heldForReview) toast.warning(ui.errors.heldForReview);
    else if (verificationLost) toast.warning(ui.verificationLost);
    else toast.success(ui.saved);

    router.refresh();
  }

  const shownLogo = previewUrl ?? logoUrl;
  const describedBy = (key: keyof FieldErrors, hint?: boolean) =>
    [errors[key] ? `${fieldId}-${key}-error` : null, hint ? `${fieldId}-${key}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  // FormSelect adds the empty "not specified" row itself from `placeholder`.
  const sizeOptions = COMPANY_SIZES.map((size) => ({ value: size, label: copy.sizes[size] }));

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <CompanyLogo
          name={form.name || "·"}
          logoUrl={shownLogo}
          alt={copy.logoAlt.replace("{name}", form.name || "")}
          size="lg"
        />
        <div>
          <p className={LABEL_CLASS}>{ui.logo}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={logoBusy || saving}
              onClick={() => fileInputRef.current?.click()}
            >
              {logoBusy ? ui.logoUploading : shownLogo ? ui.logoReplace : ui.logoUpload}
            </Button>
            {shownLogo ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={logoBusy || saving}
                onClick={() => void handleLogoRemove()}
              >
                {ui.logoRemove}
              </Button>
            ) : null}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={COMPANY_LOGO_MIME_TYPES.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => void handleLogoSelect(event)}
          />
          <p className={HINT_CLASS}>{ui.logoHint}</p>
          {logoError ? (
            <p className={ERROR_CLASS} role="alert">
              {logoError}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor={`${fieldId}-name`} className={LABEL_CLASS}>
          {ui.name}
        </label>
        <input
          id={`${fieldId}-name`}
          type="text"
          className="app-input"
          value={form.name}
          maxLength={COMPANY_LIMITS.nameMax}
          placeholder={ui.namePlaceholder}
          autoComplete="organization"
          required
          aria-invalid={Boolean(errors.name)}
          aria-describedby={describedBy("name")}
          onChange={(event) => update("name", event.target.value)}
        />
        {errors.name ? (
          <p id={`${fieldId}-name-error`} className={ERROR_CLASS}>
            {errors.name}
          </p>
        ) : null}
      </div>

      <fieldset>
        <legend className={LABEL_CLASS}>{ui.type}</legend>
        <div className="flex flex-wrap gap-2">
          {COMPANY_TYPES.map((type) => {
            const active = form.type === type;
            return (
              <label
                key={type}
                className={[
                  "cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-colors has-focus-visible:ring-2 has-focus-visible:ring-[color:var(--ring)]",
                  active
                    ? "border-transparent bg-[color:var(--foreground)] text-[color:var(--background)]"
                    : "app-border text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name={`${fieldId}-type`}
                  value={type}
                  checked={active}
                  onChange={() => update("type", type)}
                  className="sr-only"
                />
                {type === "school" ? copy.typeSchool : copy.typeCompany}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${fieldId}-slug`} className={LABEL_CLASS}>
          {ui.slug}
        </label>
        <input
          id={`${fieldId}-slug`}
          type="text"
          className="app-input"
          value={form.slug}
          maxLength={COMPANY_LIMITS.slugMax}
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={Boolean(errors.slug)}
          aria-describedby={describedBy("slug", true)}
          onChange={(event) => {
            setSlugTouched(true);
            update("slug", event.target.value.toLowerCase());
          }}
        />
        {errors.slug ? (
          <p id={`${fieldId}-slug-error`} className={ERROR_CLASS}>
            {errors.slug}
          </p>
        ) : null}
        <p id={`${fieldId}-slug-hint`} className={`${HINT_CLASS} break-all`}>
          {siteHost}/companies/
          <span className="text-[color:var(--foreground)]">{form.slug || "…"}</span> ·{" "}
          {ui.slugHint}
        </p>
      </div>

      <div>
        <label htmlFor={`${fieldId}-website`} className={LABEL_CLASS}>
          {ui.website}
        </label>
        <input
          id={`${fieldId}-website`}
          type="url"
          inputMode="url"
          className="app-input"
          value={form.website}
          maxLength={COMPANY_LIMITS.websiteMax}
          placeholder={ui.websitePlaceholder}
          autoComplete="url"
          aria-invalid={Boolean(errors.website)}
          aria-describedby={describedBy("website", true)}
          onChange={(event) => update("website", event.target.value)}
        />
        {errors.website ? (
          <p id={`${fieldId}-website-error`} className={ERROR_CLASS}>
            {errors.website}
          </p>
        ) : null}
        <p id={`${fieldId}-website-hint`} className={HINT_CLASS}>
          {verified ? ui.renameWarning : ui.websiteHint}
        </p>
      </div>

      <div>
        <label htmlFor={`${fieldId}-description`} className={LABEL_CLASS}>
          {form.type === "school" ? copy.page.aboutSchool : ui.description}
        </label>
        <FormTextarea
          id={`${fieldId}-description`}
          rows={5}
          value={form.description}
          maxLength={COMPANY_LIMITS.descriptionMax}
          placeholder={ui.descriptionPlaceholder}
          onChange={(event) => update("description", event.target.value)}
          className="px-4 py-3 text-sm leading-6"
        />
        <p className={`${HINT_CLASS} text-right`} aria-live="polite">
          {ui.characters
            .replace("{count}", String(form.description.length))
            .replace("{max}", String(COMPANY_LIMITS.descriptionMax))}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p id={`${fieldId}-size-label`} className={LABEL_CLASS}>
            {ui.size}
          </p>
          <div aria-labelledby={`${fieldId}-size-label`} role="group">
            <FormSelect
              options={sizeOptions}
              value={form.size}
              placeholder={ui.sizeNone}
              onChange={(value) => update("size", value as CompanySize | "")}
            />
          </div>
        </div>
        <div>
          <p id={`${fieldId}-country-label`} className={LABEL_CLASS}>
            {ui.country}
          </p>
          <div aria-labelledby={`${fieldId}-country-label`} role="group">
            <SearchSelect
              options={countries}
              value={form.countryId ?? undefined}
              placeholder={ui.countryPlaceholder}
              onChange={(value) => update("countryId", value)}
            />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor={`${fieldId}-city`} className={LABEL_CLASS}>
          {ui.city}
        </label>
        <input
          id={`${fieldId}-city`}
          type="text"
          className="app-input"
          value={form.city}
          maxLength={COMPANY_LIMITS.cityMax}
          autoComplete="address-level2"
          onChange={(event) => update("city", event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t app-border pt-6">
        <Button type="submit" disabled={saving || logoBusy}>
          {saving
            ? isEditing
              ? ui.saving
              : ui.creating
            : isEditing
              ? ui.save
              : ui.create}
        </Button>
        {!isEditing ? (
          <ButtonLink href="/my-space/companies" variant="ghost">
            {copy.team.confirmCancel}
          </ButtonLink>
        ) : null}
      </div>

      <ConfirmDialog
        open={isWarningOpen}
        title={dictionary.common.unsavedChangesTitle}
        description={dictionary.common.unsavedChangesDescription}
        confirmLabel={dictionary.common.unsavedChangesLeave}
        cancelLabel={dictionary.common.unsavedChangesStay}
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
      />
    </form>
  );
}
