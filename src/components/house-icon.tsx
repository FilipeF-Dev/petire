/**
 * A casa da barra de CEP.
 *
 * Substituiu o emoji de pin. O emoji era desenhado pelo sistema — vermelho no
 * Android, outro no iOS, nenhum deles a cor da marca — e um alfinete de mapa
 * promete geolocalização, que o Petire não faz. A casa diz o que o campo
 * pergunta: onde você mora.
 *
 * `currentColor` não serve aqui: o traço tem de ser o terracota da marca em
 * qualquer contexto, e ele é a única cor do site fora da escala neutra.
 */
export function HouseIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--brand)"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {/* Telhado e paredes num traço só, e a porta. */}
      <path d="M3.5 10.5 12 4l8.5 6.5V19a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" />
      <path d="M9.5 20v-5h5v5" />
    </svg>
  );
}
