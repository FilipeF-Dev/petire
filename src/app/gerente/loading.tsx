/**
 * O que o lojista vê enquanto a aba carrega.
 *
 * Antes não havia nada: o clique numa aba deixava a tela anterior congelada
 * até o servidor responder — 200ms com tudo perto, bem mais com o Supabase do
 * outro lado da rede — e sem nenhum sinal de que algo estava acontecendo. A
 * lentidão que se reclama é quase toda essa: não é o tempo, é o silêncio.
 *
 * O esqueleto é genérico porque serve as sete abas. Ele não tenta adivinhar o
 * conteúdo de cada uma: promete "está vindo", no lugar certo da tela, e não
 * uma tabela que talvez não venha.
 */
export default function GerenteLoading() {
  return (
    <div
      // Um rótulo, e não o desenho todo, para quem ouve a tela: sete barras
      // cinzentas anunciadas uma a uma seriam pior do que o silêncio.
      role="status"
      aria-label="Carregando"
      className="flex animate-pulse flex-col gap-6 motion-reduce:animate-none"
    >
      <div className="flex flex-col gap-2">
        <div className="h-7 w-48 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-4 w-72 max-w-full rounded bg-neutral-100 dark:bg-neutral-900" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((card) => (
          <div
            key={card}
            className="h-24 rounded-xl border border-neutral-200 bg-surface dark:border-neutral-800"
          />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            className="h-14 rounded-xl border border-neutral-200 bg-surface dark:border-neutral-800"
          />
        ))}
      </div>
    </div>
  );
}
