import type { PublicAuthor } from '../../lib/studentProfile';
import { authorHeadline } from '../../lib/studentProfile';
import { ProfileAvatar } from '../profile/ProfileAvatar';
import { msg } from '../../lib/messages';


/** A publisher's picture and name. */
export function AuthorBadge({ name, avatar = null, size = 'md' }: { name: string; avatar?: string | null; size?: 'sm' | 'md' }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <ProfileAvatar avatar={avatar} name={name} size={size === 'sm' ? 24 : 28} />
      <span className="min-w-0 truncate font-semibold text-ink">{name}</span>
    </span>
  );
}

/** The author in full on a camp's page: picture, name, what they do and their bio. */
export function AuthorCard({ author, published }: { author: PublicAuthor; published: string }) {
  const headline = authorHeadline(author);
  return (
    <section className="card p-5" aria-label={msg("Kampı hazırlayan")}>
      <p className="eyebrow">{msg("Hazırlayan")}</p>
      <div className="mt-3 flex items-center gap-3">
        <ProfileAvatar avatar={author.avatar} name={author.name} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15.5px] font-semibold text-ink">{author.name}</p>
          {headline && <p className="text-[12.5px] leading-snug text-ink-2">{headline}</p>}
        </div>
      </div>
      {author.bio && <p className="mt-3.5 text-[13.5px] leading-relaxed break-words whitespace-pre-line text-ink-2">{author.bio}</p>}
      <p className="mt-3.5 border-t border-line pt-3 text-[12px] text-ink-3">{published} {msg(" yayınlandı")}</p>
    </section>
  );
}
