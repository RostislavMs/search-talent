export const emailsCopy = {
  en: {
    newFollower: {
      subject: "{follower} started following you on Search Talent",
      greeting: "Hi {name},",
      intro:
        "{follower} {handle} just followed your profile and will be notified when you publish new projects or articles.",
      cta: "Open your profile",
      signature:
        "You are receiving this because you have a Search Talent profile.",
      manageNotifications: "Manage notifications",
    },
    moderation: {
      subject: "A moderation update about your content",
      greeting: "Hi {name},",
      removedIntro:
        "Your content has been removed by our moderation team and is no longer available on Search Talent.",
      restrictedIntro:
        "Your content has been restricted by our moderation team and is no longer publicly visible on Search Talent.",
      noteLabel: "Moderator note:",
      cta: "Review your content",
      signature:
        "You are receiving this because you have a Search Talent profile.",
      types: {
        article: "Article",
        project: "Project",
        profile: "Profile",
        poll: "Poll",
      },
    },
    companyVerification: {
      subject: "Your code for {company}: {code}",
      intro:
        "Someone from the “{company}” team on Search Talent asked to confirm this address to verify the company page ({host}).",
      codeLabel: "Your code",
      validity: "It works for 15 minutes.",
      ignore:
        "If you didn't ask for it, just ignore this email: nothing changes without the code.",
      signature: "Search Talent",
    },
    applicationReceived: {
      subject: "New application for “{vacancy}”",
      greeting: "Hi, {name}!",
      greetingNoName: "Hi!",
      intro: "{candidate} applied to “{vacancy}” at {company}.",
      body:
        "Their portfolio, message and contacts are on the applications page. People wait for an answer: even a short “no” is better than silence.",
      cta: "See the application",
      someone: "A candidate",
      signature:
        "You got this email because you're in the team of a company page on Search Talent.",
    },
    applicationStatus: {
      greeting: "Hi, {name}!",
      greetingNoName: "Hi!",
      cta: "My applications",
      signature: "You got this email because you applied to a vacancy on Search Talent.",
      shortlisted: {
        subject: "{company} would like to talk about “{vacancy}”",
        intro: "Good news: {company} liked your application to “{vacancy}” and would like to talk.",
        body: "Expect a message on Search Talent, an email or a call soon. Check that the contacts on your profile are up to date.",
      },
      rejected: {
        subject: "Your application to “{vacancy}”",
        intro: "Thank you for applying to “{vacancy}”. This time {company} chose other candidates.",
        body:
          "That's not a verdict on your work. Your portfolio stays on Search Talent, and other companies see it too.",
      },
      hired: {
        subject: "{company} chose you for “{vacancy}”",
        intro: "Congratulations! {company} chose you for “{vacancy}”.",
        body:
          "They'll tell you about the next steps. If the work makes a good project, add it to your portfolio afterwards.",
      },
    },
    jobAlert: {
      subject: {
        one: "{count} new vacancy for you",
        few: "{count} new vacancies for you",
        many: "{count} new vacancies for you",
        other: "{count} new vacancies for you",
      },
      greeting: "Hi, {name}!",
      greetingNoName: "Hi!",
      intro: "New vacancies from the searches you follow on Search Talent.",
      more: {
        one: "And {count} more",
        few: "And {count} more",
        many: "And {count} more",
        other: "And {count} more",
      },
      cta: "All job alerts",
      manage: "Job alerts",
      unsubscribe: "Stop these emails",
      footer:
        "You got this email because you follow vacancies on Search Talent. We only write when there's something new.",
      profileMatch: "Fit you",
    },
    newMessage: {
      subject: "{sender} wrote to you on Search Talent",
      greeting: "Hi, {name}!",
      greetingNoName: "Hi!",
      intro: "{sender} sent you a message.",
      introCompany: "{sender} wrote to you.",
      introRequest: "{sender} wants to talk and sent you a first message.",
      body: "The text is on the site. Reply there, so the whole conversation stays in one place.",
      cta: "Open the conversation",
      someone: "Someone",
      footer: "You got this email because the message is still unread. We write once per conversation until you open it.",
      settings: "Message settings",
    },
    messageDigest: {
      subject: {
        one: "{count} new message on Search Talent",
        few: "{count} new messages on Search Talent",
        many: "{count} new messages on Search Talent",
        other: "{count} new messages on Search Talent",
      },
      summary: {
        one: "You have {count} unread message.",
        few: "You have {count} unread messages.",
        many: "You have {count} unread messages.",
        other: "You have {count} unread messages.",
      },
      greeting: "Hi, {name}!",
      greetingNoName: "Hi!",
      from: "From {names}.",
      fromMore: "From {names} and {more}.",
      moreConversations: {
        one: "{count} more conversation",
        few: "{count} more conversations",
        many: "{count} more conversations",
        other: "{count} more conversations",
      },
      requests: "Requests from people you haven't talked to yet: {count}.",
      body: "The texts are on the site. Reply there, so the whole conversation stays in one place.",
      cta: "Open messages",
      footer: "You got this email because you chose message emails once a day.",
      settings: "Message settings",
    },
  },
  uk: {
    newFollower: {
      subject: "{follower} підписав(ла)ся на вас у Search Talent",
      greeting: "Привіт, {name}!",
      intro:
        "{follower} {handle} щойно підписав(ла)ся на ваш профіль і отримає сповіщення, коли ви опублікуєте нові проєкти або статті.",
      cta: "Відкрити ваш профіль",
      signature:
        "Ви отримали цей лист, тому що у вас є профіль у Search Talent.",
      manageNotifications: "Керувати сповіщеннями",
    },
    moderation: {
      subject: "Оновлення модерації щодо вашого контенту",
      greeting: "Привіт, {name}!",
      removedIntro:
        "Ваш контент прибрано нашою командою модерації, і він більше не доступний на Search Talent.",
      restrictedIntro:
        "Ваш контент обмежено нашою командою модерації, і він більше не показується публічно на Search Talent.",
      noteLabel: "Коментар модератора:",
      cta: "Переглянути ваш контент",
      signature:
        "Ви отримали цей лист, тому що у вас є профіль у Search Talent.",
      types: {
        article: "Стаття",
        project: "Проєкт",
        profile: "Профіль",
        poll: "Опитування",
      },
    },
    companyVerification: {
      subject: "Ваш код для {company}: {code}",
      intro:
        "Хтось із команди «{company}» на Search Talent попросив підтвердити цю адресу, щоб перевірити сторінку компанії ({host}).",
      codeLabel: "Ваш код",
      validity: "Він діє 15 хвилин.",
      ignore:
        "Якщо ви цього не просили, просто проігноруйте лист: без коду нічого не зміниться.",
      signature: "Search Talent",
    },
    applicationReceived: {
      subject: "Новий відгук на «{vacancy}»",
      greeting: "Привіт, {name}!",
      greetingNoName: "Привіт!",
      intro: "{candidate} відгукнувся(-лася) на вакансію «{vacancy}» у компанії {company}.",
      body:
        "Портфоліо, повідомлення й контакти кандидата — на сторінці відгуків. Люди чекають на відповідь: навіть коротке «ні» краще за мовчання.",
      cta: "Переглянути відгук",
      someone: "Кандидат",
      signature:
        "Ви отримали цей лист, бо ви в команді сторінки компанії на Search Talent.",
    },
    applicationStatus: {
      greeting: "Привіт, {name}!",
      greetingNoName: "Привіт!",
      cta: "Мої відгуки",
      signature: "Ви отримали цей лист, бо відгукнулися на вакансію на Search Talent.",
      shortlisted: {
        subject: "Компанія {company} хоче поговорити про «{vacancy}»",
        intro:
          "Гарна новина: ваш відгук на «{vacancy}» зацікавив компанію {company}, і з вами хочуть поговорити.",
        body: "Чекайте на повідомлення на Search Talent, лист чи дзвінок. Перевірте, чи актуальні контакти у вашому профілі.",
      },
      rejected: {
        subject: "Ваш відгук на «{vacancy}»",
        intro:
          "Дякуємо, що відгукнулися на «{vacancy}». Цього разу компанія {company} обрала інших кандидатів.",
        body:
          "Це не оцінка вашої роботи. Ваше портфоліо лишається на Search Talent, і його бачать інші компанії.",
      },
      hired: {
        subject: "Компанія {company} обрала вас на «{vacancy}»",
        intro: "Вітаємо! Компанія {company} обрала вас на «{vacancy}».",
        body:
          "Про наступні кроки вам розкажуть. Якщо робота вийде цікавою, згодом додайте її до портфоліо.",
      },
    },
    jobAlert: {
      subject: {
        one: "{count} нова вакансія для вас",
        few: "{count} нові вакансії для вас",
        many: "{count} нових вакансій для вас",
        other: "{count} нової вакансії для вас",
      },
      greeting: "Привіт, {name}!",
      greetingNoName: "Привіт!",
      intro: "Нові вакансії за пошуками, за якими ви стежите на Search Talent.",
      more: {
        one: "І ще {count}",
        few: "І ще {count}",
        many: "І ще {count}",
        other: "І ще {count}",
      },
      cta: "Усі підписки",
      manage: "Підписки на вакансії",
      unsubscribe: "Більше не надсилати",
      footer:
        "Ви отримали цей лист, бо стежите за вакансіями на Search Talent. Пишемо лише тоді, коли є щось нове.",
      profileMatch: "Вам підходять",
    },
    newMessage: {
      subject: "Нове повідомлення від {sender} на Search Talent",
      greeting: "Вітаємо, {name}!",
      greetingNoName: "Вітаємо!",
      intro: "Нове повідомлення від {sender}.",
      introCompany: "{sender} пише вам.",
      introRequest: "{sender} хоче поговорити й надсилає вам перше повідомлення.",
      body: "Текст — на сайті. Відповідайте там, щоб уся розмова була в одному місці.",
      cta: "Відкрити розмову",
      someone: "Хтось",
      footer: "Ви отримали цей лист, бо повідомлення досі непрочитане. Ми пишемо раз на розмову, доки ви її не відкриєте.",
      settings: "Налаштування повідомлень",
    },
    messageDigest: {
      subject: {
        one: "{count} нове повідомлення на Search Talent",
        few: "{count} нові повідомлення на Search Talent",
        many: "{count} нових повідомлень на Search Talent",
        other: "{count} нового повідомлення на Search Talent",
      },
      summary: {
        one: "У вас {count} непрочитане повідомлення.",
        few: "У вас {count} непрочитані повідомлення.",
        many: "У вас {count} непрочитаних повідомлень.",
        other: "У вас {count} непрочитаного повідомлення.",
      },
      greeting: "Вітаємо, {name}!",
      greetingNoName: "Вітаємо!",
      from: "Від: {names}.",
      fromMore: "Від: {names} та ще {more}.",
      moreConversations: {
        one: "{count} розмова",
        few: "{count} розмови",
        many: "{count} розмов",
        other: "{count} розмови",
      },
      requests: "Запитів від людей, з якими ви ще не листувалися: {count}.",
      body: "Тексти — на сайті. Відповідайте там, щоб уся розмова була в одному місці.",
      cta: "Відкрити повідомлення",
      footer: "Ви отримали цей лист, бо обрали листи про повідомлення раз на день.",
      settings: "Налаштування повідомлень",
    },
  },
} as const;
