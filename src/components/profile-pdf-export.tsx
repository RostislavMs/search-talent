"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useDictionary } from "@/lib/i18n/client";
import type { PublicProfilePageData } from "@/lib/db/public";

type ProfilePdfExportProps = {
  data: PublicProfilePageData;
  label?: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function ProfilePdfExport({
  data,
  label,
}: ProfilePdfExportProps) {
  const dictionary = useDictionary();
  const t = dictionary.pdfExport;
  const [generating, setGenerating] = useState(false);

  const getEmploymentLabel = (value: string) => {
    const map: Record<string, string> = {
      full_time: dictionary.forms.employmentTypeFullTime,
      part_time: dictionary.forms.employmentTypePartTime,
      contract: dictionary.forms.employmentTypeContract,
      freelance: dictionary.forms.employmentTypeFreelance,
      internship: dictionary.forms.employmentTypeInternship,
    };
    return map[value] || value;
  };

  const getWorkFormatLabel = (value: string) => {
    const map: Record<string, string> = {
      remote: dictionary.forms.workFormatRemote,
      hybrid: dictionary.forms.workFormatHybrid,
      office: dictionary.forms.workFormatOffice,
    };
    return map[value] || value;
  };

  const getPreferredContactLabel = (value: string) => {
    const map: Record<string, string> = {
      email: dictionary.creatorProfile.contactMethodEmail,
      telegram: dictionary.creatorProfile.contactMethodTelegram,
      phone: dictionary.creatorProfile.contactMethodPhone,
      linkedin: dictionary.creatorProfile.contactMethodLinkedin,
      website: dictionary.creatorProfile.contactMethodWebsite,
    };
    return map[value] || value;
  };

  const getExperienceLabel = (value: string) => {
    const isUk = dictionary.creatorProfile.totalExperienceYears === "Досвід роботи, років";
    const map: Record<string, string> = {
      no_experience: isUk ? "Без досвіду" : "No experience",
      months_3: isUk ? "3 міс" : "3 months",
      months_6: isUk ? "6 міс" : "6 months",
      year_1: isUk ? "1 рік" : "1 year",
      years_2: isUk ? "2 роки" : "2 years",
      years_3: isUk ? "3 роки" : "3 years",
      years_5: isUk ? "5 років" : "5 years",
      years_10: isUk ? "10 років" : "10 years",
      more_than_10_years: isUk ? "10+ років" : "10+ years",
    };
    return map[value] || value;
  };

  const generate = () => {
    setGenerating(true);

    try {
      const { profile, technologies, languages, education, certificates, workExperience } = data;
      const vis = profile.visibility;
      const displayName = escapeHtml(profile.name || profile.username || "");
      const profileUrl = typeof window !== "undefined" ? `${window.location.origin}/u/${profile.username || ""}` : "";
      const sections: string[] = [];

      // Header with avatar
      const avatarHtml = profile.avatar_url
        ? `<img src="${escapeHtml(profile.avatar_url)}" alt="" class="avatar" crossorigin="anonymous" />`
        : `<div class="avatar avatar-placeholder">${escapeHtml((profile.name || profile.username || "U").slice(0, 1).toUpperCase())}</div>`;

      sections.push(`
        <div class="header">
          <div class="header-row">
            ${avatarHtml}
            <div class="header-info">
              <h1>${displayName}</h1>
              ${profile.headline && vis.about ? `<p class="headline">${escapeHtml(profile.headline)}</p>` : ""}
              <div class="meta-tags">
                ${profile.categoryName ? `<span class="tag">${escapeHtml(profile.categoryName)}</span>` : ""}
                ${[profile.city, profile.countryName].filter(Boolean).length > 0 ? `<span class="tag">${escapeHtml([profile.city, profile.countryName].filter(Boolean).join(", "))}</span>` : ""}
                ${profile.experience_level && vis.professionalDetails ? `<span class="tag">${escapeHtml(getExperienceLabel(profile.experience_level))}</span>` : ""}
              </div>
            </div>
          </div>
        </div>
      `);

      // Contacts
      if (vis.links) {
        const contactItems: Array<{ icon: string; label: string; value: string; href?: string }> = [];
        if (profile.contact_email) contactItems.push({ icon: "&#9993;", label: "Email", value: escapeHtml(profile.contact_email), href: `mailto:${escapeHtml(profile.contact_email)}` });
        if (profile.phone) contactItems.push({ icon: "&#9742;", label: dictionary.creatorProfile.phone, value: escapeHtml(profile.phone), href: `tel:${escapeHtml(profile.phone)}` });
        if (profile.telegram_username) contactItems.push({ icon: "&#9993;", label: "Telegram", value: `@${escapeHtml(profile.telegram_username.replace(/^@/, ""))}`, href: `https://t.me/${escapeHtml(profile.telegram_username.replace(/^@/, ""))}` });
        if (profile.website) contactItems.push({ icon: "&#127760;", label: "Web", value: escapeHtml(profile.website), href: escapeHtml(profile.website) });
        if (profile.linkedin) contactItems.push({ icon: "&#128279;", label: "LinkedIn", value: escapeHtml(profile.linkedin), href: escapeHtml(profile.linkedin) });
        if (profile.github) contactItems.push({ icon: "&#128187;", label: "GitHub", value: escapeHtml(profile.github), href: escapeHtml(profile.github) });
        if (profile.twitter) contactItems.push({ icon: "&#128279;", label: "X / Twitter", value: escapeHtml(profile.twitter), href: escapeHtml(profile.twitter) });
        if (profile.behance) contactItems.push({ icon: "&#128279;", label: "Behance", value: escapeHtml(profile.behance), href: escapeHtml(profile.behance) });
        if (profile.dribbble) contactItems.push({ icon: "&#128279;", label: "Dribbble", value: escapeHtml(profile.dribbble), href: escapeHtml(profile.dribbble) });
        if (profile.artstation) contactItems.push({ icon: "&#128279;", label: "ArtStation", value: escapeHtml(profile.artstation), href: escapeHtml(profile.artstation) });
        if (profile.vimeo) contactItems.push({ icon: "&#128279;", label: "Vimeo", value: escapeHtml(profile.vimeo), href: escapeHtml(profile.vimeo) });
        if (profile.youtube) contactItems.push({ icon: "&#128279;", label: "YouTube", value: escapeHtml(profile.youtube), href: escapeHtml(profile.youtube) });
        if (profile.instagram) contactItems.push({ icon: "&#128279;", label: "Instagram", value: escapeHtml(profile.instagram), href: escapeHtml(profile.instagram) });
        if (profile.preferred_contact_method) contactItems.push({ icon: "&#9733;", label: t.preferredContact, value: escapeHtml(getPreferredContactLabel(profile.preferred_contact_method)) });

        if (contactItems.length > 0) {
          sections.push(`
            <div class="contacts-grid">
              ${contactItems.map((c) => `<div class="contact-item"><span class="contact-label">${c.icon} ${c.label}</span>${c.href ? `<a href="${c.href}" class="contact-value">${c.value}</a>` : `<span class="contact-value">${c.value}</span>`}</div>`).join("")}
            </div>
          `);
        }
      }

      // About
      if (vis.about && profile.bio) {
        const cleanBio = stripHtml(profile.bio);
        sections.push(`
          <div class="section">
            <h2>${t.about}</h2>
            <div class="bio">${cleanBio.split("\n").filter((l) => l.trim()).map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>
          </div>
        `);
      }

      // Professional Details
      if (vis.professionalDetails) {
        const profDetails: string[] = [];
        if (profile.experience_level) {
          profDetails.push(`<div class="detail-item"><span class="detail-label">${t.experience}</span><span class="detail-value">${escapeHtml(getExperienceLabel(profile.experience_level))}</span></div>`);
        }
        if ((profile.employment_types?.length || 0) > 0) {
          profDetails.push(`<div class="detail-item"><span class="detail-label">${t.employment}</span><span class="detail-value">${(profile.employment_types || []).map((et) => escapeHtml(getEmploymentLabel(et))).join(", ")}</span></div>`);
        }
        if ((profile.work_formats?.length || 0) > 0) {
          profDetails.push(`<div class="detail-item"><span class="detail-label">${t.workFormat}</span><span class="detail-value">${(profile.work_formats || []).map((wf) => escapeHtml(getWorkFormatLabel(wf))).join(", ")}</span></div>`);
        }
        if (profile.salary_expectations) {
          profDetails.push(`<div class="detail-item"><span class="detail-label">${t.salary}</span><span class="detail-value">${escapeHtml(profile.salary_expectations)}${profile.salary_currency ? ` ${escapeHtml(profile.salary_currency.toUpperCase())}` : ""}</span></div>`);
        }

        const additionalInfoHtml = profile.additional_info
          ? `<div class="bio" style="margin-top:10px;">${escapeHtml(profile.additional_info).split("\n").filter((l) => l.trim()).map((line) => `<p>${line}</p>`).join("")}</div>`
          : "";

        if (profDetails.length > 0 || additionalInfoHtml) {
          sections.push(`
            <div class="section">
              <h2>${t.professionalDetails}</h2>
              ${profDetails.length > 0 ? `<div class="details-grid">${profDetails.join("")}</div>` : ""}
              ${additionalInfoHtml}
            </div>
          `);
        }
      }

      // Skills
      if (vis.skills && technologies.length > 0) {
        sections.push(`
          <div class="section">
            <h2>${t.skills}</h2>
            <div class="skills">${technologies.map((tech) => `<span class="skill">${escapeHtml(tech.name)}</span>`).join("")}</div>
          </div>
        `);
      }

      // Work Experience
      if (vis.workExperience && workExperience.length > 0) {
        sections.push(`
          <div class="section">
            <h2>${t.workExperience}</h2>
            ${workExperience.map((item) => `
              <div class="entry">
                <div class="entry-header">
                  <strong>${escapeHtml(item.position || "—")}</strong>
                  <span class="date">${[item.started_year, item.is_current ? t.present : item.ended_year].filter(Boolean).join(" – ")}</span>
                </div>
                ${item.company_name ? `<p class="subtitle">${escapeHtml(item.company_name)}</p>` : ""}
                ${item.responsibilities ? `<p class="desc">${escapeHtml(item.responsibilities)}</p>` : ""}
              </div>
            `).join("")}
          </div>
        `);
      }

      // Education
      if (vis.education && education.length > 0) {
        sections.push(`
          <div class="section">
            <h2>${t.education}</h2>
            ${education.map((item) => `
              <div class="entry">
                <div class="entry-header">
                  <strong>${escapeHtml(item.institution || "—")}</strong>
                  <span class="date">${[item.started_on, item.completed_on].filter(Boolean).join(" – ")}</span>
                </div>
                ${[item.degree, item.field_of_study].filter(Boolean).length > 0 ? `<p class="subtitle">${escapeHtml([item.degree, item.field_of_study].filter(Boolean).join(" • "))}</p>` : ""}
                ${item.description ? `<p class="desc">${escapeHtml(item.description)}</p>` : ""}
              </div>
            `).join("")}
          </div>
        `);
      }

      // Certificates
      if (vis.certificates && certificates.length > 0) {
        sections.push(`
          <div class="section">
            <h2>${t.certificates}</h2>
            ${certificates.map((item) => `
              <div class="entry">
                <strong>${escapeHtml(item.title || "—")}</strong>
                ${[item.issuer, item.issued_on].filter(Boolean).length > 0 ? `<p class="subtitle">${escapeHtml([item.issuer, item.issued_on].filter(Boolean).join(" • "))}</p>` : ""}
              </div>
            `).join("")}
          </div>
        `);
      }

      // Languages
      if (vis.languages && languages.length > 0) {
        sections.push(`
          <div class="section">
            <h2>${t.languages}</h2>
            <div class="lang-list">${languages.map((lang) => `<span class="lang-item"><strong>${escapeHtml(lang.name)}</strong>${lang.level ? ` <span class="lang-level">${escapeHtml(lang.level)}</span>` : ""}</span>`).join("")}</div>
          </div>
        `);
      }

      const html = `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="utf-8">
<title>${displayName} — ${t.resume} | SearchTalent</title>
<style>
  @page {
    margin: 16mm 18mm 12mm 18mm;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: #1e293b;
    font-size: 10pt;
    line-height: 1.5;
    background: #fff;
  }

  /* ---- Page header / footer (print only) ---- */
  .page-header {
    display: flex; justify-content: space-between; align-items: center;
    padding-bottom: 8px; margin-bottom: 14px;
    border-bottom: 1px solid #e2e8f0;
  }
  .page-header .brand {
    font-size: 9pt; font-weight: 700; color: #0f172a; letter-spacing: -0.3px;
  }
  .page-header .brand span { color: #64748b; font-weight: 400; }
  .page-header .profile-url {
    font-size: 7.5pt; color: #94a3b8; text-decoration: none;
  }

  /* ---- Header ---- */
  .header { margin-bottom: 10px; padding-bottom: 12px; border-bottom: 2px solid #e2e8f0; }
  .header-row { display: flex; align-items: center; gap: 18px; }
  .avatar {
    width: 72px; height: 72px;
    border-radius: 16px;
    object-fit: cover;
    flex-shrink: 0;
    border: 2px solid #e2e8f0;
  }
  .avatar-placeholder {
    display: flex; align-items: center; justify-content: center;
    background: #f1f5f9;
    color: #64748b;
    font-size: 28px; font-weight: 700;
  }
  .header-info { min-width: 0; }
  .header h1 {
    font-size: 22pt; font-weight: 800;
    letter-spacing: -0.6px;
    color: #0f172a;
    line-height: 1.15;
  }
  .headline {
    font-size: 10.5pt; color: #475569;
    margin-top: 3px;
  }
  .meta-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .tag {
    display: inline-block;
    background: #f1f5f9; color: #475569;
    border-radius: 6px; padding: 2px 10px;
    font-size: 8.5pt; font-weight: 500;
  }

  /* ---- Contacts grid ---- */
  .contacts-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 16px;
    margin-bottom: 14px;
    padding: 10px 14px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
  }
  .contact-item { display: flex; flex-direction: column; padding: 3px 0; }
  .contact-label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.6px; color: #94a3b8; font-weight: 600; }
  .contact-value { font-size: 9pt; color: #334155; text-decoration: none; word-break: break-all; }
  a.contact-value:hover { text-decoration: underline; }

  /* ---- Sections ---- */
  .section { margin-bottom: 14px; }
  .section h2 {
    font-size: 10pt; font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #334155;
    margin-bottom: 7px;
    padding-bottom: 5px;
    border-bottom: 2px solid #e2e8f0;
  }

  /* ---- Bio ---- */
  .bio p { margin-bottom: 5px; color: #334155; font-size: 9.5pt; line-height: 1.6; }
  .bio p:empty { display: none; }

  /* ---- Professional details grid ---- */
  .details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 16px;
  }
  .detail-item {
    display: flex; flex-direction: column;
    background: #f8fafc;
    border-radius: 8px;
    padding: 7px 12px;
  }
  .detail-label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; font-weight: 600; }
  .detail-value { font-size: 9.5pt; color: #1e293b; font-weight: 500; margin-top: 1px; }

  /* ---- Skills ---- */
  .skills { display: flex; flex-wrap: wrap; gap: 5px; }
  .skill {
    background: #f1f5f9;
    color: #334155;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 3px 10px;
    font-size: 8.5pt;
    font-weight: 500;
  }

  /* ---- Entries ---- */
  .entry { margin-bottom: 10px; }
  .entry-header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .entry-header strong { font-size: 10pt; color: #0f172a; }
  .date {
    font-size: 8.5pt; color: #94a3b8;
    white-space: nowrap;
    background: #f1f5f9; border-radius: 4px; padding: 1px 8px;
  }
  .subtitle { font-size: 9pt; color: #64748b; margin-top: 1px; }
  .desc { font-size: 9pt; color: #475569; margin-top: 4px; line-height: 1.55; }

  /* ---- Languages ---- */
  .lang-list { display: flex; flex-wrap: wrap; gap: 8px; }
  .lang-item { font-size: 9.5pt; color: #1e293b; }
  .lang-level { color: #64748b; font-weight: 400; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="page-header">
  <div class="brand">SearchTalent <span>— ${t.resume}</span></div>
  <span class="profile-url">${escapeHtml(profileUrl)}</span>

</div>
${sections.join("\n")}
</body>
</html>`;

      const printWindow = window.open("", "_blank");

      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        // Override document.title after write to control what browsers show in print header
        printWindow.document.title = `${profile.name || profile.username || ""} — ${t.resume} | SearchTalent`;
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button onClick={generate} disabled={generating} variant="ghost" size="sm">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="mr-1.5 h-4 w-4"
        aria-hidden="true"
      >
        <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
        <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
      </svg>
      {generating ? t.generating : (label ?? t.download)}
    </Button>
  );
}
