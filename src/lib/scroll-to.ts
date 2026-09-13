/**
 * A rolagem até uma seção do cardápio.
 *
 * Clicar numa categoria levava a tela até a seção **de um quadro para o
 * outro** — o salto do âncora. Funciona, e é desorientador: some a referência
 * de onde se estava, e o que aparece parece outra página em vez do mesmo
 * cardápio um pouco mais abaixo. Rolar com o movimento visível resolve isso
 * quase sozinho: o olho acompanha o caminho e sabe onde parou.
 *
 * A curva acelera no começo e desacelera no fim (`easeInOutCubic`), que é como
 * quase tudo se move fora da tela — nada parte do nada à velocidade máxima nem
 * para de repente.
 *
 * `scrollTo({ behavior: "smooth" })` do navegador faria o básico, mas com a
 * curva e a duração que cada navegador escolher, e sem jeito de interromper.
 * Aqui os três são decisão nossa, e a interrupção importa: quem toca a tela no
 * meio do caminho está pedindo para assumir o controle.
 */

/** Acelera e desacelera. Fora da tela, nada se move em velocidade constante. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Perto é rápido, longe é um pouco mais lento — mas nunca lento.
 *
 * Duração fixa faz o salto curto parecer arrastado e o longo, apressado. O
 * teto existe porque ninguém quer esperar a tela terminar de andar: passando de
 * meio segundo, rolagem vira espera.
 */
function duracao(distancia: number): number {
  return Math.min(560, Math.max(260, Math.abs(distancia) * 0.5));
}

/**
 * Rola a janela até `alvo`, com `offset` pixels de folga no topo.
 *
 * A folga é a altura da barra de categorias, que é fixa e cobriria o título da
 * seção se a conta parasse na posição exata dele.
 */
export function rolarAte(alvo: HTMLElement, offset = 0): void {
  const destino = Math.max(
    0,
    alvo.getBoundingClientRect().top + window.scrollY - offset,
  );
  const inicio = window.scrollY;
  const distancia = destino - inicio;

  if (distancia === 0) return;

  // Quem pediu menos movimento no sistema recebe o salto de sempre. A rolagem
  // animada é justamente o tipo de movimento que essa preferência desliga.
  const menosMovimento = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (menosMovimento) {
    window.scrollTo(0, destino);
    return;
  }

  const total = duracao(distancia);
  let comecou: number | null = null;
  let cancelada = false;

  /*
    Toque ou roda no meio do caminho cancela. Sem isto, a animação briga com a
    pessoa: ela arrasta para cima, e a tela puxa de volta para baixo.

    `passive` porque estes ouvintes só observam — declarar isso deixa o
    navegador rolar sem esperar para saber se alguém vai cancelar o gesto.
  */
  const cancelar = () => {
    cancelada = true;
  };

  window.addEventListener("wheel", cancelar, { passive: true, once: true });
  window.addEventListener("touchstart", cancelar, {
    passive: true,
    once: true,
  });

  function quadro(agora: number) {
    if (cancelada) return limpar();

    comecou ??= agora;
    const decorrido = Math.min(1, (agora - comecou) / total);

    window.scrollTo(0, inicio + distancia * easeInOutCubic(decorrido));

    if (decorrido < 1) requestAnimationFrame(quadro);
    else limpar();
  }

  function limpar() {
    window.removeEventListener("wheel", cancelar);
    window.removeEventListener("touchstart", cancelar);
  }

  requestAnimationFrame(quadro);
}
