import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckIcon, ChevronDownIcon } from "./icons";
import styles from "./Dropdown.module.css";

export type DropdownOption<T extends string> = {
  value: T;
  label: string;
};

/* ---------- State: pure, so the keyboard rules are tested without a DOM ---------- */

export type DropdownState = {
  open: boolean;
  /** The highlighted option (aria-activedescendant) while the list is open. */
  active: number;
};

export type DropdownEvent =
  | { type: "toggle" }
  | { type: "outside" }
  | { type: "hover"; index: number }
  | { type: "pick"; index: number }
  | { type: "key"; key: string };

export type DropdownStep = {
  state: DropdownState;
  /** An option was chosen: its index. */
  pick?: number;
  /** Move the focus back to the button. */
  focusButton?: boolean;
  /** The key was used by the dropdown: prevent its default and stop it here. */
  handled?: boolean;
};

const CLOSED: DropdownState = { open: false, active: -1 };

/**
 * One step of the dropdown. `count` is the number of options, `selected` the index of the
 * current value. Arrows do not wrap around (like a native select).
 */
export function dropdownStep(
  state: DropdownState,
  event: DropdownEvent,
  count: number,
  selected: number,
): DropdownStep {
  const openAt = { open: true, active: Math.max(selected, 0) };
  switch (event.type) {
    case "toggle":
      return { state: state.open ? CLOSED : openAt };
    case "outside":
      return { state: CLOSED };
    case "hover":
      return state.open
        ? { state: { open: true, active: event.index } }
        : { state };
    case "pick":
      return { state: CLOSED, pick: event.index, focusButton: true };
    case "key":
      break;
  }

  const { key } = event;
  if (!state.open) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(key)) {
      return { state: openAt, handled: true };
    }
    return { state };
  }

  const last = count - 1;
  switch (key) {
    case "ArrowDown":
      return {
        state: { open: true, active: Math.min(state.active + 1, last) },
        handled: true,
      };
    case "ArrowUp":
      return {
        state: { open: true, active: Math.max(state.active - 1, 0) },
        handled: true,
      };
    case "Home":
      return { state: { open: true, active: 0 }, handled: true };
    case "End":
      return { state: { open: true, active: last }, handled: true };
    case "Enter":
    case " ":
      return state.active >= 0 && state.active <= last
        ? {
            state: CLOSED,
            pick: state.active,
            focusButton: true,
            handled: true,
          }
        : { state: CLOSED, focusButton: true, handled: true };
    case "Escape":
      return { state: CLOSED, focusButton: true, handled: true };
    case "Tab":
      // The focus moves on as usual; the list just closes.
      return { state: CLOSED };
    default:
      return { state };
  }
}

/* ---------- Markup without hooks (read by the tests in node) ---------- */

type DropdownViewProps<T extends string> = {
  label: string;
  options: readonly DropdownOption<T>[];
  value: T;
  icon?: ReactNode;
  className?: string;
  buttonClassName?: string;
  listClassName?: string;
  state: DropdownState;
  ids: { label: string; button: string; list: string };
  reduceMotion: boolean;
  onEvent: (event: DropdownEvent, keyEvent?: KeyboardEvent) => void;
  rootRef?: Ref<HTMLDivElement>;
  buttonRef?: Ref<HTMLButtonElement>;
  listRef?: Ref<HTMLUListElement>;
};

function optionId(listId: string, index: number) {
  return `${listId}-option-${index}`;
}

