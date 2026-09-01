/**
 * Иконки нарисованы здесь, а не подключены библиотекой: их девять штук,
 * а любой icon-пакет добавил бы к бандлу больше, чем весь этот файл.
 */
type IconProps = { className?: string };

function Svg({ children, className }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? "size-4 shrink-0"}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5 14 14" />
  </Svg>
);

export const ListIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 4h1M2 8h1M2 12h1M5.5 4H14M5.5 8H14M5.5 12H14" />
  </Svg>
);

export const GridIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="2" width="5" height="5" rx="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" />
  </Svg>
);

export const TableIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="3" width="12" height="10" rx="1.5" />
    <path d="M2 6.5h12M6.5 6.5V13" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m3 8.5 3.5 3.5L13 5" />
  </Svg>
);

export const PencilIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M11.5 2.5a1.7 1.7 0 0 1 2.4 2.4L5.5 13.3 2 14l.7-3.5z" />
  </Svg>
);

export const TagIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 8.2V3a.5.5 0 0 1 .5-.5h5.2a1 1 0 0 1 .7.3l4.6 4.6a1 1 0 0 1 0 1.4l-4.4 4.4a1 1 0 0 1-1.4 0L2.8 8.9a1 1 0 0 1-.3-.7Z" />
    <circle cx="5.6" cy="5.6" r=".9" />
  </Svg>
);

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.6 9.5a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9L12 4" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 3v10M3 8h10" />
  </Svg>
);

export const SettingsIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="2.3" />
    <path d="M8 1.5v1.6M8 12.9v1.6M14.5 8h-1.6M3.1 8H1.5M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1M12.6 12.6l-1.1-1.1M4.5 4.5 3.4 3.4" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Svg>
);
