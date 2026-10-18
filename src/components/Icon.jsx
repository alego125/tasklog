const paths = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  tasks: 'm4 6 2 2 4-4 M13 6h7 M4 13h3 M13 13h7 M4 20h3 M13 20h7',
  note: 'M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3 M10 14l1-4 9-9 3 3-9 9-4 1Z',
  calendar:
    'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  user: 'M20 21v-2a7 7 0 0 0-14 0v2 M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  chart: 'M3 3v18h18 M7 16v-5 M12 16V7 M17 16V3',
  plus: 'M12 5v14 M5 12h14',
  search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  chevron: 'm9 5 7 7-7 7',
  down: 'm6 9 6 6 6-6',
  up: 'm6 15 6-6 6 6',
  arrow: 'M5 12h14 m-7-7 7 7-7 7',
  more: 'M4 12h.01 M12 12h.01 M20 12h.01',
  edit: 'm16 3 5 5 M3 21l5-1L21 7a2.12 2.12 0 0 0-3-3L4 17l-1 4Z',
  trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  archive: 'M3 3h18v5H3z M5 8v13h14V8 M10 12h4',
  download: 'M12 3v12 m-5-5 5 5 5-5 M5 17v4h14v-4',
  upload: 'M12 15V3 m-5 5 5-5 5 5 M5 17v4h14v-4',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.93 4.93l1.42 1.42 M17.65 17.65l1.42 1.42 M4.93 19.07l1.42-1.42 M17.65 6.35l1.42-1.42',
  moon: 'M21 12.8A9 9 0 0 1 11.2 3 9 9 0 1 0 21 12.8Z',
  logout: 'M9 21H3V3h6 M9 12h12 m-5-5 5 5-5 5',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  close: 'm6 6 12 12 M6 18 18 6',
  check: 'm5 12 4 4L19 6',
  clock: 'M12 7v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  warning:
    'M12 8v5 M12 17h.01 M10 3 1 19a1 1 0 0 0 1 2h20a1 1 0 0 0 1-2L14 3a2 2 0 0 0-4 0Z',
  filter: 'M4 7h16 M7 12h10 M10 17h4',
  message: 'M21 11a8 8 0 0 1-8 8H7l-5 3V5a2 2 0 0 1 2-2h9a8 8 0 0 1 8 8Z',
  move: 'M4 6h16 m-4-4 4 4-4 4 M20 18H4 m4-4-4 4 4 4',
  folder: 'M3 7V4h6l2 3h10v13H3V7Z',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3 M5 10h14v12H5z',
  spark: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z',
}
export default function Icon({ name = 'grid', size = 18, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={paths[name] || paths.grid} />
    </svg>
  )
}
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-symbol">
        <Icon name="check" size={23} />
      </span>
      <span>Cursor</span>
    </span>
  )
}
