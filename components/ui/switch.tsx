"use client";

/**
 * Тумблер: дорожка с бегунком.
 *
 * Отличается от галочки не только видом — он отвечает на вопрос «включено
 * или выключено сейчас», тогда как галочка отвечает «выбрано ли». Поэтому
 * роль switch, а не checkbox: скринридер объявит состояние правильно.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  className = "",
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  /** Обязателен: у тумблера без подписи нет доступного имени. */
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-55 ${
        checked ? "bg-accent" : "bg-line-strong"
      } ${className}`}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left] ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}
