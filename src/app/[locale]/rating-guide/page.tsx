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
import Art from "@/components/ui/art";
import { ButtonLink } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import MediaSplit from "@/components/ui/media-split";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { beat } from "@/lib/motion";
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
  /** The two scores are constantly confused, so the page names both outright. */
  split: {
    title: string;
    description: string;
    items: Array<{ name: string; text: string; detail: string; Icon: () => ReactElement }>;
  };
  profile: { title: string; description: string; factors: Factor[] };
  project: { title: string; description: string; factors: Factor[] };
  mechanics: {
    title: string;
    description: string;
    items: Array<{
      id: MechanicId;
      name: string;
      text: string;
      /** The same mechanic in terms of what the reader should actually do. */
      soWhat: string;
      Icon: () => ReactElement;
    }>;
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
        "Рейтинг тут про якість, а не популярність: реальні роботи, зароблена довіра спільноти й профіль, який дає їм контекст.",
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
      split: {
        title: "Два рейтинги — і вони про різне",
        description:
          "На платформі рахуються два незалежні бали. Їх легко сплутати, тому ось межа між ними.",
        items: [
          {
            name: "Рейтинг профілю",
            text: "Наскільки добре спеціаліст представляє себе та свою роботу.",
            detail:
              "Це бал людини. Він росте від якості ваших робіт і від того, як на них відповідає спільнота. Заповнені поля профілю дають цим роботам контекст, але самі по собі рейтингу не роблять.",
            Icon: ChecklistIcon,
          },
          {
            name: "Рейтинг проєкту",
            text: "Наскільки якісно представлений конкретний проєкт.",
            detail:
              "Це бал однієї роботи: опис, медіа, стек, голоси саме за неї. Кожен проєкт має власний бал — і найсильніші з них підтягують рейтинг профілю.",
            Icon: DocumentIcon,
          },
        ],
      },
      profile: {
        title: "Рейтинг профілю",
        description:
          "Наскільки добре спеціаліст представляє себе та свою роботу. Це не нагорода за кількість заповнених полів: три чверті балу дають самі роботи та реакція на них, і лише чверть — заповненість профілю.",
        factors: [
          {
            weight: "36%",
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
              "Зважена шкала по блоках профілю: біо, аватар, навички, освіта, досвід, контакти.",
            howToImprove:
              "Натисніть пілюлю «Профіль X%» у своєму просторі — модалка покаже, чого бракує. Це разова робота: заповнили — і цей чинник вичерпано.",
            Icon: ChecklistIcon,
            accent: "sky",
          },
          {
            weight: "24%",
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
            weight: "0% (30 днів: 6%)",
            title: "Свіжість",
            whatCounts:
              "Дата вашої найновішої опублікованої роботи. Входи на сайт, перегляди й лайки тут не рахуються взагалі.",
            howToImprove:
              "У головному рейтингу цей чинник вимкнено — місяць без активності вам нічого не коштує. Він оживає лише в топі за 30 днів, і піднімає його нова публікація, а не активність заради активності.",
            Icon: ClockIcon,
            accent: "rose",
          },
        ],
      },
      project: {
        title: "Рейтинг проєкту",
        description:
          "Наскільки якісно представлений конкретний проєкт. Окрема формула для кожної роботи, теж від 0 до 100 — і найсильніші роботи підтягують за собою рейтинг профілю.",
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
            whatCounts:
              "Скільки технологій справді задіяно в цій роботі. Тут це доречно: теги описують один проєкт, а не людину — рейтинг профілю технології не рахує взагалі.",
            howToImprove:
              "5-8 тегів, які реально використовувались. Довший список нічого не дасть — крива насичення гасить приріст.",
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
          "Три прийоми роблять формулу стійкою до накрутки і чесною до різних типів учасників. Під кожним графіком — те саме простими словами.",
        items: [
          {
            id: "trust",
            name: "Довіра, а не сире співвідношення",
            text: "3 лайки з 0 дизлайків — слабший сигнал, ніж 100 з 5. Формула рахує не саме відношення, а нашу впевненість у ньому.",
            soWhat:
              "Кілька голосів від друзів нічого не дадуть — формула чекає на обсяг реальних реакцій.",
            Icon: ChartIcon,
          },
          {
            id: "decay",
            name: "Згасання у часі",
            text: "Старі голоси й проєкти важать менше з кожним тижнем. Але стабільна якість усе одно тримається в топі.",
            soWhat:
              "У головному рейтингу не згорає нічого. Для топу за 30 днів достатньо публікувати щось нове раз на кілька тижнів.",
            Icon: HourglassIcon,
          },
          {
            id: "saturation",
            name: "Криві насичення",
            text: "10 проєктів кращі за 5. А 50 — лише трохи кращі за 30. Тонна шаблонних робіт не виграє у кількох сильних кейсів.",
            soWhat:
              "Після ~10 проєктів вигідніше поліпшити наявні, ніж додати ще один.",
            Icon: CurveIcon,
          },
        ],
      },
      badges: {
        title: "Бонус від бейджів",
        description:
          "Бейджі не випадкові: у кожного чіткий критерій, і нараховується він автоматично, щойно ви його виконали. Разом вони дають щонайбільше +5 балів, тож фармити їх немає сенсу.",
        bullets: [
          "За творчість — перший опублікований проєкт, статті, регулярні публікації.",
          "За участь — коментарі, реакції та підписники, які у вас з'явилися.",
          "За визнання — топ-10 місяця, топ-100 за весь час, проєкт місяця.",
          "За профіль — заповнений профіль, підтверджений email, підключений GitHub.",
          "Частина бейджів має три рівні: критерій той самий, поріг вищий.",
          "Натисніть на іконку бейджа у профілі — там точний критерій і ваш прогрес.",
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
          "Довгий список навичок у профілі — рейтинг профілю технології не рахує взагалі.",
          "Спам тегами на проєкті — рахуються лише унікальні технології, і крива насичення гасить приріст.",
          "Перезбереження старих проєктів заради дати — свіжість залежить від публікації, а не від правок.",
        ],
      },
      outro: {
        title: "Найкоротший шлях до високого рейтингу",
        description:
          "Опублікуйте 5-10 проєктів із медіа, описом і реальною роллю — це найбільша частина балу. Заповніть профіль, щоб цим роботам був контекст. Далі просто будьте в спільноті: підписуйтесь, коментуйте чесно. Бейджі з'являться самі, щойно ви виконаєте їхні критерії.",
      },
    };
  }

  return {
    eyebrow: "Guide",
    title: "How the rating works and how to earn it",
    description:
      "The rating here is about quality, not popularity: real work, community trust you actually earned, and a profile that gives both some context.",
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
    split: {
      title: "Two ratings, and they measure different things",
      description:
        "The platform keeps two independent scores. They are easy to confuse, so here is the line between them.",
      items: [
        {
          name: "Profile rating",
          text: "How well a specialist presents themselves and their work.",
          detail:
            "This is a person's score. It grows from the quality of your work and from how the community answers it. Filled-in profile fields give that work context, but on their own they do not make a rating.",
          Icon: ChecklistIcon,
        },
        {
          name: "Project rating",
          text: "How well one specific project is presented.",
          detail:
            "This is a single piece of work's score: its description, media, stack, and the votes cast on it. Every project carries its own — and the strongest ones pull the profile rating up with them.",
          Icon: DocumentIcon,
        },
      ],
    },
    profile: {
      title: "Profile rating",
      description:
        "How well a specialist presents themselves and their work. It is not a reward for filling in fields: three quarters of the score come from the work itself and the response to it, and only a quarter from profile completeness.",
      factors: [
        {
          weight: "36%",
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
            "A weighted scale across profile blocks: bio, avatar, skills, education, experience, contacts.",
          howToImprove:
            "Click the \"Profile X%\" pill in your space — the modal shows what's still missing. It is a one-off job: fill it in and this factor is spent.",
          Icon: ChecklistIcon,
          accent: "sky",
        },
        {
          weight: "24%",
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
          weight: "0% (last 30 days: 6%)",
          title: "Freshness",
          whatCounts:
            "The date of your newest published work. Logins, page views, and likes are not counted here at all.",
          howToImprove:
            "On the main board this factor is switched off — a quiet month costs you nothing. It only wakes up on the 30-day board, and what lifts it is a new publication, not activity for its own sake.",
          Icon: ClockIcon,
          accent: "rose",
        },
      ],
    },
    project: {
      title: "Project rating",
      description:
        "How well one specific project is presented. A separate formula for each piece of work, also from 0 to 100 — and the strongest ones pull the profile rating up with them.",
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
          whatCounts:
            "How many technologies this piece of work actually involved. It belongs here: tags describe one project rather than a person — the profile rating does not count technologies at all.",
          howToImprove:
            "5-8 tags you really used. A longer list buys nothing — the saturation curve flattens it.",
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
        "Three techniques make the formula resistant to gaming and fair to different kinds of contributors. Under each chart is the same thing in plain terms.",
      items: [
        {
          id: "trust",
          name: "Trust, not raw ratio",
          text: "3 likes with 0 dislikes is a weaker signal than 100 with 5. The formula scores our confidence in the ratio, not the ratio itself.",
          soWhat:
            "A handful of votes from friends buys nothing — the formula is waiting for a real volume of reactions.",
          Icon: ChartIcon,
        },
        {
          id: "decay",
          name: "Time decay",
          text: "Old votes and projects matter less every week. Consistent quality still holds the top.",
          soWhat:
            "Nothing burns off on the main board. For the 30-day one, publishing something new every few weeks is enough.",
          Icon: HourglassIcon,
        },
        {
          id: "saturation",
          name: "Saturation curves",
          text: "10 projects beat 5. But 50 are only slightly better than 30. A flood of template work won't beat a handful of strong cases.",
          soWhat:
            "Past roughly 10 projects, improving the ones you have pays better than adding another.",
          Icon: CurveIcon,
        },
      ],
    },
    badges: {
      title: "Badge bonus",
      description:
        "Badges are not arbitrary: each has a clear criterion and is awarded automatically the moment you meet it. Together they add at most +5 points, so farming them isn't worth it.",
      bullets: [
        "For creating — your first published project, articles, publishing regularly.",
        "For taking part — the comments, reactions, and followers you've gathered.",
        "For recognition — the monthly top-10, the all-time top-100, project of the month.",
        "For the profile — a completed profile, a verified email, a connected GitHub.",
        "Some badges have three tiers: same criterion, higher threshold.",
        "Click a badge icon on a profile — it shows the exact criterion and your progress.",
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
        "A long skill list on the profile — the profile rating does not count technologies at all.",
        "Stack tag stuffing on a project — only unique technologies count, and the saturation curve flattens the gain.",
        "Re-saving old projects to bump dates — freshness follows the publish date, not edits.",
      ],
    },
    outro: {
      title: "The shortest path to a high rating",
      description:
        "Publish 5-10 projects with media, a description, and a real role — that is the largest share of the score. Fill in the profile so that work has context. After that, simply be in the community: follow people, comment honestly. Badges show up on their own once you meet their criteria.",
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

function FactorCard({ factor, index }: { factor: Factor; index: number }) {
  const classes = accentClasses(factor.accent);
  const Icon = factor.Icon;
  return (
    // No hover treatment: the card is a reference entry, not something to
    // click. Lifting it on hover promised an interaction that never arrives.
    <article style={beat(index)} className="flex flex-col gap-4 rounded-3xl app-card p-5">
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
  soWhat,
  Icon,
  chart,
  index,
}: {
  name: string;
  text: string;
  soWhat: string;
  Icon: () => ReactElement;
  chart: ReactElement;
  index: number;
}) {
  return (
    <article style={beat(index)} className="flex flex-col rounded-3xl app-panel p-5">
      <span
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--surface)] text-[color:var(--foreground)] ring-1 app-border"
        aria-hidden="true"
      >
        <Icon />
      </span>
      <h3 className="mt-4 font-semibold text-[color:var(--foreground)]">{name}</h3>
      <p className="mt-2 text-sm leading-6 app-muted">{text}</p>
      {/* The chart answers "how is this computed". Readers came for "what do I
          do about it", so the plain-language line sits between the two and uses
          the same arrow treatment as the factor cards. */}
      <p className="mt-4 rounded-xl bg-[color:var(--surface)] px-3 py-2 text-sm leading-6 text-[color:var(--foreground)]">
        <span className="mr-1.5 font-semibold">→</span>
        {soWhat}
      </p>
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
        {/* Two columns from lg up so the artwork fills the space the copy left
            empty. The copy enters as one orchestrated stack while the score
            ring beside it sweeps up to its 78 — the page's own subject,
            demonstrated rather than described. */}
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12">
          <div className="app-enter">
            <h1
              style={beat(0)}
              className="font-display text-3xl font-medium tracking-tight sm:text-4xl md:text-5xl"
            >
              {copy.title}
            </h1>
            <p
              style={beat(1)}
              className="mt-4 text-sm leading-7 text-white/82 sm:text-base sm:leading-8"
            >
              {copy.description}
            </p>
            <div style={beat(2)} className="mt-6 flex flex-wrap gap-3">
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
            <Art on="load">
              <SignalsToScoreIllustration label={copy.heroIllustrationLabel} />
            </Art>
          </div>
        </div>
      </section>

      {/* Why not just likes */}
      <section
        className="mt-6 rounded-none sm:rounded-hero app-card p-6 sm:mt-8 sm:p-10 app-reveal"
        aria-labelledby="rating-guide-why"
      >
        <MediaSplit
          side="end"
          media={
            <Art>
              <BalanceIllustration label={copy.whyNotLikes.illustrationLabel} />
            </Art>
          }
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
          <div className="app-cascade mt-6 grid gap-4">
            {copy.whyNotLikes.contrast.map((item, index) => (
              <div
                key={item.heading}
                style={beat(index)}
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

      {/* Two ratings. Readers routinely take one score for the other, so the
          distinction gets its own section rather than a line in a paragraph. */}
      <section
        className="mt-6 rounded-none sm:rounded-hero app-card p-6 sm:mt-8 sm:p-10 app-reveal"
        aria-labelledby="rating-guide-split"
      >
        <h2
          id="rating-guide-split"
          className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-3xl"
        >
          {copy.split.title}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 app-muted sm:text-base sm:leading-8">
          {copy.split.description}
        </p>
        <div className="app-cascade mt-6 grid gap-4 lg:grid-cols-2">
          {copy.split.items.map((item, index) => {
            const ItemIcon = item.Icon;
            return (
              <article
                key={item.name}
                style={beat(index)}
                className="rounded-3xl border app-border p-5 sm:p-6"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--surface)] text-[color:var(--brand-strong)] ring-1 app-border"
                    aria-hidden="true"
                  >
                    <ItemIcon />
                  </span>
                  <h3 className="font-display text-lg font-medium tracking-tight text-[color:var(--foreground)]">
                    {item.name}
                  </h3>
                </div>
                <p className="mt-4 text-base leading-7 text-[color:var(--foreground)]">
                  {item.text}
                </p>
                <p className="mt-3 text-sm leading-6 app-muted">{item.detail}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* Profile rating */}
      <section
        className="mt-6 rounded-none sm:rounded-hero app-card p-6 sm:mt-8 sm:p-10 app-reveal"
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
        <div className="app-cascade mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {copy.profile.factors.map((factor, index) => (
            <FactorCard key={factor.title} factor={factor} index={index} />
          ))}
        </div>
      </section>

      {/* Project rating */}
      <section
        className="mt-6 rounded-none sm:rounded-hero app-card p-6 sm:mt-8 sm:p-10 app-reveal"
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
        <div className="app-cascade mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {copy.project.factors.map((factor, index) => (
            <FactorCard key={factor.title} factor={factor} index={index} />
          ))}
        </div>
      </section>

      {/* Mechanics */}
      <section
        className="mt-6 rounded-none sm:rounded-hero app-card p-6 sm:mt-8 sm:p-10 app-reveal"
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
        <div className="app-cascade mt-6 grid gap-4 md:grid-cols-3">
          {copy.mechanics.items.map((item, index) => (
            <MechanicCard
              key={item.name}
              name={item.name}
              text={item.text}
              soWhat={item.soWhat}
              Icon={item.Icon}
              chart={mechanicChart(item.id, locale)}
              index={index}
            />
          ))}
        </div>
      </section>

      {/* Badges + Boards */}
      <section className="app-cascade mt-6 grid gap-4 sm:mt-8 lg:grid-cols-2">
        <article
          style={beat(0)}
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
          <ul className="app-cascade mt-4 space-y-2.5">
            {copy.badges.bullets.map((bullet, index) => (
              <li
                key={bullet}
                style={beat(index)}
                className="flex gap-2.5 text-sm leading-6 app-muted"
              >
                <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </article>

        <article
          style={beat(1)}
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
          <ul className="app-cascade mt-5 grid gap-4 sm:grid-cols-2">
            {copy.boards.items.map((item, index) => {
              const Icon = item.Icon;
              return (
                <li key={item.name} style={beat(index)} className="rounded-2xl app-panel p-4">
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
        className="mt-6 rounded-none sm:rounded-hero border border-rose-400/30 bg-rose-500/5 p-6 sm:mt-8 sm:p-10 app-reveal"
        aria-labelledby="rating-guide-anti"
      >
        <MediaSplit
          side="start"
          media={
            <Art>
              <TemplateGridIllustration label={copy.antiPatterns.illustrationLabel} />
            </Art>
          }
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
          <ul className="app-cascade mt-5 grid gap-3">
            {copy.antiPatterns.bullets.map((bullet, index) => (
              <li
                key={bullet}
                style={beat(index)}
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
        className="mt-6 rounded-none sm:rounded-hero app-card p-6 text-center sm:mt-8 sm:p-12 app-reveal"
        aria-labelledby="rating-guide-outro"
      >
        <div className="app-cascade">
          <h2
            id="rating-guide-outro"
            style={beat(0)}
            className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-3xl"
          >
            {copy.outro.title}
          </h2>
          <p
            style={beat(1)}
            className="mx-auto mt-4 max-w-3xl text-sm leading-7 app-muted sm:text-base sm:leading-8"
          >
            {copy.outro.description}
          </p>
          <div style={beat(2)} className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href={copy.ctaProfileHref}>{copy.ctaProfileLabel}</ButtonLink>
            <ButtonLink href={copy.ctaProjectHref} variant="secondary">
              {copy.ctaProjectLabel}
            </ButtonLink>
          </div>
        </div>
      </section>
    </main>
  );
}
