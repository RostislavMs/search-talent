import type { BadgeKey } from "@/lib/constants/badges";

type IconProps = {
  className?: string;
};

function Rocket({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M14.5 4.5c2.5-2.5 6-2 6-2s.5 3.5-2 6l-1.5 1.5-4-4L14.5 4.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="m13 6-3-1c-1 0-2 .5-3 1.5l-2 2 3 1m6 6 1 3-2 2c-1 1-2 1.5-3 1.5l-1-3m-3-3 6 6m-6-6L4 14l1 4 4 1 3-3m1-7 4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Feather({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5l6.74-6.76Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M16 8 2 22M17.5 15H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Target({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

function ChatBubble({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 5.5C4 4.67 4.67 4 5.5 4h13c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5H10l-4 4v-4H5.5C4.67 16 4 15.33 4 14.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 9h8M8 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Heart({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 20.5s-7.5-4.5-9.5-9.5C1.5 8 3.5 5 6.5 5c2 0 3.6 1 5.5 3 1.9-2 3.5-3 5.5-3 3 0 5 3 4 6-2 5-9.5 9.5-9.5 9.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Megaphone({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M3 11v2a2 2 0 0 0 2 2h2l4 4V5L7 9H5a2 2 0 0 0-2 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M16 6c2 1.5 3 3.5 3 6s-1 4.5-3 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M14 9c.8.7 1.3 1.8 1.3 3s-.5 2.3-1.3 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Medal({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="m7 3 3 6m7-6-3 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="m9.5 8.5 1.6-3.2c.2-.4.5-.8.9-.8h2c.4 0 .7.4.9.8L16.5 8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="15" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="15" r="2.5" fill="currentColor" />
    </svg>
  );
}

function Trophy({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M7 4h10v5a5 5 0 0 1-10 0V4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M7 6H5a2 2 0 0 0-2 2v1a3 3 0 0 0 3 3h1M17 6h2a2 2 0 0 1 2 2v1a3 3 0 0 1-3 3h-1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M9 21h6M12 14v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Crown({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M3 8 7 13 12 6l5 7 4-5v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="3" cy="8" r="1.2" fill="currentColor" />
      <circle cx="21" cy="8" r="1.2" fill="currentColor" />
      <circle cx="12" cy="6" r="1.2" fill="currentColor" />
    </svg>
  );
}

function CheckShield({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 3 4 6v6c0 4.5 3.5 8 8 9 4.5-1 8-4.5 8-9V6l-8-3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="m8.5 12 2.5 2.5L16 9.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GithubLogo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 1.5a10.5 10.5 0 0 0-3.32 20.47c.53.1.72-.23.72-.5v-1.74c-2.92.63-3.54-1.41-3.54-1.41-.48-1.22-1.17-1.54-1.17-1.54-.96-.65.07-.64.07-.64 1.06.07 1.61 1.09 1.61 1.09.94 1.6 2.46 1.14 3.06.87.09-.68.37-1.14.67-1.4-2.33-.27-4.79-1.16-4.79-5.18 0-1.14.4-2.08 1.07-2.81-.1-.27-.46-1.34.1-2.79 0 0 .87-.28 2.85 1.07a9.7 9.7 0 0 1 5.2 0c1.97-1.35 2.84-1.07 2.84-1.07.56 1.45.2 2.52.1 2.79.67.73 1.07 1.67 1.07 2.81 0 4.03-2.46 4.91-4.8 5.18.38.33.71.96.71 1.94v2.88c0 .28.19.61.73.51A10.5 10.5 0 0 0 12 1.5Z" />
    </svg>
  );
}

function Shield({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 3 4 6v6c0 4.5 3.5 8 8 9 4.5-1 8-4.5 8-9V6l-8-3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M9 13h6M12 10v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function Sprout({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 21v-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M12 13C12 9.5 9 7.5 4 7.5c0 4 2.5 6.5 8 5.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M12 11c0-3 2.5-5 7-5 0 3.5-2.5 5.8-7 5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EnvelopeCheck({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M3.5 7.5C3.5 6.67 4.17 6 5 6h14c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5H5c-.83 0-1.5-.67-1.5-1.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="m4 7 8 6 8-6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m9 13 2 2 3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Sparkle({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 3c.4 3.7 1.3 4.6 5 5-3.7.4-4.6 1.3-5 5-.4-3.7-1.3-4.6-5-5 3.7-.4 4.6-1.3 5-5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 14c.2 1.7.6 2.1 2.3 2.3-1.7.2-2.1.6-2.3 2.3-.2-1.7-.6-2.1-2.3-2.3 1.7-.2 2.1-.6 2.3-2.3Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarStar({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect
        x="4"
        y="5"
        width="16"
        height="15"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M4 9h16M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="m12 11.5 1.1 2.2 2.4.3-1.75 1.7.42 2.4L12 16.95 9.83 18.1l.42-2.4L8.5 14l2.4-.3L12 11.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ICON_MAP: Record<BadgeKey, (props: IconProps) => React.ReactElement> = {
  first_project: Rocket,
  storyteller: Feather,
  prolific: Target,
  conversationalist: ChatBubble,
  loved: Heart,
  community_voice: Megaphone,
  rising_star: Sparkle,
  top_100_all_time: Medal,
  top_10_monthly: Trophy,
  project_of_the_month: CalendarStar,
  hall_of_fame: Crown,
  verified_email: EnvelopeCheck,
  complete_profile: CheckShield,
  verified_github: GithubLogo,
  veteran: Shield,
  early_adopter: Sprout,
};

export default function BadgeIcon({
  badgeKey,
  className = "h-5 w-5",
}: {
  badgeKey: BadgeKey;
  className?: string;
}) {
  const Component = ICON_MAP[badgeKey] ?? Shield;
  return <Component className={className} />;
}
