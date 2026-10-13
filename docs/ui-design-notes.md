# UI design notes

## Theme system
- Tokens live in `app/globals.css` (`:root` = light, `.dark` = dark) and are exposed to Tailwind via `@theme inline` (`bg-surface`, `text-muted`, `border-line`, ...). Components never use raw palette colors.
- Dark mode is class based: `@custom-variant dark (&:where(.dark, .dark *))`. `lib/theme.ts` holds the pre-paint script (inlined in `<head>` in `app/layout.tsx`, `suppressHydrationWarning` on `<html>`). Preference (`system` | `light` | `dark`) is stored in `localStorage["theme"]`; absent = system. `components/ThemeToggle.tsx` (sidebar footer) uses `useSyncExternalStore` and re-applies the class in a layout effect (Next docs: dev Strict Mode can reset `<html>` attributes). It also follows OS changes while on "system".
- Global `:focus-visible` ring uses the accent color.

## Tokens
| Token | Light | Dark | Use |
|---|---|---|---|
| background | #ffffff | #0e0e10 | list + reading pane canvas |
| surface | #f7f7f8 | #141417 | sidebar, right panel, subtle strips |
| raised | #ffffff | #1a1a1e | cards, inputs, buttons |
| line | #e6e6ea | #2a2a30 | borders, dividers |
| line-strong | #d2d2d9 | #3b3b44 | progress tracks |
| fg | #18181b | #ededf0 | text |
| muted | #63636d | #9b9ba7 | secondary text (>= 5:1 on all surfaces) |
| accent / accent-fg | #4f46e5 / #fff | #8b93fb / #0e0e1a | brand, active icon, links, in-progress |
| accent-soft | #eeeefd | #1f2036 | link hover tint |
| success | #15803d | #4ade80 | delivered, activity ok |
| warning | #b45309 | #fbbf24 | starred |
| danger | #dc2626 | #f87171 | errors |
| hover | #efeff2 | #1f1f24 | hover fill |
| selected | #e9e9fb | #24253d | selected row / active nav |

Contrast figures were estimated by hand, not with a checker; re-run an audit before shipping.

## Patterns and sources (Mobbin, web)
- Three-pane list/reading layout, unread dot + bold sender, muted snippet, subtle selected row: [Notion Mail](https://mobbin.com/screens/6cbf9d6c-b0d2-4d89-9ee5-57bbd6fec0cf), [Cloaked](https://mobbin.com/screens/beb7faeb-97cb-458b-ba8c-d64250917bff).
- Quiet tinted sidebar, rounded active item, small unread count, uppercase muted section headings: [Lemni](https://mobbin.com/screens/39cc2ad8-aa82-4186-8167-47448f13f35a), [Front](https://mobbin.com/screens/14b3fc53-9338-4509-9be5-144410980d64), [Superhuman Mail](https://mobbin.com/screens/794d4dae-d263-4883-a6e1-bdcce480ac8c).
- Right-hand panel of stacked cards separated by borders, not shadows; dark palette with restrained accent: [Vercel](https://mobbin.com/screens/5bb75d66-7572-4f2e-a229-ebc54627343b), [Dropbox Dash](https://mobbin.com/screens/458b9d77-3707-4234-b808-2cae5ad8d25c), [Intercom](https://mobbin.com/screens/b1a806f1-b212-45a8-b525-fea3fa01b961), [Asana](https://mobbin.com/screens/bd3c4830-b27a-49d5-bffa-2e1b55e701e1).
- Theme switch in the sidebar footer as compact segmented icons: Vercel (above); appearance options: [Profound](https://mobbin.com/screens/065209b0-8f6b-4c38-a0a7-56aa8cc0bfc9), [Cal.com](https://mobbin.com/screens/f561880a-1845-4179-904d-3c3aa8941090).
- Reading pane header with avatar, sender, recipient line, time, and icon action toolbar: Notion Mail, Cloaked, Front (above).
- Attachment chips (icon, name, size) on a muted fill: [Better Stack](https://mobbin.com/screens/76f87fea-775d-47e6-b97a-b2d234f6c46b).
- Activity page as a bordered list with status dot, event text, right-aligned timestamp: [Toggl Track](https://mobbin.com/screens/2deef352-1f6b-4757-a4c9-dcce106b0e6a), [1Password](https://mobbin.com/screens/d015635b-1d0a-4357-9281-2c863bf010de), [7shifts](https://mobbin.com/screens/39d6a081-1cd1-474a-91bc-81e63426ace9).
- Login: centered logo, one-line title, single Google button in a bordered card: [Plain](https://mobbin.com/screens/0e128434-2815-4d3b-b2ac-a40509fb572b).

## Decisions
- Email body stays on white in both themes (iframe with `color-scheme: light`, white background); only the chrome is themed.
- Shipment card structure is unchanged (top row, headline + 3-segment bar, tracking strip); only colors/borders were tokenized. Progress uses accent while in transit and success when delivered.
- Type: Geist, 14px base; page titles 24px semibold, pane titles 14-16px semibold, meta 12px.

## Not verified / later
- Authenticated pages were not viewed in a browser (no Google sign-in). Only `/login` HTML, the theme script, and the generated CSS were checked.
- No automated contrast audit; no visual regression tests.
- Mobile layout (sidebar collapse, single-pane mail) is not addressed.
- Keyboard shortcuts, compose, and search are out of scope.
- Tooltips are CSS-only (no collision handling); consider a popover primitive if more are added.
