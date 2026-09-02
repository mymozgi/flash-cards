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

/** Шестерня с восемью зубцами: прежний кружок с лучами читался как солнце. */
export const SettingsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.99 3.10L7.03 1.47L8.97 1.47L9.01 3.10L10.75 3.82L11.93 2.70L13.30 4.07L12.18 5.25L12.90 6.99L14.53 7.03L14.53 8.97L12.90 9.01L12.18 10.75L13.30 11.93L11.93 13.30L10.75 12.18L9.01 12.90L8.97 14.53L7.03 14.53L6.99 12.90L5.25 12.18L4.07 13.30L2.70 11.93L3.82 10.75L3.10 9.01L1.47 8.97L1.47 7.03L3.10 6.99L3.82 5.25L2.70 4.07L4.07 2.70L5.25 3.82Z" />
    <circle cx="8" cy="8" r="2.2" />
  </Svg>
);

/**
 * Раскрытие и сворачивание. Геометрия та же, что у chevron-down в Lucide и
 * Feather: угол 90°, вершина по центру. Рисуем сами, а не тянем библиотеку:
 * в наборе уже десять своих иконок одной толщины и сетки, и одна импортная
 * выбилась бы из ряда сильнее, чем стоит сэкономленное время.
 */
/** Гамбургер: три полосы одной длины, иначе читается как «сортировка». */
export const MenuIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
  </Svg>
);

export const ChevronIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m4 6.5 4 4 4-4" />
  </Svg>
);

/** Ручка перетаскивания: шесть точек, как принято для draggable-строк. */
export const GripIcon = (p: IconProps) => (
  <Svg {...p} >
    <path d="M6.2 3.5h.01M9.8 3.5h.01M6.2 8h.01M9.8 8h.01M6.2 12.5h.01M9.8 12.5h.01" strokeWidth="2.2" />
  </Svg>
);

export const SunIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="3.1" />
    <path d="M8 1.4v1.2M8 13.4v1.2M14.6 8h-1.2M2.6 8H1.4M12.7 3.3l-.85.85M4.15 11.85l-.85.85M12.7 12.7l-.85-.85M4.15 4.15l-.85-.85" />
  </Svg>
);

export const MoonIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.8 5.8 0 1 0 6.8 6.8Z" />
  </Svg>
);

/** Медиа: рамка, солнце и линия горизонта — общепринятый знак изображения. */
export const ImageIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="1.8" y="3" width="12.4" height="10" rx="1.6" />
    <circle cx="5.6" cy="6.5" r="1.1" />
    <path d="m2.4 11.4 3.1-2.9 2.4 2.2 2.3-2.6 3.5 3.7" />
  </Svg>
);

/** Шаг назад и шаг вперёд. Стержень во всю ширину, чтобы направление читалось
 *  и в размере 16, и когда иконка стоит одна в квадратной кнопке. */
export const ArrowLeftIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 8H3M6.5 4.5 3 8l3.5 3.5" />
  </Svg>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 8h10M9.5 4.5 13 8l-3.5 3.5" />
  </Svg>
);

/** Переворот: карточка со стрелкой внутри. Круговая стрелка читалась бы как
 *  «обновить», а здесь речь о другой стороне того же. */
export const FlipIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="3.5" width="12" height="9" rx="1.6" />
    <path d="M5.4 8h5.2M9.1 6.4 10.7 8 9.1 9.6" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Svg>
);
