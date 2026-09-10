/**
 * Um freio simples para as rotas públicas de escrita.
 *
 * **O que ele é:** uma contagem por IP dentro do processo, que recusa o excesso
 * óbvio — o laço de script batendo na rota, a aba presa reenviando, o teste de
 * carga acidental.
 *
 * **O que ele não é:** defesa contra quem quer mesmo poluir o dado. O Petire
 * roda em funções sem estado compartilhado: cada instância tem a própria
 * contagem, instâncias novas nascem zeradas, e quem distribuir as chamadas
 * passa por baixo. Está escrito aqui para ninguém confundir isso com proteção
 * de verdade — que, quando o volume justificar, é contagem em armazenamento
 * compartilhado, no banco ou num cache.
 *
 * O que sustenta o dado hoje não é este arquivo: é o piso de repetições da
 * demanda do bairro, que ignora termo procurado menos de três vezes. Este
 * freio só faz o custo de tentar deixar de ser zero.
 */

type Janela = { inicio: number; contagem: number };

const janelas = new Map<string, Janela>();

/** Quantas requisições cada IP pode fazer por janela, e o tamanho dela. */
const LIMITE = 30;
const JANELA_MS = 60_000;

/**
 * Impede que o mapa cresça sem fim numa instância de vida longa: a cada
 * limpeza, o que já expirou sai.
 */
function limpar(agora: number): void {
  for (const [chave, janela] of janelas) {
    if (agora - janela.inicio >= JANELA_MS) janelas.delete(chave);
  }
}

/**
 * O IP de quem chamou, como a Vercel o entrega.
 *
 * `x-forwarded-for` vem como uma lista quando há proxies no caminho, e o
 * primeiro é o cliente. Sem cabeçalho — desenvolvimento local, alguma borda
 * que não preenche — todo mundo cai no mesmo balde, que é conservador na
 * direção certa: no máximo limita demais, nunca de menos.
 */
export function clientIp(request: Request): string {
  const encaminhado = request.headers.get("x-forwarded-for");
  return encaminhado?.split(",")[0]?.trim() || "desconhecido";
}

/** Passou do limite? Conta a chamada e responde. */
export function excedeuLimite(chave: string, agora = Date.now()): boolean {
  const janela = janelas.get(chave);

  if (!janela || agora - janela.inicio >= JANELA_MS) {
    limpar(agora);
    janelas.set(chave, { inicio: agora, contagem: 1 });
    return false;
  }

  janela.contagem += 1;
  return janela.contagem > LIMITE;
}

/** Para o teste conseguir começar do zero. */
export function limparLimites(): void {
  janelas.clear();
}
