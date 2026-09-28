"use client";

import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
  Ref,
} from "react";
import {
  buttonStyles,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/button-styles";
import LocalizedLink from "@/components/ui/localized-link";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** React 19 passes `ref` as a prop; it reaches the <button> via the spread. */
  ref?: Ref<HTMLButtonElement>;
};

export function Button({
  children,
  className,
  size,
  type = "button",
  variant,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles({ variant, size, className })}
      {...props}
    >
      {children}
    </button>
  );
}

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function ButtonLink({
  children,
  className,
  href,
  size,
  variant,
  ...props
}: ButtonLinkProps) {
  return (
    <LocalizedLink
      href={href}
      className={buttonStyles({ variant, size, className })}
      {...props}
    >
      {children}
    </LocalizedLink>
  );
}
