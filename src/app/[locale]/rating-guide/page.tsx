import type { Metadata } from "next";
import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
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

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.5 5.5l2 2M16.5 16.5l2 2M5.5 18.5l2-2M16.5 7.5l2-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.6" />
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

type GuideCopy = {
  eyebrow: string;
  title: string;
  description: string;
  backHome: string;
  ctaProfileLabel: string;
  ctaProfileHref: string;
  ctaProjectLabel: string;
  ctaProjectHref: string;
  whyNotLikes: {
    title: string;
    description: string;
    contrast: Array<{ heading: string; text: string; isUs: boolean }>;
  };
  profile: { title: string; description: string; factors: Factor[] };
  project: { title: string; description: string; factors: Factor[] };
  mechanics: {
    title: string;
    description: string;
    items: Array<{ name: string; text: string; Icon: () => ReactElement }>;
  };
  badges: { title: string; description: string; bullets: string[]; Icon: () => ReactElement };
  boards: {
    title: string;
    description: string;
    items: Array<{ name: string; text: string; Icon: () => ReactElement }>;
  };
  antiPatterns: { title: string; description: string; bullets: string[] };
  outro: { title: string; description: string };
};

function getCopy(locale: Locale): GuideCopy {
  if (locale === "uk") {
    return {
      eyebrow: "Гайд",
      title: "Як працює рейтинг і як його заробляти",
      description:
        "Рейтинг на SearchTalent побудований навколо якості, а не популярності. Він винагороджує заповнений профіль, реальні проєкти зі сильним сигналом виконання та живий обмін зі спільнотою.",
      backHome: "На головну",
      ctaProfileLabel: "Перейти до профілю",
      ctaProfileHref: "/profile/edit",
      ctaProjectLabel: "Опублікувати проєкт",
      ctaProjectHref: "/projects/new",
      whyNotLikes: {
        title: "Чому не просто лайки",
        description:
          "Простий лічильник лайків легко накрутити. Тому ми рахуємо інакше — і ось у чому різниця.",
        contrast: [
          {
            heading: "Так роблять інші",
            text: "Скільки людей натиснуло сердечко. Чим більше, тим вище. Накрутити з пари акаунтів — справа десяти хвилин.",
            isUs: false,
          },
          {
            heading: "Так робимо ми",
            text: "Заповненість профілю, глибина проєктів, реальна довіра спільноти й активність — усе разом. Кожен фактор має вагу, тож формулу не зламати одним фейковим лайком.",
            isUs: true,
          },
        ],
      },
      profile: {
        title: "Рейтинг профілю",
        description:
          "Шість факторів сумуються у фінальний бал від 0 до 100. У дужках — вага кожного у all-time таблиці.",
        factors: [
          {
            weight: "30%",
            title: "Якість портфоліо",
            whatCounts:
              "Враховується і середня якість усіх ваших проєктів, і ваш найкращий пік. Один сильний проєкт не сховає слабкі — але й слабкі не зіпсують ваш топ.",
            howToImprove:
              "Прокачайте 1-2 ключових проєктів максимально: опис, медіа, посилання. Інші лишайте принаймні в адекватному стані.",
            Icon: TrophyIcon,
            accent: "amber",
          },
          {
            weight: "25%",
            title: "Заповненість профілю",
            whatCounts:
              "Зважена шкала по основних блоках профілю: біо, аватар, навички, мови, освіта, сертифікати, Q&A, досвід роботи й інше.",
            howToImprove:
              "Натисніть на пілюлю «Профіль X%» у героїчному блоці — модалка покаже, що саме залишилось заповнити.",
            Icon: ChecklistIcon,
            accent: "sky",
          },
          {
            weight: "20%",
            title: "Довіра спільноти",
            whatCounts:
              "Як інші користувачі реагують на ваш профіль. Кілька лайків від декого знайомого не вистрелять — формула чекає на стабільний потік позитивної реакції.",
            howToImprove:
              "Публікуйте сильні проєкти й статті, отримуйте чесні відгуки. Мульти-акаунти не працюють (див. розділ нижче).",
            Icon: HandshakeIcon,
            accent: "emerald",
          },
          {
            weight: "15%",
            title: "Продуктивність",
            whatCounts:
              "Кількість опублікованих проєктів і медіа в них. Із поправкою: перші 5-10 проєктів дають великий ріст, далі ефект слабшає.",
            howToImprove:
              "Не женіться за об'ємом. 5-10 проєктів із реальною роботою — це вже сильний сигнал.",
            Icon: StackIcon,
            accent: "violet",
          },
          {
            weight: "10%",
            title: "Широта стеку",
            whatCounts:
              "Унікальні технології з ваших проєктів і профілю. Теж із насиченням — після ~12 додавати нові майже не дає виграшу.",
            howToImprove:
              "Додавайте теги стеку до проєктів і скіли до профілю — головне, щоб вони реально відображали те, з чим ви працюєте.",
            Icon: CodeIcon,
            accent: "sky",
          },
          {
            weight: "0% (місяць: 7%)",
            title: "Свіжість",
            whatCounts:
              "У all-time таблиці не враховується. У місячній — впливає на 7% і поступово згасає за кілька тижнів.",
            howToImprove:
              "Ціль — місячний топ? Публікуйте щось нове регулярно. Для all-time свіжість не критична.",
            Icon: ClockIcon,
            accent: "rose",
          },
        ],
      },
      project: {
        title: "Рейтинг проєкту",
        description:
          "Окрема формула для кожного проєкту, теж від 0 до 100. Ваги для all-time таблиці:",
        factors: [
          {
            weight: "35%",
            title: "Довіра спільноти",
            whatCounts:
              "Голоси за проєкт із поправкою на впевненість. Як і в профілю — пара лайків не дає миттєвого скачка.",
            howToImprove:
              "Реальна робота → реальні голоси. Просіть колег чесно проголосувати, але не з фейк-акаунтів.",
            Icon: HandshakeIcon,
            accent: "emerald",
          },
          {
            weight: "30%",
            title: "Якість контенту",
            whatCounts:
              "Заповненість основних полів проєкту: опис, роль, статус, посилання, problem/solution/results, дати, обкладинка тощо.",
            howToImprove:
              "Не лишайте порожніх блоків. Поле «Результати» з метриками сильно піднімає сигнал.",
            Icon: DocumentIcon,
            accent: "sky",
          },
          {
            weight: "15%",
            title: "Медіа",
            whatCounts:
              "Кількість прикріплених скриншотів і відео. Після кількох елементів зростання уповільнюється.",
            howToImprove:
              "Завантажте 3-6 скриншотів чи коротке відео — це переконливіше за слова.",
            Icon: ImageIcon,
            accent: "violet",
          },
          {
            weight: "10%",
            title: "Стек технологій",
            whatCounts:
              "Кількість тегів стеку на проєкті. Знов із кривою насичення.",
            howToImprove:
              "Додайте 5-8 тегів, які реально використовувались. Не спам.",
            Icon: CodeIcon,
            accent: "amber",
          },
          {
            weight: "10% (місяць: 23%)",
            title: "Свіжість",
            whatCounts:
              "Чим довше проєкт без оновлень, тим менше вага свіжості. У місячній таблиці значення майже втричі сильніше.",
            howToImprove:
              "Оновлюйте проєкт — нове медіа, новий опис, виправлення — і він знову молодий для формули.",
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
            name: "Довіра, а не сире співвідношення",
            text: "3 лайки з 0 дизлайків — менш надійний сигнал, ніж 100 лайків з 5. Формула рахує не просте відношення, а наскільки ми статистично впевнені у високому рейтингу. Тому 100% від трьох знайомих не б'ють 95% від двохсот незнайомців.",
            Icon: ChartIcon,
          },
          {
            name: "Згасання у часі",
            text: "Старі голоси й проєкти важать менше з кожним тижнем. Це штовхає до активності, але не карає старих учасників надто сильно — стабільна якість усе ще тримається у топі.",
            Icon: HourglassIcon,
          },
          {
            name: "Криві насичення",
            text: "10 проєктів кращі за 5. Але 50 — лише трохи кращі за 30. Формула захищена від спаму: тонна шаблонних робіт не виграє у когось із декількома сильними кейсами.",
            Icon: CurveIcon,
          },
        ],
      },
      badges: {
        title: "Бонус від бейджів",
        description:
          "12 бейджів за різні досягнення (перший проєкт, 25+ підписників, верифікований GitHub, top-10 місяця тощо). Кожен дає невеликий бонус до рейтингу — до +5 балів сумарно. Фарм бейджів не зламає формулу.",
        bullets: [
          "Деякі бейджі мають 3 рівні (наприклад, 50/250/1000 коментарів). Вищий рівень = більше визнання.",
          "Бейджі видно на профілі — натисніть на іконку, щоб побачити опис і прогрес.",
          "Top-10 і Hall of Fame нараховуються автоматично, коли ви досягаєте критерію.",
        ],
        Icon: MedalIcon,
      },
      boards: {
        title: "Дві таблиці",
        description:
          "All-time зберігає історію, monthly дає шанс новачкам. Якщо ваш рейтинг низький у all-time — це не означає, що ви не можете потрапити в monthly top-10 цього місяця.",
        items: [
          {
            name: "All-time",
            text: "Враховує всю історію. Сильні старожили домінують доти, доки накопичений сигнал не перебитий новачком. Свіжість тут не важить.",
            Icon: TrophyIcon,
          },
          {
            name: "За місяць",
            text: "Сильніше важить свіжість, старі голоси швидше згасають. Новачки мають реальний шанс потрапити в monthly top-10 — достатньо стабільної активності кілька тижнів.",
            Icon: CalendarIcon,
          },
        ],
      },
      antiPatterns: {
        title: "Що НЕ працює",
        description:
          "Формула захищена від типових накруток. Спроби обійти її не дають бажаного результату, але дають реальний — модерацію.",
        bullets: [
          "Мульти-акаунти для лайків. Формула нівелює слабкі сигнали, плюс адмінка бачить кластери підозрілих голосів.",
          "Спам-проєкти заради лічильника. Криві насичення гасять виграш, а модератор бачить тонкий контент і ховає його.",
          "Накрутка тегів стеку. Рахуються унікальні технології, тож 20 разів той самий тег нічого не дають.",
          "Тиха зміна старих проєктів просто заради дати. Це працює лиш якщо реально щось додано — інакше виглядає підозріло.",
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
      "The SearchTalent rating is built around quality, not popularity. It rewards a filled-out profile, real projects with strong execution signals, and active community exchange.",
    backHome: "Back to home",
    ctaProfileLabel: "Open profile editor",
    ctaProfileHref: "/profile/edit",
    ctaProjectLabel: "Publish a project",
    ctaProjectHref: "/projects/new",
    whyNotLikes: {
      title: "Why it's not just likes",
      description:
        "A simple like counter is trivial to game. So we count differently — and here's the contrast.",
      contrast: [
        {
          heading: "How others do it",
          text: "How many people pressed a heart. More likes — higher rank. Easy to inflate with a couple of accounts in ten minutes.",
          isUs: false,
        },
        {
          heading: "How we do it",
          text: "Profile completeness, project depth, real community trust, and activity — all together. Each factor has a weight, so a single fake like won't break the formula.",
          isUs: true,
        },
      ],
    },
    profile: {
      title: "Profile rating",
      description:
        "Six factors sum into the final score from 0 to 100. In parentheses — each factor's weight in the all-time leaderboard.",
      factors: [
        {
          weight: "30%",
          title: "Portfolio quality",
          whatCounts:
            "Both the average quality of all your projects and your single best one. One strong project won't hide the weak ones — but the weak ones won't drag your peak down either.",
          howToImprove:
            "Polish 1-2 key projects to the max (description, media, repo). Keep the rest at least decent.",
          Icon: TrophyIcon,
          accent: "amber",
        },
        {
          weight: "25%",
          title: "Profile completeness",
          whatCounts:
            "Weighted scale across the main profile blocks: bio, avatar, skills, languages, education, certificates, Q&A, work experience and more.",
          howToImprove:
            "Click the \"Profile X%\" pill in your hero — the modal shows exactly which fields are still empty.",
          Icon: ChecklistIcon,
          accent: "sky",
        },
        {
          weight: "20%",
          title: "Community trust",
          whatCounts:
            "How other users react to your profile. A few likes from acquaintances won't tip the scales — the formula waits for sustained positive signal.",
          howToImprove:
            "Publish strong projects, write articles, collect honest reactions. Multi-accounts don't work (see below).",
          Icon: HandshakeIcon,
          accent: "emerald",
        },
        {
          weight: "15%",
          title: "Production output",
          whatCounts:
            "Number of published projects and media inside them. The first 5-10 give a big lift; the curve flattens after that.",
          howToImprove:
            "Don't chase volume. 5-10 projects with real work is already a strong signal.",
          Icon: StackIcon,
          accent: "violet",
        },
        {
          weight: "10%",
          title: "Tech breadth",
          whatCounts:
            "Unique technologies across your projects and profile. Also saturates — after about a dozen, more tags barely move the needle.",
          howToImprove:
            "Tag your projects and add skills to your profile — but only the ones that reflect what you actually use.",
          Icon: CodeIcon,
          accent: "sky",
        },
        {
          weight: "0% (monthly: 7%)",
          title: "Freshness",
          whatCounts:
            "Not counted in the all-time board. In the monthly one — it weighs 7% and decays over a few weeks.",
          howToImprove:
            "Aiming for monthly top-10? Publish something new regularly. For all-time, freshness isn't critical.",
          Icon: ClockIcon,
          accent: "rose",
        },
      ],
    },
    project: {
      title: "Project rating",
      description:
        "A separate formula for each project, also from 0 to 100. All-time weights:",
      factors: [
        {
          weight: "35%",
          title: "Community trust",
          whatCounts:
            "Project votes adjusted for confidence. Just like profiles — a couple of likes doesn't trigger a jump.",
          howToImprove:
            "Real work → real votes. Ask peers to vote honestly, but not from fake accounts.",
          Icon: HandshakeIcon,
          accent: "emerald",
        },
        {
          weight: "30%",
          title: "Content quality",
          whatCounts:
            "Completeness of the main project fields: description, role, status, links, problem/solution/results, dates, cover, and so on.",
          howToImprove:
            "Don't leave empty blocks. A \"Results\" field with metrics lifts the signal a lot.",
          Icon: DocumentIcon,
          accent: "sky",
        },
        {
          weight: "15%",
          title: "Media richness",
          whatCounts:
            "Number of attached screenshots and videos. Growth flattens after a handful of items.",
          howToImprove:
            "Upload 3-6 screenshots or a short video — more persuasive than words.",
          Icon: ImageIcon,
          accent: "violet",
        },
        {
          weight: "10%",
          title: "Tech stack",
          whatCounts:
            "Number of stack tags on the project. Same diminishing-returns curve.",
          howToImprove: "Add 5-8 tags that you really used. No spam.",
          Icon: CodeIcon,
          accent: "amber",
        },
        {
          weight: "10% (monthly: 23%)",
          title: "Freshness",
          whatCounts:
            "The longer the project sits without updates, the lower this weight. The monthly board weighs freshness almost three times stronger.",
          howToImprove:
            "Update the project — new media, refreshed description, fixes — and it's young again for the formula.",
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
          name: "Trust, not raw ratio",
          text: "3 likes with 0 dislikes is a less reliable signal than 100 likes with 5. The formula doesn't use a simple ratio — it computes how statistically confident we are. So 100% from three friends doesn't beat 95% from two hundred strangers.",
          Icon: ChartIcon,
        },
        {
          name: "Time decay",
          text: "Old votes and projects matter less every week. This rewards activity without punishing long-time members too hard — consistent quality still holds the top.",
          Icon: HourglassIcon,
        },
        {
          name: "Saturation curves",
          text: "10 projects beat 5. But 50 are only slightly better than 30. The formula resists volume spam: a flood of template work won't beat someone with a handful of strong cases.",
          Icon: CurveIcon,
        },
      ],
    },
    badges: {
      title: "Badge bonus",
      description:
        "12 badges for different achievements (first project, 25+ followers, verified GitHub, top-10 of the month, etc.). Each adds a small bonus to the rating — up to +5 points total. Farming badges won't break the formula.",
      bullets: [
        "Some badges have 3 tiers (e.g. 50/250/1000 comments). Higher tier = more recognition.",
        "Badges show on the profile — click an icon to see description and progress.",
        "Top-10 and Hall of Fame are awarded automatically when you hit the criteria.",
      ],
      Icon: MedalIcon,
    },
    boards: {
      title: "Two boards",
      description:
        "All-time keeps the history, monthly gives newcomers a shot. A low all-time rating doesn't lock you out of monthly top-10.",
      items: [
        {
          name: "All-time",
          text: "Counts the full history. Established members dominate until accumulated signal is beaten by a newcomer. Freshness doesn't matter here.",
          Icon: TrophyIcon,
        },
        {
          name: "This month",
          text: "Freshness weighs more, old votes fade faster. Newcomers have a real shot at monthly top-10 — a few weeks of steady activity is enough.",
          Icon: CalendarIcon,
        },
      ],
    },
    antiPatterns: {
      title: "What does NOT work",
      description:
        "The formula resists common gaming attempts. Trying to bypass it doesn't get you the rating you wanted — it gets you moderator attention.",
      bullets: [
        "Multi-account vote inflation. The formula discounts weak signal, and the admin panel sees suspicious vote clusters.",
        "Spam projects for counter growth. Saturation curves cap the gain, and moderators hide thin content.",
        "Stack tag stuffing. Only unique technologies count, so adding the same tag 20 times gives you nothing.",
        "Silently re-saving old projects just to bump dates. Only works if you actually changed something — otherwise it looks suspicious.",
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
    <article className="flex flex-col gap-4 rounded-[1.5rem] app-card p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
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
}: {
  name: string;
  text: string;
  Icon: () => ReactElement;
}) {
  return (
    <article className="rounded-[1.5rem] app-panel p-5">
      <span
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--surface)] text-[color:var(--foreground)] ring-1 app-border"
        aria-hidden="true"
      >
        <Icon />
      </span>
      <h3 className="mt-4 font-semibold text-[color:var(--foreground)]">{name}</h3>
      <p className="mt-2 text-sm leading-6 app-muted">{text}</p>
    </article>
  );
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
    <main className="mx-auto max-w-[88rem] px-4 py-10 sm:px-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[2.25rem] border app-border bg-[linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(29,78,216,0.88)_55%,_rgba(245,158,11,0.78))] p-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)] sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70 sm:text-sm">
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
        <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
          {copy.title}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-white/82 sm:text-base sm:leading-8">
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
      </section>

      {/* Why not just likes */}
      <section
        className="mt-6 rounded-[2rem] app-card p-6 sm:mt-8 sm:p-10"
        aria-labelledby="rating-guide-why"
      >
        <h2
          id="rating-guide-why"
          className="text-2xl font-semibold text-[color:var(--foreground)] sm:text-3xl"
        >
          {copy.whyNotLikes.title}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 app-muted sm:text-base sm:leading-8">
          {copy.whyNotLikes.description}
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {copy.whyNotLikes.contrast.map((item) => (
            <div
              key={item.heading}
              className={[
                "rounded-[1.5rem] border p-5",
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
      </section>

      {/* Profile rating */}
      <section
        className="mt-6 rounded-[2rem] app-card p-6 sm:mt-8 sm:p-10"
        aria-labelledby="rating-guide-profile"
      >
        <h2
          id="rating-guide-profile"
          className="text-2xl font-semibold text-[color:var(--foreground)] sm:text-3xl"
        >
          {copy.profile.title}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 app-muted sm:text-base sm:leading-8">
          {copy.profile.description}
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {copy.profile.factors.map((factor) => (
            <FactorCard key={factor.title} factor={factor} />
          ))}
        </div>
      </section>

      {/* Project rating */}
      <section
        className="mt-6 rounded-[2rem] app-card p-6 sm:mt-8 sm:p-10"
        aria-labelledby="rating-guide-project"
      >
        <h2
          id="rating-guide-project"
          className="text-2xl font-semibold text-[color:var(--foreground)] sm:text-3xl"
        >
          {copy.project.title}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 app-muted sm:text-base sm:leading-8">
          {copy.project.description}
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {copy.project.factors.map((factor) => (
            <FactorCard key={factor.title} factor={factor} />
          ))}
        </div>
      </section>

      {/* Mechanics */}
      <section
        className="mt-6 rounded-[2rem] app-card p-6 sm:mt-8 sm:p-10"
        aria-labelledby="rating-guide-mechanics"
      >
        <h2
          id="rating-guide-mechanics"
          className="text-2xl font-semibold text-[color:var(--foreground)] sm:text-3xl"
        >
          {copy.mechanics.title}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 app-muted sm:text-base sm:leading-8">
          {copy.mechanics.description}
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {copy.mechanics.items.map((item) => (
            <MechanicCard key={item.name} name={item.name} text={item.text} Icon={item.Icon} />
          ))}
        </div>
      </section>

      {/* Badges + Boards */}
      <section className="mt-6 grid gap-4 sm:mt-8 lg:grid-cols-2">
        <article
          className="rounded-[2rem] app-card p-6 sm:p-8"
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
              className="text-xl font-semibold text-[color:var(--foreground)] sm:text-2xl"
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
          className="rounded-[2rem] app-card p-6 sm:p-8"
          aria-labelledby="rating-guide-boards"
        >
          <h2
            id="rating-guide-boards"
            className="text-xl font-semibold text-[color:var(--foreground)] sm:text-2xl"
          >
            {copy.boards.title}
          </h2>
          <p className="mt-3 text-sm leading-7 app-muted">{copy.boards.description}</p>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {copy.boards.items.map((item) => {
              const Icon = item.Icon;
              return (
                <li key={item.name} className="rounded-[1.25rem] app-panel p-4">
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
        className="mt-6 rounded-[2rem] border border-rose-400/30 bg-rose-500/5 p-6 sm:mt-8 sm:p-10"
        aria-labelledby="rating-guide-anti"
      >
        <h2
          id="rating-guide-anti"
          className="text-2xl font-semibold text-[color:var(--foreground)] sm:text-3xl"
        >
          {copy.antiPatterns.title}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 app-muted sm:text-base sm:leading-8">
          {copy.antiPatterns.description}
        </p>
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {copy.antiPatterns.bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex gap-3 rounded-[1.25rem] border border-rose-400/20 bg-[color:var(--surface)] p-4 text-sm leading-6 app-muted"
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
      </section>

      {/* Outro */}
      <section
        className="mt-6 rounded-[2rem] app-card p-6 text-center sm:mt-8 sm:p-12"
        aria-labelledby="rating-guide-outro"
      >
        <h2
          id="rating-guide-outro"
          className="text-2xl font-semibold text-[color:var(--foreground)] sm:text-3xl"
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
