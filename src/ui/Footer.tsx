import { APP_LINKS, type LinkKey } from './links';

/** The compact set is what fits a 400px popup; full-page surfaces carry all five. */
const COMPACT_LINKS: LinkKey[] = ['reviewUs', 'moreTools', 'support'];
const PAGE_LINKS: LinkKey[] = ['reviewUs', 'moreTools', 'privacy', 'support', 'userGuide'];

const LABELS: Record<LinkKey, string> = {
  degirdHome: 'DEGIRD',
  degirdProducts: 'PRODUCTS',
  reviewUs: 'REVIEW US',
  moreTools: 'MORE TOOLS',
  privacy: 'PRIVACY',
  support: 'SUPPORT',
  userGuide: 'USER GUIDE',
};

interface Props {
  /** Widens the padding and shows the full link set. */
  page?: boolean;
}

/** The global footer, shared by every surface. */
export function Footer({ page = false }: Props) {
  const links = page ? PAGE_LINKS : COMPACT_LINKS;

  return (
    <footer className={`sd-footer${page ? ' sd-footer--page' : ''}`}>
      <div className="sd-footer__links">
        {links.map((key) => (
          <a key={key} href={APP_LINKS[key]} target="_blank" rel="noreferrer">
            {LABELS[key]}
          </a>
        ))}
      </div>
      {/* Deliberately year-less: no copyright date anywhere in the product. */}
      <div className="sd-footer__copy">&copy; ShotDock</div>
    </footer>
  );
}
