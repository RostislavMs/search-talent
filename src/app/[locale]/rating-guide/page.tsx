import type { Metadata } from "next";
import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import {
  DecayChart,
  RatingWeightsChart,
  SaturationChart,
  TrustChart,
} from "@/components/charts/rating-charts";
import {
  BalanceIllustration,
  SignalsToScoreIllustration,
  TemplateGridIllustration,
} from "@/components/illustrations/rating-illustrations";
import { ButtonLink } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import MediaSplit from "@/components/ui/media-split";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";

async function getLocaleValue(params: Promise<{ locale: string }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale as Locale;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = await getLocaleValue(params);
  const dictionary = getDictionary(locale);
  return buildMetadata({
    locale,
    pathname: "/rating-guide",
    title: dictionary.metadata.ratingGuide.title,
    description: dictionary.metadata.ratingGuide.description,
  });
}

// ---- Icons -----------------------------------------------------------------

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7 6H5a2 2 0 0 0-2 2v1a3 3 0 0 0 3 3h1M17 6h2a2 2 0 0 1 2 2v1a3 3 0 0 1-3 3h-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 21h6M12 14v7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChecklistIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="m8 10 1.5 1.5L13 8M8 16l1.5 1.5L13 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 11h2M15 17h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function HandshakeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path d="M3 11 8 7l3 3-3 3M21 11l-5-4-3 3 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m10 13 2 2 3-3 4 4-3 3-4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path d="m12 3 9 5-9 5-9-5 9-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="m3 13 9 5 9-5M3 18l9 5 9-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 3v5h5M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="m4 18 5-5 4 4 3-3 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path d="m9 8-5 4 5 4M15 8l5 4-5 4M13 6l-2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path d="M4 4v16h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="m7 15 3-4 3 3 5-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HourglassIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path d="M6 3h12M6 21h12M7 3v3a5 5 0 0 0 10 0V3M7 21v-3a5 5 0 0 1 10 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CurveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path d="M4 20c5 0 7-15 16-15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 20h16" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2 3" strokeLinecap="round" />
    </svg>
  );
}

function MedalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path d="m7 3 3 6m7-6-3 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="15" r="5.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="15" r="2" fill="currentColor" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ---- Copy ------------------------------------------------------------------

type Factor = {
  weight: string;
  title: string;
  whatCounts: string;
  howToImprove: string;
  Icon: () => ReactElement;
  accent: "amber" | "violet" | "sky" | "emerald" | "rose";
};

/** Ties each mechanic to the chart that illustrates it. */
type MechanicId = "trust" | "decay" | "saturation";

type GuideCopy = {
  eyebrow: string;
  title: string;
  description: string;
  backHome: string;
  ctaProfileLabel: string;
  ctaProfileHref: string;
  ctaProjectLabel: string;
  ctaProjectHref: string;
  heroIllustrationLabel: string;
  whyNotLikes: {
    title: string;
    description: string;
    illustrationLabel: string;
    contrast: Array<{ heading: string; text: string; isUs: boolean }>;
  };
  profile: { title: string; description: string; factors: Factor[] };
  project: { title: string; description: string; factors: Factor[] };
  mechanics: {
    title: string;
    description: string;
    items: Array<{ id: MechanicId; name: string; text: string; Icon: () => ReactElement }>;
  };
  badges: { title: string; description: string; bullets: string[]; Icon: () => ReactElement };
  boards: {
    title: string;
    description: string;
    items: Array<{ name: string; text: string; Icon: () => ReactElement }>;
  };
  antiPatterns: {
    title: string;
    description: string;
    illustrationLabel: string;
    bullets: string[];
  };
  outro: { title: string; description: string };
};

