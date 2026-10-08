import { creditOf } from '@/lib/engine/catalog/credits'

/**
 * Who a finding came from, credited the way its licence asks (GL-04, R323).
 *
 * CC BY, OGL and the provider-specific terms in the licence registry ask for a
 * credit "reasonable to the medium" wherever their material appears. Beside the
 * finding is that place; /terms#sources holds the full list and the licence
 * texts. A source that asks for no credit is shown by its key, as before.
 */
export function SourceCredit({
  sourceKey,
  sourceUrl,
  className = '',
}: {
  sourceKey: string
  sourceUrl?: string | null
  className?: string
}) {
  const credit = creditOf(sourceKey)
  const name = credit?.credit ?? sourceKey
  return (
    // A publisher's name and a licence name are identifiers: machine
    // translation would turn a credit into something the licensor never wrote.
    <span data-no-translate className={`inline-flex min-w-0 items-center gap-1 ${className}`}>
      {sourceUrl ? (
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="truncate hover:text-foreground hover:underline" title={sourceKey}>
          {name}
        </a>
      ) : (
        <span className="truncate" title={sourceKey}>
          {name}
        </span>
      )}
      {credit?.licence ? (
        <a href="/terms#sources" className="shrink-0 hover:text-foreground hover:underline" title="Licence and credits">
          {credit.licence}
        </a>
      ) : null}
    </span>
  )
}
