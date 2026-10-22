// Copy for the /projects/type/<kind> landing pages: the page title and the
// longer explainer under the listing. The one-line lead under the title is
// the kind hint from the forms dictionary (getProjectKindHint), shared with
// the kind picker in the project form. Server-only — kept out of the
// dictionary so the long text never ships in client bundles.

import type { GuideBlock } from "@/components/guide-section";
import type { Locale } from "@/lib/i18n/config";
import type { PublicProjectKind } from "@/lib/projects";

type KindCopy = {
  /** H1 of the page. */
  title: string;
  /** <title>, before the site-wide "| SearchTalent" suffix. */
  seoTitle: string;
  guideTitle: string;
  includes: string;
  show: string[];
  hiring: string;
};

const sharedCopy = {
  en: {
    includes: "What belongs here",
    show: "What to show in your project",
    hiring: "If you're looking for a specialist",
    addProject: "Add your project",
  },
  uk: {
    includes: "Що сюди входить",
    show: "Що показати у своєму проєкті",
    hiring: "Якщо шукаєте фахівця",
    addProject: "Додати свій проєкт",
  },
} satisfies Record<Locale, Record<string, string>>;

const kindCopy = {
  en: {
    code: {
      title: "Development projects",
      seoTitle: "Development projects — developer portfolios",
      guideTitle: "About development projects",
      includes:
        "Anything built with code: websites and web apps, mobile and desktop apps, games, bots, APIs, libraries, browser extensions, automation scripts. A side project counts as much as a commercial one — what matters is that it's clear what you built.",
      show: [
        "A live demo or a store link, so the project can be tried in a minute.",
        "The repository. If the code is on GitHub or GitLab, import it — the description, languages and stats come in on their own.",
        "The stack and architecture: language, database, where it runs.",
        "Your role and your part, if you worked in a team.",
      ],
      hiring:
        "Look at how finished the work is rather than how many technologies are listed: does the demo work, is there a README, does the author explain their choices. One project taken all the way says more than ten half-done ones.",
    },
    design: {
      title: "Design projects",
      seoTitle: "Design projects — designer portfolios",
      guideTitle: "About design projects",
      includes:
        "Website and app interfaces, UX research, logos and brand identity, design systems, illustration, icons, packaging and print. Concepts and redesigns made for yourself belong here too.",
      show: [
        "A few screens or layouts in high quality — the cover decides whether the project gets opened.",
        "The task: who it was for and what had to be solved.",
        "The process: sketches, options, the prototype — not just the final picture.",
        "Links to Figma, Behance or Dribbble and what you delivered: a logo, a UI kit, a landing page and so on.",
      ],
      hiring:
        "Notice whether the designer explains why it looks the way it does. A pretty picture without a task is a showcase; a case with a problem, a solution and a result shows how the person thinks.",
    },
    video: {
      title: "Video & animation",
      seoTitle: "Video & animation — editor and animator portfolios",
      guideTitle: "About video and animation",
      includes:
        "Anything that moves on screen: editing, music videos, ads, short and feature films, vlogs, social clips, edits. Animation lives here too — motion design, animated logos, explainers, UI and character animation.",
      show: [
        "The video itself — uploaded, or a YouTube or Vimeo link, so it plays right on the page.",
        "Your role: editing, color, motion, VFX, sound, directing.",
        "Genre, length and resolution.",
        "Tools — Premiere, DaVinci, After Effects, Blender or others.",
      ],
      hiring:
        "Watch the first few seconds: pacing, sound and color show up right away. If a team worked on the project, check which part the author marked as theirs.",
    },
    photo: {
      title: "Photography projects",
      seoTitle: "Photography projects — photographer portfolios",
      guideTitle: "About photography projects",
      includes:
        "Portrait, product, fashion, wedding, event, street, architecture and landscape photography. A project is a series — one shoot, theme or commission — not a random set of shots.",
      show: [
        "The best frames of the series in full quality — fewer is better than repeats.",
        "The genre and your role: shooting, retouching, art direction.",
        "Camera, film or phone, and the editing software.",
        "The location and the client, if it isn't a secret.",
      ],
      hiring:
        "Look at how consistent the series is: the same level of light, color and retouching from the first frame to the last. That's what separates a steady photographer from a few lucky shots.",
    },
    "3d": {
      title: "3D projects",
      seoTitle: "3D projects — 3D artist portfolios",
      guideTitle: "About 3D projects",
      includes:
        "Models, characters, environments, product and architectural visualization, sculpting, game assets. Realistic, stylized or low-poly — it all goes here.",
      show: [
        "Final renders from a few angles.",
        "The wireframe and textures, if the model is for games or animation.",
        "A Sketchfab or Spline link — the model can then be turned around right on the page.",
        "Software and render engine: Blender, Maya, ZBrush, Cycles, Redshift and so on.",
      ],
      hiring:
        "Beyond the final render, look for the wireframe and textures — they show whether the model is ready for production or is just a nice picture.",
    },
    audio: {
      title: "Music & sound",
      seoTitle: "Music & sound — composer and sound designer portfolios",
      guideTitle: "About music and sound projects",
      includes:
        "Tracks and albums, film and game soundtracks, sound design, foley, mixing and mastering, arrangement, vocals.",
      show: [
        "A SoundCloud or Spotify link — the track can then be played right on the page.",
        "Your role: composing, production, mixing, mastering.",
        "Genre, tempo and key.",
        "The DAW you worked in.",
      ],
      hiring:
        "Listen on headphones and compare a few of the author's works: different genres show range, an equally clean mix shows skill.",
    },
    qa: {
      title: "QA & testing projects",
      seoTitle: "QA & testing projects — QA engineer portfolios",
      guideTitle: "About QA projects",
      includes:
        "Manual and automated testing; API, performance, security and accessibility testing; test plans and test cases. A practice project — say, testing a well-known website — works too.",
      show: [
        "What you tested and why: the product, the scope, the risks.",
        "Test types and tools — Postman, Playwright, Cypress, JMeter and others.",
        "Numbers: test cases, bugs found, automation coverage.",
        "A link to the report, the test plan or the repository with autotests. Remove anything confidential.",
      ],
      hiring:
        "Look at how the author describes bugs and risks: a clear report and a thought-out strategy count for more than a long list of tools.",
    },
    writing: {
      title: "Writing",
      seoTitle: "Writing — copywriter and technical writer portfolios",
      guideTitle: "About writing projects",
      includes:
        "Articles, blog posts, documentation, case studies, newsletters, scripts, copywriting, UX copy and translations — texts you wrote for clients or other publications. To write an article right on SearchTalent, use the Articles section.",
      show: [
        "A link to the published text.",
        "Format, topic and language.",
        "Your role: author, editor, translator, proofreader.",
        "Scope and outcome — reach, conversion or the client's feedback, if you know them.",
      ],
      hiring:
        "Read the first paragraph: it shows whether the author gets to the point. For technical texts, look at the structure and the examples.",
    },
  },
  uk: {
    code: {
      title: "Проєкти з розробки",
      seoTitle: "Проєкти з розробки — портфоліо розробників",
      guideTitle: "Про проєкти з розробки",
      includes:
        "Усе, що зроблено кодом: сайти й вебзастосунки, мобільні та десктопні програми, ігри, боти, API, бібліотеки, розширення для браузера, скрипти автоматизації. Пет-проєкт рахується так само, як комерційний, — головне, щоб було видно, що саме зробили ви.",
      show: [
        "Посилання на живе демо або застосунок у магазині — щоб проєкт можна було спробувати за хвилину.",
        "Репозиторій. Якщо код на GitHub чи GitLab, імпортуйте його — опис, мови й статистика підтягнуться самі.",
        "Стек і архітектуру: мову, базу даних, де все працює.",
        "Свою роль і внесок, якщо працювали в команді.",
      ],
      hiring:
        "Дивіться не на кількість технологій, а на завершеність: чи працює демо, чи є README, чи пояснює автор свої рішення. Один доведений до кінця проєкт каже більше, ніж десяток недороблених.",
    },
    design: {
      title: "Дизайн-проєкти",
      seoTitle: "Дизайн-проєкти — портфоліо дизайнерів",
      guideTitle: "Про дизайн-проєкти",
      includes:
        "Інтерфейси сайтів і застосунків, UX-дослідження, логотипи й айдентика, дизайн-системи, ілюстрації, іконки, упаковка й поліграфія. Концепти й редизайни, зроблені для себе, теж сюди.",
      show: [
        "Кілька екранів чи макетів у високій якості — від обкладинки залежить, чи відкриють проєкт.",
        "Задачу: для кого це і що треба було вирішити.",
        "Процес: ескізи, варіанти, прототип — не лише фінальну картинку.",
        "Посилання на Figma, Behance чи Dribbble і що саме ви здали: логотип, UI-кіт, лендинг тощо.",
      ],
      hiring:
        "Зверніть увагу, чи пояснює дизайнер, чому зроблено саме так. Гарна картинка без задачі — це вітрина, а кейс із проблемою, рішенням і результатом показує, як людина думає.",
    },
    video: {
      title: "Відео й анімація",
      seoTitle: "Відео й анімація — портфоліо монтажерів і аніматорів",
      guideTitle: "Про відео й анімацію",
      includes:
        "Усе, що рухається на екрані: монтаж, кліпи, реклама, короткий і повний метр, влоги, ролики для соцмереж, едіти. Анімація теж тут — моушн-дизайн, анімовані логотипи, пояснювальні ролики, анімація інтерфейсів і персонажів.",
      show: [
        "Саме відео — завантажене або посилання на YouTube чи Vimeo, щоб його можна було переглянути на сторінці.",
        "Свою роль: монтаж, колір, моушн, VFX, звук, режисура.",
        "Жанр, тривалість і роздільну здатність.",
        "Інструменти — Premiere, DaVinci, After Effects, Blender чи інші.",
      ],
      hiring:
        "Перегляньте перші секунди: темп, звук і колір видно одразу. Якщо над проєктом працювала команда, дивіться, яку частину автор позначив як свою.",
    },
    photo: {
      title: "Фотопроєкти",
      seoTitle: "Фотопроєкти — портфоліо фотографів",
      guideTitle: "Про фотопроєкти",
      includes:
        "Портретна, предметна, фешн-, весільна, репортажна, вулична, архітектурна й пейзажна зйомка. Проєкт — це серія: одна зйомка, тема чи замовлення, а не випадкова добірка кадрів.",
      show: [
        "Найкращі кадри серії в повній якості — краще менше, але без повторів.",
        "Жанр і свою роль: зйомка, ретуш, арт-дирекшн.",
        "Камеру, плівку чи телефон і програми для обробки.",
        "Місце й замовника, якщо це не секрет.",
      ],
      hiring:
        "Дивіться, чи цілісна серія: той самий рівень світла, кольору й ретуші від першого кадру до останнього. Саме це відрізняє стабільного фотографа від кількох вдалих знімків.",
    },
    "3d": {
      title: "3D-проєкти",
      seoTitle: "3D-проєкти — портфоліо 3D-художників",
      guideTitle: "Про 3D-проєкти",
      includes:
        "Моделі, персонажі, оточення, предметна й архітектурна візуалізація, скульптинг, ассети для ігор. Реалістичні, стилізовані чи low-poly — усе сюди.",
      show: [
        "Фінальні рендери з кількох ракурсів.",
        "Сітку й текстури, якщо модель для ігор чи анімації.",
        "Посилання на Sketchfab або Spline — тоді модель можна покрутити прямо на сторінці.",
        "Програми й рушій рендеру: Blender, Maya, ZBrush, Cycles, Redshift тощо.",
      ],
      hiring:
        "Окрім фінального рендера, шукайте сітку й текстури — вони показують, чи модель готова до продакшену, чи це просто гарна картинка.",
    },
    audio: {
      title: "Музика й звук",
      seoTitle: "Музика й звук — портфоліо композиторів і саунд-дизайнерів",
      guideTitle: "Про музику й звук",
      includes:
        "Треки й альбоми, саундтреки до фільмів та ігор, звуковий дизайн, фоулі, зведення й мастеринг, аранжування, вокал.",
      show: [
        "Посилання на SoundCloud або Spotify — тоді трек можна послухати прямо на сторінці.",
        "Свою роль: композиція, продакшн, зведення, мастеринг.",
        "Жанр, темп і тональність.",
        "Програму (DAW), у якій працювали.",
      ],
      hiring:
        "Слухайте в навушниках і порівняйте кілька робіт автора: різні жанри показують діапазон, а однаково чисте зведення — рівень.",
    },
    qa: {
      title: "Проєкти з тестування",
      seoTitle: "Проєкти з тестування — портфоліо QA-інженерів",
      guideTitle: "Про проєкти з тестування",
      includes:
        "Ручне й автоматизоване тестування; тестування API, швидкодії, безпеки й доступності; тест-плани й тест-кейси. Навчальний проєкт — наприклад, тестування відомого сайту — теж підходить.",
      show: [
        "Що тестували і навіщо: продукт, обсяг, ризики.",
        "Види тестування й інструменти — Postman, Playwright, Cypress, JMeter тощо.",
        "Цифри: тест-кейси, знайдені баги, покриття автотестами.",
        "Посилання на звіт, тест-план чи репозиторій з автотестами. Конфіденційне приберіть.",
      ],
      hiring:
        "Дивіться, як автор описує баги й ризики: чіткий звіт і продумана стратегія важать більше за довгий список інструментів.",
    },
    writing: {
      title: "Тексти",
      seoTitle: "Тексти — портфоліо копірайтерів і технічних письменників",
      guideTitle: "Про текстові проєкти",
      includes:
        "Статті, блог-пости, документація, кейси, розсилки, сценарії, копірайтинг, UX-тексти й переклади — тексти, які ви написали для клієнтів чи інших видань. Якщо хочете написати статтю прямо на SearchTalent, для цього є розділ «Статті».",
      show: [
        "Посилання на опублікований текст.",
        "Формат, тему й мову.",
        "Свою роль: автор, редактор, перекладач, коректор.",
        "Обсяг і результат — охоплення, конверсію чи відгук замовника, якщо знаєте.",
      ],
      hiring:
        "Прочитайте перший абзац: він показує, чи вміє автор одразу перейти до суті. У технічних текстах дивіться на структуру й приклади.",
    },
  },
} satisfies Record<Locale, Record<PublicProjectKind, KindCopy>>;

export function getProjectKindGuide(locale: Locale, kind: PublicProjectKind) {
  const copy: KindCopy = kindCopy[locale][kind];
  const shared = sharedCopy[locale];
  const blocks: GuideBlock[] = [
    { heading: shared.includes, paragraphs: [copy.includes] },
    { heading: shared.show, items: copy.show },
    { heading: shared.hiring, paragraphs: [copy.hiring] },
  ];

  return {
    title: copy.title,
    seoTitle: copy.seoTitle,
    guideTitle: copy.guideTitle,
    blocks,
    addProjectLabel: shared.addProject,
  };
}