function getCopy(locale: Locale): GuideCopy {
  if (locale === "uk") {
    return {
      eyebrow: "Гайд",
      title: "Як працює рейтинг і як його заробляти",
      description:
        "Рейтинг тут про якість, а не популярність: заповнений профіль, реальні проєкти й зароблена довіра спільноти.",
      backHome: "На головну",
      ctaProfileLabel: "Перейти до профілю",
      ctaProfileHref: "/profile/edit",
      ctaProjectLabel: "Опублікувати проєкт",
      ctaProjectHref: "/projects/new",
      heroIllustrationLabel:
        "Схема: сигнали профілю сходяться в один підсумковий бал — 78 зі 100",
      whyNotLikes: {
        title: "Чому не просто лайки",
        description:
          "Лічильник лайків легко накрутити. Ми зважуємо кілька сигналів одразу — і ось у чому різниця.",
        illustrationLabel:
          "Терези: один зароблений сигнал переважує купку дрібних лайків",
        contrast: [
          {
            heading: "Так роблять інші",
            text: "Скільки людей натиснуло сердечко. Накрутити з пари акаунтів — справа десяти хвилин.",
            isUs: false,
          },
          {
            heading: "Так робимо ми",
            text: "Профіль, глибина проєктів, довіра спільноти й активність — кожен фактор зі своєю вагою. Одним фейковим лайком формулу не зрушити.",
            isUs: true,
          },
        ],
      },
      profile: {
        title: "Рейтинг профілю",
        description: "Шість факторів сумуються у фінальний бал від 0 до 100.",
        factors: [
          {
            weight: "30%",
            title: "Якість портфоліо",
            whatCounts: "Середня якість усіх ваших проєктів плюс ваш найкращий пік.",
            howToImprove:
              "Прокачайте 1-2 ключових проєкти максимально. Інші тримайте в адекватному стані.",
            Icon: TrophyIcon,
            accent: "amber",
          },
          {
            weight: "25%",
            title: "Заповненість профілю",
            whatCounts:
              "Зважена шкала по блоках профілю: біо, аватар, навички, освіта, досвід.",
            howToImprove:
              "Натисніть пілюлю «Профіль X%» у героїчному блоці — модалка покаже, чого бракує.",
            Icon: ChecklistIcon,
            accent: "sky",
          },
          {
            weight: "20%",
            title: "Довіра спільноти",
            whatCounts:
              "Реакція інших на ваш профіль. Кілька лайків від знайомих не спрацюють.",
            howToImprove:
              "Публікуйте сильні проєкти й статті. Мульти-акаунти не працюють — див. нижче.",
            Icon: HandshakeIcon,
            accent: "emerald",
          },
          {
            weight: "15%",
            title: "Продуктивність",
            whatCounts: "Кількість проєктів і медіа в них. Перші 5-10 дають найбільший ріст.",
            howToImprove: "5-10 проєктів із реальною роботою — це вже сильний сигнал.",
            Icon: StackIcon,
            accent: "violet",
          },
          {
            weight: "10%",
            title: "Широта стеку",
            whatCounts:
              "Унікальні технології з проєктів і профілю. Після ~12 приріст майже зникає.",
            howToImprove: "Додавайте теги стеку й скіли — але тільки ті, з якими реально працюєте.",
            Icon: CodeIcon,
            accent: "sky",
          },
          {
            weight: "0% (30 днів: 6%)",
            title: "Свіжість",
            whatCounts:
              "Рахується за датою найновішого проєкту. В all-time таблиці не враховується.",
            howToImprove: "Ціль — топ за 30 днів? Публікуйте щось нове регулярно.",
            Icon: ClockIcon,
            accent: "rose",
          },
        ],
      },
      project: {
        title: "Рейтинг проєкту",
        description: "Окрема формула для кожного проєкту, теж від 0 до 100.",
        factors: [
          {
            weight: "35%",
            title: "Довіра спільноти",
            whatCounts: "Голоси за проєкт із поправкою на впевненість — пара лайків не вистрелить.",
            howToImprove: "Реальна робота → реальні голоси. Але не з фейк-акаунтів.",
            Icon: HandshakeIcon,
            accent: "emerald",
          },
          {
            weight: "30%",
            title: "Якість контенту",
            whatCounts:
              "Заповненість полів: опис, роль, статус, посилання, problem/solution/results, обкладинка.",
            howToImprove:
              "Не лишайте порожніх блоків. Поле «Результати» з метриками піднімає сигнал найсильніше.",
            Icon: DocumentIcon,
            accent: "sky",
          },
          {
            weight: "15%",
            title: "Медіа",
            whatCounts: "Кількість скриншотів і відео. Після кількох елементів зростання сповільнюється.",
            howToImprove: "3-6 скриншотів або коротке відео — переконливіше за слова.",
            Icon: ImageIcon,
            accent: "violet",
          },
          {
            weight: "10%",
            title: "Стек технологій",
            whatCounts: "Кількість тегів стеку на проєкті. Знов із кривою насичення.",
            howToImprove: "5-8 тегів, які реально використовувались. Не спам.",
            Icon: CodeIcon,
            accent: "amber",
          },
          {
            weight: "10% (30 днів: 15%)",
            title: "Свіжість",
            whatCounts:
              "Рахується за датою публікації: чим старіший проєкт, тим менша вага. Правки її не оновлюють.",
            howToImprove: "Ціль — топ за 30 днів? Публікуйте нові проєкти регулярно.",
            Icon: ClockIcon,
            accent: "rose",
          },
        ],
      },
      mechanics: {
        title: "Механіки під капотом",
        description:
          "Три прийоми роблять формулу стійкою до накрутки і чесною до різних типів учасників.",
        items: [
          {
            id: "trust",
            name: "Довіра, а не сире співвідношення",
            text: "3 лайки з 0 дизлайків — слабший сигнал, ніж 100 з 5. Формула рахує не саме відношення, а нашу впевненість у ньому.",
            Icon: ChartIcon,
          },
          {
            id: "decay",
            name: "Згасання у часі",
            text: "Старі голоси й проєкти важать менше з кожним тижнем. Але стабільна якість усе одно тримається в топі.",
            Icon: HourglassIcon,
          },
          {
            id: "saturation",
            name: "Криві насичення",
            text: "10 проєктів кращі за 5. А 50 — лише трохи кращі за 30. Тонна шаблонних робіт не виграє у кількох сильних кейсів.",
            Icon: CurveIcon,
          },
        ],
      },
      badges: {
        title: "Бонус від бейджів",
        description:
          "16 бейджів за досягнення — перший проєкт, 25+ підписників, верифікований GitHub, top-10 місяця. Разом дають до +5 балів, тож фармити їх немає сенсу.",
        bullets: [
          "Деякі бейджі мають 3 рівні — наприклад, 50/250/1000 коментарів.",
          "Натисніть на іконку в профілі, щоб побачити опис і прогрес.",
          "Top-10 і Hall of Fame нараховуються автоматично.",
        ],
        Icon: MedalIcon,
      },
      boards: {
        title: "Дві таблиці",
        description:
          "All-time зберігає історію, топ за 30 днів дає шанс новачкам. Низький all-time не закриває вам дорогу в місячний топ.",
        items: [
          {
            name: "All-time",
            text: "Уся історія, свіжість не враховується. Старожили тримають топ, доки накопичений сигнал не переб'ють.",
            Icon: TrophyIcon,
          },
          {
            name: "Останні 30 днів",
            text: "Свіжість важить більше, старі голоси швидше згасають. Кількох тижнів стабільної активності достатньо.",
            Icon: CalendarIcon,
          },
        ],
      },
      antiPatterns: {
        title: "Що НЕ працює",
        description:
          "Спроби обійти формулу не дають бажаного результату — але дають реальний: модерацію.",
        illustrationLabel:
          "Сітка однакових шаблонних карток, одну з них витягнуто й перекреслено",
        bullets: [
          "Мульти-акаунти для лайків — адмінка бачить кластери підозрілих голосів.",
          "Спам-проєкти заради лічильника — криві насичення гасять виграш, а модератор ховає тонкий контент.",
          "Накрутка тегів стеку — рахуються лише унікальні технології.",
          "Перезбереження старих проєктів заради дати — свіжість залежить від публікації, а не від правок.",
        ],
      },
      outro: {
        title: "Найкоротший шлях до високого рейтингу",
        description:
          "Заповніть профіль на 90%+. Опублікуйте 5-10 проєктів із медіа, описом і реальною роллю. Підпишіться на інших, коментуйте чесно. Бейджі з'являться автоматично, як тільки ви досягнете критеріїв.",
      },
    };
  }

  return {
    eyebrow: "Guide",
    title: "How the rating works and how to earn it",
    description:
      "The rating here is about quality, not popularity: a filled-out profile, real projects, and community trust you actually earned.",
    backHome: "Back to home",
    ctaProfileLabel: "Open profile editor",
    ctaProfileHref: "/profile/edit",
    ctaProjectLabel: "Publish a project",
    ctaProjectHref: "/projects/new",
    heroIllustrationLabel:
      "Diagram: profile signals combining into a single final score of 78 out of 100",
    whyNotLikes: {
      title: "Why it's not just likes",
      description:
        "A like counter is trivial to game. We weigh several signals at once — here's the contrast.",
      illustrationLabel:
        "A balance scale where one earned signal outweighs a pile of small likes",
      contrast: [
        {
          heading: "How others do it",
          text: "How many people pressed a heart. A couple of accounts and ten minutes will inflate it.",
          isUs: false,
        },
        {
          heading: "How we do it",
          text: "Profile, project depth, community trust and activity — each with its own weight. One fake like won't move the formula.",
          isUs: true,
        },
      ],
    },
    profile: {
      title: "Profile rating",
      description: "Six factors sum into the final score from 0 to 100.",
      factors: [
        {
          weight: "30%",
          title: "Portfolio quality",
          whatCounts: "The average quality of all your projects plus your single best one.",
          howToImprove: "Polish 1-2 key projects to the max. Keep the rest at least decent.",
          Icon: TrophyIcon,
          accent: "amber",
        },
        {
          weight: "25%",
          title: "Profile completeness",
          whatCounts:
            "A weighted scale across profile blocks: bio, avatar, skills, education, experience.",
          howToImprove:
            "Click the \"Profile X%\" pill in your hero — the modal shows what's still missing.",
          Icon: ChecklistIcon,
          accent: "sky",
        },
        {
          weight: "20%",
          title: "Community trust",
          whatCounts: "How others react to your profile. A few likes from acquaintances won't tip it.",
          howToImprove: "Publish strong projects and articles. Multi-accounts don't work — see below.",
          Icon: HandshakeIcon,
          accent: "emerald",
        },
        {
          weight: "15%",
          title: "Production output",
          whatCounts: "Projects published and media inside them. The first 5-10 give the biggest lift.",
          howToImprove: "5-10 projects with real work is already a strong signal.",
          Icon: StackIcon,
          accent: "violet",
        },
        {
          weight: "10%",
          title: "Tech breadth",
          whatCounts:
            "Unique technologies across projects and profile. Past about a dozen it barely moves.",
          howToImprove: "Tag projects and add skills — but only the ones you actually use.",
          Icon: CodeIcon,
          accent: "sky",
        },
        {
          weight: "0% (last 30 days: 6%)",
          title: "Freshness",
          whatCounts:
            "Measured from your newest project's date. Not counted on the all-time board at all.",
          howToImprove: "Aiming for the 30-day top-10? Publish something new regularly.",
          Icon: ClockIcon,
          accent: "rose",
        },
      ],
    },
    project: {
      title: "Project rating",
      description: "A separate formula for each project, also from 0 to 100.",
      factors: [
        {
          weight: "35%",
          title: "Community trust",
          whatCounts: "Project votes adjusted for confidence — a couple of likes won't trigger a jump.",
          howToImprove: "Real work → real votes. Just not from fake accounts.",
          Icon: HandshakeIcon,
          accent: "emerald",
        },
        {
          weight: "30%",
          title: "Content quality",
          whatCounts:
            "Field completeness: description, role, status, links, problem/solution/results, cover.",
          howToImprove:
            "Don't leave empty blocks. A \"Results\" field with metrics lifts the signal most.",
          Icon: DocumentIcon,
          accent: "sky",
        },
        {
          weight: "15%",
          title: "Media richness",
          whatCounts: "Screenshots and videos attached. Growth flattens after a handful of items.",
          howToImprove: "3-6 screenshots or a short video — more persuasive than words.",
          Icon: ImageIcon,
          accent: "violet",
        },
        {
          weight: "10%",
          title: "Tech stack",
          whatCounts: "Stack tags on the project. Same diminishing-returns curve.",
          howToImprove: "5-8 tags that you really used. No spam.",
          Icon: CodeIcon,
          accent: "amber",
        },
        {
          weight: "10% (last 30 days: 15%)",
          title: "Freshness",
          whatCounts:
            "Measured from the publish date: the older the project, the lower the weight. Edits don't reset it.",
          howToImprove: "Aiming for the 30-day board? Publish new projects regularly.",
          Icon: ClockIcon,
          accent: "rose",
        },
      ],
    },
    mechanics: {
      title: "Mechanics under the hood",
      description:
        "Three techniques make the formula resistant to gaming and fair to different kinds of contributors.",
      items: [
        {
          id: "trust",
          name: "Trust, not raw ratio",
          text: "3 likes with 0 dislikes is a weaker signal than 100 with 5. The formula scores our confidence in the ratio, not the ratio itself.",
          Icon: ChartIcon,
        },
        {
          id: "decay",
          name: "Time decay",
          text: "Old votes and projects matter less every week. Consistent quality still holds the top.",
          Icon: HourglassIcon,
        },
        {
          id: "saturation",
          name: "Saturation curves",
          text: "10 projects beat 5. But 50 are only slightly better than 30. A flood of template work won't beat a handful of strong cases.",
          Icon: CurveIcon,
        },
      ],
    },
    badges: {
      title: "Badge bonus",
      description:
        "16 badges for achievements — first project, 25+ followers, verified GitHub, top-10 of the month. Together they add up to +5 points, so farming them isn't worth it.",
      bullets: [
        "Some badges have 3 tiers — for example 50/250/1000 comments.",
        "Click a badge icon on the profile to see its description and progress.",
        "Top-10 and Hall of Fame are awarded automatically.",
      ],
      Icon: MedalIcon,
    },
    boards: {
      title: "Two boards",
      description:
        "All-time keeps the history, the last-30-days board gives newcomers a shot. A low all-time score doesn't lock you out of the monthly top.",
      items: [
        {
          name: "All-time",
          text: "The full history, freshness excluded. Established members hold the top until their signal is beaten.",
          Icon: TrophyIcon,
        },
        {
          name: "Last 30 days",
          text: "Freshness weighs more and old votes fade faster. A few weeks of steady activity is enough.",
          Icon: CalendarIcon,
        },
      ],
    },
    antiPatterns: {
      title: "What does NOT work",
      description:
        "Trying to bypass the formula doesn't get you the rating you wanted — it gets you moderator attention.",
      illustrationLabel:
        "A grid of identical template cards with one pulled out and crossed through",
      bullets: [
        "Multi-account vote inflation — the admin panel sees suspicious vote clusters.",
        "Spam projects for counter growth — saturation curves cap the gain and moderators hide thin content.",
        "Stack tag stuffing — only unique technologies count.",
        "Re-saving old projects to bump dates — freshness follows the publish date, not edits.",
      ],
    },
    outro: {
      title: "The shortest path to a high rating",
      description:
        "Fill the profile to 90%+. Publish 5-10 projects with media, descriptions, and a real role. Follow others, comment honestly. Badges appear automatically once you hit the criteria.",
    },
  };
}

