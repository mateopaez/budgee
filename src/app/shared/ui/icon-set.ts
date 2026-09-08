/**
 * Original stroke icon set drawn in the open "24px grid, 2px round stroke"
 * style popularised by Lucide. The geometry here is authored for Budgee so the
 * app carries no third party brand or proprietary artwork.
 *
 * Each icon is a list of path definitions plus optional circles, which keeps
 * rendering to plain SVG elements with no HTML sanitiser bypass.
 */
export interface IconShape {
  readonly d?: readonly string[];
  readonly c?: readonly (readonly [number, number, number])[];
  /** Render filled instead of stroked. */
  readonly filled?: boolean;
}

export const ICONS = {
  jar: { d: ['M7 7h10', 'M8 4h8', 'M6 7h12v10a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z'] },
  sparkle: { d: ['M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z'] },
  eye: { d: ['M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z'], c: [[12, 12, 3]] },
  pie: { d: ['M12 3a9 9 0 1 0 9 9h-9z', 'M15 3.5A9 9 0 0 1 20.5 9h-5.5z'] },
  heart: { d: ['M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7-2.7c0 4.9-7 14.7-7 14.7z'] },
  briefcase: { d: ['M3 8h18v11H3z', 'M9 8V5h6v3', 'M3 13h18'] },
  bank: { d: ['M3 10h18', 'M12 3 3 8h18z', 'M6 10v7', 'M10 10v7', 'M14 10v7', 'M18 10v7', 'M3 20h18'] },
  wallet: { d: ['M3 7a2 2 0 0 1 2-2h12v4', 'M3 7v10a2 2 0 0 0 2 2h14V9H5a2 2 0 0 1-2-2z'], c: [[16.5, 14, 1.2]] },
  card: { d: ['M3 6h18v12H3z', 'M3 10h18'] },
  plus: { d: ['M12 5v14', 'M5 12h14'] },
  minus: { d: ['M5 12h14'] },
  check: { d: ['M4 12.5 9.5 18 20 6.5'] },
  x: { d: ['M6 6l12 12', 'M18 6 6 18'] },
  chevronLeft: { d: ['M15 5 8 12l7 7'] },
  chevronRight: { d: ['M9 5l7 7-7 7'] },
  chevronUp: { d: ['M5 15l7-7 7 7'] },
  chevronDown: { d: ['M5 9l7 7 7-7'] },
  arrowLeft: { d: ['M20 12H4', 'M10 6 4 12l6 6'] },
  swap: { d: ['M4 8h13l-3-3', 'M20 16H7l3 3'] },
  gear: { d: ['M12 3.5 13.4 6l2.8-.4.9 2.7 2.4 1.5-1 2.7 1 2.7-2.4 1.5-.9 2.7-2.8-.4L12 21.5 10.6 19l-2.8.4-.9-2.7L4.5 15.2l1-2.7-1-2.7 2.4-1.5.9-2.7 2.8.4z'], c: [[12, 12.5, 2.6]] },
  calendar: { d: ['M4 6h16v15H4z', 'M4 11h16', 'M8 3v5', 'M16 3v5'] },
  repeat: { d: ['M4 10a5 5 0 0 1 5-5h9l-3-3', 'M20 14a5 5 0 0 1-5 5H6l3 3'] },
  trash: { d: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 14h10l1-14', 'M10 11v6', 'M14 11v6'] },
  search: { d: ['M20 20l-4.2-4.2'], c: [[11, 11, 6]] },
  pencil: { d: ['M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z', 'M14.5 6.5l3 3'] },
  home: { d: ['M4 11 12 4l8 7', 'M6 10v10h12V10', 'M10 20v-5h4v5'] },
  utensils: { d: ['M6 3v8a2 2 0 0 0 4 0V3', 'M8 11v10', 'M17 3c-1.5 1.5-2 3-2 5.5V12h4V8.5C19 6 18.5 4.5 17 3z', 'M17 12v9'] },
  cup: { d: ['M5 8h11v6a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z', 'M16 10h2.5a2.5 2.5 0 0 1 0 5H16', 'M4 21h13'] },
  cart: { d: ['M3 5h2.2l2.3 10h10l2.2-7H6.5'], c: [[9.5, 19, 1.4], [17, 19, 1.4]] },
  car: { d: ['M4 16v3', 'M20 16v3', 'M3 15l1.6-5.2A3 3 0 0 1 7.5 8h9a3 3 0 0 1 2.9 1.8L21 15v2H3z', 'M6.5 12h11'] },
  fuel: { d: ['M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16', 'M3 21h12', 'M6 9h6', 'M14 9h3v7a2 2 0 0 0 3 0V8l-3-3'] },
  parking: { d: ['M10 17V7h3.2a3 3 0 0 1 0 6H10'], c: [[12, 12, 9]] },
  wifi: { d: ['M3.5 9a13 13 0 0 1 17 0', 'M6.5 12.4a9 9 0 0 1 11 0', 'M9.5 15.7a5 5 0 0 1 5 0'], c: [[12, 19, 1.1]] },
  film: { d: ['M4 5h16v14H4z', 'M9 5v14', 'M15 5v14'] },
  play: { d: ['M4 5h16v14H4z', 'M11 9.5l4 2.5-4 2.5z'] },
  music: { d: ['M9 18V6l10-2v12'], c: [[7, 18, 2], [17, 16, 2]] },
  zap: { d: ['M13 3 5 14h6l-1 7 8-11h-6z'] },
  dumbbell: { d: ['M3 10v4', 'M21 10v4', 'M6 7v10', 'M18 7v10', 'M6 12h12'] },
  pill: { d: ['M8.5 15.5 15.5 8.5', 'M9 3.5a4.6 4.6 0 0 1 6.5 6.5l-5 5A4.6 4.6 0 0 1 4 8.5z'] },
  banknote: { d: ['M3 7h18v10H3z'], c: [[12, 12, 2.6]] },
  piggy: { d: ['M4 12a6 6 0 0 1 6-6h3l3-2v3a6 6 0 0 1 2 4h2v4h-2.2A6 6 0 0 1 15 18v2h-3v-1.4h-2V20H7v-2a6 6 0 0 1-3-6z'], c: [[9, 11.5, 0.9]] },
  bag: { d: ['M4 8h16l-1.2 12H5.2z', 'M8.5 8V6a3.5 3.5 0 0 1 7 0v2'] },
  shirt: { d: ['M8 3 4 5.5 6 10l2-1v12h8V9l2 1 2-4.5L16 3l-2 2h-4z'] },
  graduation: { d: ['M2 9 12 5l10 4-10 4z', 'M6 11v5c0 1.6 2.7 3 6 3s6-1.4 6-3v-5'] },
  box: { d: ['M4 7h16v13H4z', 'M4 11h16', 'M10 7V4h4v3'] },
  folder: { d: ['M3 6h6l2 2.5h10V19H3z'] },
  bell: { d: ['M6 16V11a6 6 0 1 1 12 0v5l2 3H4z', 'M10 21h4'] },
  fileDown: { d: ['M6 3h8l4 4v14H6z', 'M14 3v4h4', 'M12 11v6', 'M9.5 14.5 12 17l2.5-2.5'] },
  refresh: { d: ['M20 6v5h-5', 'M4 18v-5h5', 'M19.2 11A7.5 7.5 0 0 0 6 8.4', 'M4.8 13a7.5 7.5 0 0 0 13.2 2.6'] },
  message: { d: ['M4 5h16v11H10l-4 4v-4H4z'] },
  star: { d: ['m12 4 2.5 5.2 5.5.8-4 3.9 1 5.6L12 16.9 7 19.5l1-5.6-4-3.9 5.5-.8z'] },
  help: { d: ['M9.4 9.2A2.7 2.7 0 0 1 14.6 10c0 1.9-2.6 2.2-2.6 4', 'M12 17.5v.5'], c: [[12, 12, 9]] },
  user: { d: ['M4.5 20a7.5 7.5 0 0 1 15 0'], c: [[12, 8, 4]] },
  tag: { d: ['M3 11V4h7l10 10-7 7z'], c: [[7.5, 7.5, 1.2]] },
  trend: { d: ['M4 16l5-5 3.5 3.5L20 7', 'M15 7h5v5'] },
  list: { d: ['M9 6h11', 'M9 12h11', 'M9 18h11', 'M4.5 6h.01', 'M4.5 12h.01', 'M4.5 18h.01'] },
  link: { d: ['M10 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7L11 6.9', 'M14 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.6-1.6'] },
  lock: { d: ['M6 11h12v9H6z', 'M9 11V8a3 3 0 0 1 6 0v3'] },
  gift: { d: ['M3 11h18v9H3z', 'M3 8h18v3H3z', 'M12 8v12', 'M12 8C10 8 7.5 7 7.5 5.5S9.5 3.5 12 8z', 'M12 8c2 0 4.5-1 4.5-2.5S14.5 3.5 12 8z'] },
  plane: { d: ['M3 13.5 21 5l-6.5 15-2.6-5.6z'] },
  phone: { d: ['M8 3h8v18H8z', 'M10.5 18.5h3'] },
  cloud: { d: ['M7 18a4 4 0 0 1 .6-8A5.5 5.5 0 0 1 18 11.2 3.5 3.5 0 0 1 17.5 18z'] },
  scissors: { d: ['M7 7l10 10', 'M17 7 10.5 13.5'], c: [[6, 18, 2.2], [18, 18, 2.2]] },
  clipboard: { d: ['M6 5h12v16H6z', 'M9 5V3h6v2', 'M9 11h6', 'M9 15h6'] },
  filter: { d: ['M4 5h16l-6 7v6l-4 2v-8z'] },
  eyeOff: { d: ['M4 4l16 16', 'M9.5 9.6a3 3 0 0 0 4.2 4.2', 'M6.6 6.8C3.9 8.4 2 12 2 12s3.6 6 10 6a10 10 0 0 0 4.2-.9', 'M9.8 6.3A10.6 10.6 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.3 3.9'] },
  grip: { d: ['M5 9h14', 'M5 13h14', 'M5 17h14'] },
} as const satisfies Record<string, IconShape>;

export type IconName = keyof typeof ICONS;

export function isIconName(value: string): value is IconName {
  return Object.prototype.hasOwnProperty.call(ICONS, value);
}
