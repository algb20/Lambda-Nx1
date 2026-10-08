/**
 * The attribution CoinGecko's API terms require wherever its data is shown.
 *
 * Read 2026-10-04 (coingecko.com/en/api_terms): "you shall duly attribute
 * ownership of the CoinGecko API to CoinGecko by displaying prominently the
 * message 'Powered by CoinGecko' in a legible font … no smaller than font size
 * 10." Those terms are what allow a paid product to show the data at all, so
 * the line is a condition of use, not decoration — one component, so the
 * wording cannot drift between the surfaces that need it.
 */
export function PoweredByCoinGecko({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[11px] text-muted-foreground ${className}`}>
      <a href="https://www.coingecko.com/" target="_blank" rel="noopener noreferrer" className="hover:underline">
        Powered by CoinGecko
      </a>
    </p>
  )
}