// ---- Visuals ---------------------------------------------------------------

function accentClasses(accent: Factor["accent"]) {
  switch (accent) {
    case "amber":
      return {
        icon: "bg-amber-500/15 text-amber-500 ring-amber-400/30",
        weight: "text-amber-500",
      };
    case "violet":
      return {
        icon: "bg-violet-500/15 text-violet-500 ring-violet-400/30",
        weight: "text-violet-500",
      };
    case "sky":
      return {
        icon: "bg-sky-500/15 text-sky-500 ring-sky-400/30",
        weight: "text-sky-500",
      };
    case "emerald":
      return {
        icon: "bg-emerald-500/15 text-emerald-500 ring-emerald-400/30",
        weight: "text-emerald-500",
      };
    case "rose":
    default:
      return {
        icon: "bg-rose-500/15 text-rose-500 ring-rose-400/30",
        weight: "text-rose-500",
      };
  }
}

function FactorCard({ factor }: { factor: Factor }) {
  const classes = accentClasses(factor.accent);
  const Icon = factor.Icon;
  return (
    <article className="flex flex-col gap-4 rounded-3xl app-card p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <span
          className={[
            "inline-flex h-12 w-12 items-center justify-center rounded-2xl ring-1",
            classes.icon,
          ].join(" ")}
          aria-hidden="true"
        >
          <Icon />
        </span>
        <span
          className={[
            "text-2xl font-bold tabular-nums sm:text-3xl",
            classes.weight,
          ].join(" ")}
        >
          {factor.weight}
        </span>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-[color:var(--foreground)]">
          {factor.title}
        </h3>
        <p className="mt-2 text-sm leading-6 app-muted">{factor.whatCounts}</p>
      </div>
      <p className="rounded-xl app-panel px-3 py-2 text-sm leading-6 text-[color:var(--foreground)]">
        <span className="mr-1.5 font-semibold">→</span>
        {factor.howToImprove}
      </p>
    </article>
  );
}

