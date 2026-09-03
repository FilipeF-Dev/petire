/**
 * O tempo de entrega, do jeito que o cliente lê.
 *
 * "Quanto tempo demora?" é a pergunta que vem antes de pedir. A loja que
 * responde na tela ganha do concorrente que só responde depois, no WhatsApp,
 * com a cozinha já ocupada.
 *
 * Nulo não vira "consulte": some. Um campo em branco significa que a loja não
 * sabe estimar, e inventar um número por ela é prometer o que ela não
 * prometeu — o mesmo motivo de a taxa zerada virar "a combinar".
 */
export function formatDeliveryTime(minutes: number | null): string | null {
  if (minutes === null || minutes <= 0) return null;

  if (minutes < 60) return `~${minutes} min`;

  // Acima de uma hora, minuto não ajuda ninguém a decidir.
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `~${hours}h` : `~${hours}h${rest}`;
}
