/**
 * Every outbound link in the extension, in one place.
 *
 * Mirrors the registry the rest of the Degird extensions use (TabFold's
 * `links.js`), so a Degird-wide URL change is a one-line edit here rather than a
 * sweep through three surfaces' markup.
 */
export const APP_LINKS = {
  degirdHome: 'https://degird.com',
  degirdProducts: 'https://degird.com/products#extensions',
  /** TODO: point at ShotDock's own Web Store reviews page once it is published. */
  reviewUs: 'https://degird.com/products#extensions',
  moreTools: 'https://chromewebstore.google.com/search/degird',
  privacy:
    'https://docs.google.com/document/d/1Z__3yycKBlSzL-kQMa3iTrqh4Hj-kyOEIQqBWtydzSQ/edit?usp=sharing',
  support: 'https://degird.com/support',
  /** TODO: point at the ShotDock user guide once it is written. */
  userGuide: 'https://degird.com/support',
} as const;

export type LinkKey = keyof typeof APP_LINKS;
