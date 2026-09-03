import { describe, expect, it } from "vitest";

import {
  distanceRank,
  sortByProximity,
  type CustomerPlace,
  type NearbyStore,
} from "./proximity";

/** Cliente no Centro de Juiz de Fora. */
const CUSTOMER: CustomerPlace = {
  cep: "36010000",
  neighborhoodSlug: "centro",
};

function store(overrides: Partial<NearbyStore> = {}): NearbyStore {
  return { cep: "36010000", neighborhood_slug: "centro", ...overrides };
}

describe("distanceRank", () => {
  it("põe o mesmo bairro na frente de tudo", () => {
    expect(distanceRank(store({ cep: "99999999" }), CUSTOMER)).toBe(0);
  });

  it("aproxima quanto mais dígitos do prefixo o CEP compartilha", () => {
    const mesmoSubsetor = distanceRank(
      store({ cep: "36010100", neighborhood_slug: "sao-mateus" }),
      CUSTOMER,
    );
    const mesmoSetor = distanceRank(
      store({ cep: "36020100", neighborhood_slug: "granbery" }),
      CUSTOMER,
    );
    const outraRegiao = distanceRank(
      store({ cep: "01310100", neighborhood_slug: "bela-vista" }),
      CUSTOMER,
    );

    expect(mesmoSubsetor).toBeLessThan(mesmoSetor);
    expect(mesmoSetor).toBeLessThan(outraRegiao);
  });

  it("manda a loja sem CEP para o fim, sem sumir da lista", () => {
    const semCep = distanceRank(
      store({ cep: null, neighborhood_slug: "outro" }),
      CUSTOMER,
    );

    expect(semCep).toBeGreaterThan(
      distanceRank(store({ cep: "01310100", neighborhood_slug: "outro" }), CUSTOMER),
    );
  });

  it("ignora máscara no CEP da loja", () => {
    expect(
      distanceRank(store({ cep: "36010-100", neighborhood_slug: "outro" }), CUSTOMER),
    ).toBe(distanceRank(store({ cep: "36010100", neighborhood_slug: "outro" }), CUSTOMER));
  });

  it("não usa o bairro quando o CEP do cliente não trouxe um", () => {
    const semBairro: CustomerPlace = { cep: "36010000", neighborhoodSlug: null };

    expect(distanceRank(store(), semBairro)).toBe(1);
  });
});

describe("sortByProximity", () => {
  type Row = NearbyStore & { name: string };

  const stores: Row[] = [
    { name: "longe", cep: "01310100", neighborhood_slug: "bela-vista" },
    { name: "sem cep", cep: null, neighborhood_slug: "desconhecido" },
    { name: "perto", cep: "36010100", neighborhood_slug: "sao-mateus" },
    { name: "mesmo bairro", cep: "36030330", neighborhood_slug: "centro" },
  ];

  it("ordena da mais perto para a mais distante", () => {
    expect(sortByProximity(stores, CUSTOMER).map((s) => s.name)).toEqual([
      "mesmo bairro",
      "perto",
      "longe",
      "sem cep",
    ]);
  });

  it("preserva a ordem do banco entre lojas igualmente distantes", () => {
    const empatadas: Row[] = [
      { name: "aberta", cep: "36010100", neighborhood_slug: "centro" },
      { name: "fechada", cep: "36010200", neighborhood_slug: "centro" },
    ];

    expect(sortByProximity(empatadas, CUSTOMER).map((s) => s.name)).toEqual([
      "aberta",
      "fechada",
    ]);
  });

  it("devolve a lista intacta quando não há CEP do cliente", () => {
    expect(sortByProximity(stores, null)).toBe(stores);
  });
});