export function DropdownView<T extends string>({
  label,
  options,
  value,
  icon,
  className,
  buttonClassName,
  listClassName,
  state,
  ids,
  reduceMotion,
  onEvent,
  rootRef,
  buttonRef,
  listRef,
}: DropdownViewProps<T>) {
  const current = options.find((option) => option.value === value);
  return (
    <div
      ref={rootRef}
      className={className ? `${styles.root} ${className}` : styles.root}
    >
      <span id={ids.label} className={styles.visuallyHidden}>
        {label}
      </span>
      <button
        ref={buttonRef}
        id={ids.button}
        type="button"
        className={
          buttonClassName
            ? `${styles.button} ${buttonClassName}`
            : styles.button
        }
        title={label}
        aria-haspopup="listbox"
        aria-expanded={state.open}
        aria-controls={state.open ? ids.list : undefined}
        aria-labelledby={`${ids.label} ${ids.button}`}
        onClick={() => onEvent({ type: "toggle" })}
        onKeyDown={(event) => onEvent({ type: "key", key: event.key }, event)}
      >
        {icon}
        <span className={styles.value}>{current?.label ?? value}</span>
        <ChevronDownIcon className={styles.chevron} />
      </button>
      <AnimatePresence>
        {state.open && (
          <motion.ul
            ref={listRef}
            id={ids.list}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={ids.label}
            aria-activedescendant={
              state.active >= 0 ? optionId(ids.list, state.active) : undefined
            }
            className={
              listClassName ? `${styles.list} ${listClassName}` : styles.list
            }
            initial={reduceMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={
              reduceMotion
                ? { opacity: 0, transition: { duration: 0 } }
                : { opacity: 0, y: -4 }
            }
            transition={{ duration: 0.14, ease: "easeOut" }}
            onKeyDown={(event) =>
              onEvent({ type: "key", key: event.key }, event)
            }
          >
            {options.map((option, index) => {
              const selected = option.value === value;
              const classes = [styles.option];
              if (index === state.active) classes.push(styles.active);
              if (selected) classes.push(styles.selected);
              return (
                <li
                  key={option.value}
                  id={optionId(ids.list, index)}
                  role="option"
                  aria-selected={selected}
                  className={classes.join(" ")}
                  onPointerMove={() => onEvent({ type: "hover", index })}
                  onClick={() => onEvent({ type: "pick", index })}
                >
                  <span className={styles.check} aria-hidden="true">
                    {selected && <CheckIcon />}
                  </span>
                  {option.label}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- The component ---------- */

type DropdownProps<T extends string> = {
  /** Name for screen readers (visually hidden) and the button's tooltip. */
  label: string;
  options: readonly DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Decorative icon before the value. */
  icon?: ReactNode;
  className?: string;
  /** The look of the button; the dropdown itself only lays it out. */
  buttonClassName?: string;
  listClassName?: string;
};

/**
 * A select that opens its list under the button (instead of the OS list over it).
 * ARIA: button with aria-haspopup="listbox" + listbox with options; the focus sits on the
 * list and aria-activedescendant names the highlighted option. Arrows, Home/End move,
 * Enter/Space choose, Esc and a click outside close; the focus goes back to the button.
 */
export function Dropdown<T extends string>({
  label,
  options,
  value,
  onChange,
  icon,
  className,
  buttonClassName,
  listClassName,
}: DropdownProps<T>) {
  const [state, setState] = useState<DropdownState>(CLOSED);
  const reduceMotion = useReducedMotion() ?? false;
  const baseId = useId();
  const ids = {
    label: `${baseId}-label`,
    button: `${baseId}-button`,
    list: `${baseId}-list`,
  };
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = options.findIndex((option) => option.value === value);

  function apply(step: DropdownStep) {
    setState(step.state);
    if (step.pick !== undefined) {
      const option = options[step.pick];
      if (option && option.value !== value) onChange(option.value);
    }
    if (step.focusButton) buttonRef.current?.focus();
  }

  function onEvent(event: DropdownEvent, keyEvent?: KeyboardEvent) {
    const step = dropdownStep(state, event, options.length, selected);
    if (step.handled && keyEvent) {
      keyEvent.preventDefault();
      // Esc closes only this list, not the burger menu around it.
      keyEvent.stopPropagation();
    }
    apply(step);
  }

  // The open list takes the focus, so the arrow keys work right away.
  useEffect(() => {
    if (state.open) listRef.current?.focus({ preventScroll: true });
  }, [state.open]);

  useEffect(() => {
    if (!state.open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || rootRef.current?.contains(target))
        return;
      setState(CLOSED);
      // Give the focus back only if the click does not put it somewhere itself.
      const focusable =
        target instanceof Element &&
        target.closest("a, button, input, select, textarea, [tabindex]");
      if (!focusable) buttonRef.current?.focus({ preventScroll: true });
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [state.open]);

  return (
    <DropdownView
      label={label}
      options={options}
      value={value}
      icon={icon}
      className={className}
      buttonClassName={buttonClassName}
      listClassName={listClassName}
      state={state}
      ids={ids}
      reduceMotion={reduceMotion}
      onEvent={onEvent}
      rootRef={rootRef}
      buttonRef={buttonRef}
      listRef={listRef}
    />
  );
}
