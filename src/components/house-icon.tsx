/**
 * A casa da barra de CEP.
 *
 * Substituiu o emoji de pin. O emoji era desenhado pelo sistema — vermelho no
 * Android, outro no iOS, nenhum deles a cor da marca — e um alfinete de mapa
 * promete geolocalização, que o Petire não faz. A casa diz o que o campo
 * pergunta: onde você mora.
 *
 * Silhueta cheia, não contorno. A 20px um traço de 2 unidades num viewBox de
 * 24 vira menos de um pixel e meio na tela, e o desenho some — foi o que
 * aconteceu com a primeira versão. A porta é vazada pelo `fillRule`, então ela
 * mostra o fundo que estiver atrás, seja qual for.
 *
 * `currentColor` não serve aqui: a casa tem de ser o terracota da marca em
 * qualquer contexto, e ele é a única cor do site fora da escala neutra.
 */
export function HouseIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      // Largura e altura no atributo, não só na classe: o CSS do Tailwind chega
      // depois do HTML, e um SVG sem dimensão ocupa o tamanho que quiser até
      // lá — o ícone aparecia gigante por um quadro e depois encolhia.
      width={20}
      height={20}
      // O valor literal é a rede de segurança: se a variável não tiver sido
      // aplicada ainda, a casa nasce na cor certa em vez de sumir.
      fill="var(--brand, #c2410c)"
      fillRule="evenodd"
      clipRule="evenodd"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d="M12 2.8 2.6 10.6a1 1 0 0 0-.35.76V20a1.4 1.4 0 0 0 1.4 1.4h16.7A1.4 1.4 0 0 0 21.75 20v-8.64a1 1 0 0 0-.35-.76zm-1.75 16.9v-4.3h3.5v4.3z" />
    </svg>
  );
}