function MechanicCard({
  name,
  text,
  Icon,
  chart,
}: {
  name: string;
  text: string;
  Icon: () => ReactElement;
  chart: ReactElement;
}) {
  return (
    <article className="flex flex-col rounded-3xl app-panel p-5">
      <span
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--surface)] text-[color:var(--foreground)] ring-1 app-border"
        aria-hidden="true"
      >
        <Icon />
      </span>
      <h3 className="mt-4 font-semibold text-[color:var(--foreground)]">{name}</h3>
      <p className="mt-2 text-sm leading-6 app-muted">{text}</p>
      <div className="mt-5 border-t app-border pt-5">{chart}</div>
    </article>
  );
}

function mechanicChart(id: MechanicId, locale: Locale) {
  switch (id) {
    // The card heading already names each mechanic, so the figure keeps its
    // title for assistive tech only.
    case "trust":
      return <TrustChart locale={locale} surface="bare" hideTitle />;
    case "decay":
      return <DecayChart locale={locale} surface="bare" hideTitle />;
    case "saturation":
    default:
      return <SaturationChart locale={locale} surface="bare" hideTitle />;
  }
}

// ---- Page ------------------------------------------------------------------

export default async function RatingGuidePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await getLocaleValue(params);
  const copy = getCopy(locale);
  const BadgesIcon = copy.badges.Icon;

  return (
    <main className="mx-auto max-w-[88rem] px-0 py-10 sm:px-6">
      {/* Hero */}
      <section className="bg-brand-hero relative overflow-hidden rounded-none sm:rounded-hero border app-border p-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)] sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-white/70 sm:text-sm">
            {copy.eyebrow}
          </p>
          <LocalizedLink
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white/80 transition hover:text-white"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
              <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
            </svg>
            {copy.backHome}
          </LocalizedLink>
        </div>
        {/* Two columns from lg up so the artwork fills the space the copy left empty. */}
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12">
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl md:text-5xl">
              {copy.title}
            </h1>
            <p className="mt-4 text-sm leading-7 text-white/82 sm:text-base sm:leading-8">
              {copy.description}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href={copy.ctaProfileHref}>{copy.ctaProfileLabel}</ButtonLink>
              <ButtonLink
                href={copy.ctaProjectHref}
                variant="ghost"
                className="border border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/20 hover:text-white"
              >
                {copy.ctaProjectLabel}
              </ButtonLink>
            </div>
          </div>
          {/* The scrim keeps the white line art readable over the amber end of
              the hero gradient. */}
          <div className="flex aspect-3/2 items-center justify-center rounded-2xl bg-[rgba(8,15,30,0.42)] p-5 text-white ring-1 ring-white/15 backdrop-blur-sm sm:p-7">
            <SignalsToScoreIllustration label={copy.heroIllustrationLabel} />
          </div>
        </div>
      </section>

      {/* Why not just likes */}
      <section
        className="mt-6 rounded-none sm:rounded-hero app-card p-6 sm:mt-8 sm:p-10"
        aria-labelledby="rating-guide-why"
      >
        <MediaSplit
          side="end"
          media={<BalanceIllustration label={copy.whyNotLikes.illustrationLabel} />}
        >
          <h2
            id="rating-guide-why"
            className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-3xl"
          >
            {copy.whyNotLikes.title}
          </h2>
          <p className="mt-3 text-sm leading-7 app-muted sm:text-base sm:leading-8">
            {copy.whyNotLikes.description}
          </p>
          <div className="mt-6 grid gap-4">
            {copy.whyNotLikes.contrast.map((item) => (
              <div
                key={item.heading}
                className={[
                  "rounded-3xl border p-5",
                  item.isUs
                    ? "border-emerald-400/40 bg-emerald-500/10"
                    : "app-border bg-[color:var(--surface-muted)] opacity-90",
                ].join(" ")}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={[
                      "inline-flex h-8 w-8 items-center justify-center rounded-full text-white",
                      item.isUs ? "bg-emerald-500" : "bg-rose-500",
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    {item.isUs ? (
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                        <path d="m5 12 5 5L20 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <XIcon />
                    )}
                  </span>
                  <h3 className="text-base font-semibold text-[color:var(--foreground)]">
                    {item.heading}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-6 app-muted">{item.text}</p>
              </div>
            ))}
          </div>
        </MediaSplit>
      </section>

      {/* Profile rating */}
      <section
        className="mt-6 rounded-none sm:rounded-hero app-card p-6 sm:mt-8 sm:p-10"
        aria-labelledby="rating-guide-profile"
      >
        <h2
          id="rating-guide-profile"
          className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-3xl"
        >
          {copy.profile.title}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 app-muted sm:text-base sm:leading-8">
          {copy.profile.description}
        </p>
        <div className="mt-6">
          <RatingWeightsChart kind="profile" locale={locale} />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {copy.profile.factors.map((factor) => (
            <FactorCard key={factor.title} factor={factor} />
          ))}
        </div>
      </section>

      {/* Project rating */}
      <section
        className="mt-6 rounded-none sm:rounded-hero app-card p-6 sm:mt-8 sm:p-10"
        aria-labelledby="rating-guide-project"
      >
        <h2
          id="rating-guide-project"
          className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-3xl"
        >
          {copy.project.title}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 app-muted sm:text-base sm:leading-8">
          {copy.project.description}
        </p>
        <div className="mt-6">
          <RatingWeightsChart kind="project" locale={locale} />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {copy.project.factors.map((factor) => (
            <FactorCard key={factor.title} factor={factor} />
          ))}
        </div>
      </section>

      {/* Mechanics */}
      <section
        className="mt-6 rounded-none sm:rounded-hero app-card p-6 sm:mt-8 sm:p-10"
        aria-labelledby="rating-guide-mechanics"
      >
        <h2
          id="rating-guide-mechanics"
          className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-3xl"
        >
          {copy.mechanics.title}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 app-muted sm:text-base sm:leading-8">
          {copy.mechanics.description}
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {copy.mechanics.items.map((item) => (
            <MechanicCard
              key={item.name}
              name={item.name}
              text={item.text}
              Icon={item.Icon}
              chart={mechanicChart(item.id, locale)}
            />
          ))}
        </div>
      </section>

      {/* Badges + Boards */}
      <section className="mt-6 grid gap-4 sm:mt-8 lg:grid-cols-2">
        <article
          className="rounded-hero app-card p-6 sm:p-8"
          aria-labelledby="rating-guide-badges"
        >
          <div className="flex items-center gap-3">
            <span
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 ring-1 ring-amber-400/30"
              aria-hidden="true"
            >
              <BadgesIcon />
            </span>
            <h2
              id="rating-guide-badges"
              className="font-display text-xl font-semibold tracking-tight text-[color:var(--foreground)] sm:text-2xl"
            >
              {copy.badges.title}
            </h2>
          </div>
          <p className="mt-4 text-sm leading-7 app-muted">{copy.badges.description}</p>
          <ul className="mt-4 space-y-2.5">
            {copy.badges.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2.5 text-sm leading-6 app-muted">
                <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </article>

        <article
          className="rounded-hero app-card p-6 sm:p-8"
          aria-labelledby="rating-guide-boards"
        >
          <h2
            id="rating-guide-boards"
            className="font-display text-xl font-semibold tracking-tight text-[color:var(--foreground)] sm:text-2xl"
          >
            {copy.boards.title}
          </h2>
          <p className="mt-3 text-sm leading-7 app-muted">{copy.boards.description}</p>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {copy.boards.items.map((item) => {
              const Icon = item.Icon;
              return (
                <li key={item.name} className="rounded-2xl app-panel p-4">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--surface)] text-[color:var(--foreground)] ring-1 app-border"
                      aria-hidden="true"
                    >
                      <Icon />
                    </span>
                    <h3 className="font-semibold text-[color:var(--foreground)]">{item.name}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 app-muted">{item.text}</p>
                </li>
              );
            })}
          </ul>
        </article>
      </section>

      {/* Anti-patterns */}
      <section
        className="mt-6 rounded-none sm:rounded-hero border border-rose-400/30 bg-rose-500/5 p-6 sm:mt-8 sm:p-10"
        aria-labelledby="rating-guide-anti"
      >
        <MediaSplit
          side="start"
          media={<TemplateGridIllustration label={copy.antiPatterns.illustrationLabel} />}
        >
          <h2
            id="rating-guide-anti"
            className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-3xl"
          >
            {copy.antiPatterns.title}
          </h2>
          <p className="mt-3 text-sm leading-7 app-muted sm:text-base sm:leading-8">
            {copy.antiPatterns.description}
          </p>
          <ul className="mt-5 grid gap-3">
            {copy.antiPatterns.bullets.map((bullet) => (
              <li
                key={bullet}
                className="flex gap-3 rounded-2xl border border-rose-400/20 bg-[color:var(--surface)] p-4 text-sm leading-6 app-muted"
              >
                <span
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-500"
                  aria-hidden="true"
                >
                  <XIcon />
                </span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </MediaSplit>
      </section>

      {/* Outro */}
      <section
        className="mt-6 rounded-none sm:rounded-hero app-card p-6 text-center sm:mt-8 sm:p-12"
        aria-labelledby="rating-guide-outro"
      >
        <h2
          id="rating-guide-outro"
          className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-3xl"
        >
          {copy.outro.title}
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 app-muted sm:text-base sm:leading-8">
          {copy.outro.description}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink href={copy.ctaProfileHref}>{copy.ctaProfileLabel}</ButtonLink>
          <ButtonLink href={copy.ctaProjectHref} variant="secondary">
            {copy.ctaProjectLabel}
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
