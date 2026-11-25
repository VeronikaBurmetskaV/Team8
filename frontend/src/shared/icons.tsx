/**
 * Simple line icons of the buyer header, the feed and «Вподобане». Decorative: the link or button around an icon
 * carries the aria-label and title, so every SVG is aria-hidden.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

const HEART_PATH =
  "M12 20.5s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1Z";

export function HeartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d={HEART_PATH} />
    </Icon>
  );
}

/** A card with arrows to both sides: the swipe mechanic. */
export function SwipeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="8" y="4" width="8" height="12" rx="1.5" />
      <path d="M5 20h14M5 20l2-2M5 20l2 2M19 20l-2-2M19 20l-2 2" />
    </Icon>
  );
}

export function CartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5.5 8h13l-1 12h-11l-1-12Z" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" />
    </Icon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Icon>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21s-6-5.6-6-10.5a6 6 0 0 1 12 0C18 15.4 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m7 10 5 5 5-5" />
    </Icon>
  );
}

export function BurgerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

/** ↻ — flip the product card. */
export function RotateIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4h-4" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Icon>
  );
}

export function QuestionIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.5a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2.9-1.2 1.8v.5" />
      <path d="M12 17h.01" />
    </Icon>
  );
}

/** Three sliders: the «Фільтри» button of the catalogue. */
export function FiltersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8M4 12h2M10 12h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
      <circle cx="8" cy="12" r="2" />
    </Icon>
  );
}

/** An open eye: «Показати пароль». */
export function EyeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

/** A crossed-out eye: the password is shown. */
export function EyeOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M4 4l16 16" />
    </Icon>
  );
}
