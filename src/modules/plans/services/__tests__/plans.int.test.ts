import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { plans } from "../../../../db/schema";
import { clearTables } from "../../../../test/fixtures";
import { PostgresTestInstance, startPostgres } from "../../../../test/postgres";
import {
  createPlan,
  listPlans,
  listSelectablePlans,
  updatePlan,
} from "../plans";

// PLAN-01 a PLAN-04, PLAN-05: servicos de plano contra o Postgres do
// Testcontainers.

describe("plans services", () => {
  let pg: PostgresTestInstance;

  beforeAll(async () => {
    pg = await startPostgres();
  }, 180_000);

  beforeEach(async () => {
    await clearTables(pg.db);
  });

  afterAll(async () => {
    await pg.pool.end();
    await pg.container.stop();
  });

  it("cria plano completo com nome, valor, frequencia, descricao e status (PLAN-01)", async () => {
    const created = await createPlan(pg.db, {
      name: "Mensal Ilimitado",
      price: "180.00",
      weeklyFrequency: 3,
      description: "Aulas livres na semana",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(created.value.name).toBe("Mensal Ilimitado");
    expect(created.value.price).toBe("180.00");
    expect(created.value.weeklyFrequency).toBe(3);
    expect(created.value.description).toBe("Aulas livres na semana");
    expect(created.value.status).toBe("ATIVO");

    const [stored] = await pg.db
      .select()
      .from(plans)
      .where(eq(plans.id, created.value.id));
    expect(stored.name).toBe("Mensal Ilimitado");
    expect(stored.price).toBe("180.00");
  });

  it("recusa valor e frequencia invalidos com erro por campo (PLAN-02)", async () => {
    const badPrice = await createPlan(pg.db, {
      name: "Plano Zero",
      price: "0.00",
      weeklyFrequency: 1,
    });
    expect(badPrice.ok).toBe(false);
    if (!badPrice.ok) expect(badPrice.field).toBe("price");

    const badFrequency = await createPlan(pg.db, {
      name: "Plano Vazio",
      price: "100.00",
      weeklyFrequency: 0,
    });
    expect(badFrequency.ok).toBe(false);
    if (!badFrequency.ok) expect(badFrequency.field).toBe("weeklyFrequency");

    // Nada foi gravado
    const rows = await pg.db.select().from(plans);
    expect(rows).toHaveLength(0);
  });

  it("edita plano e reflete a mudanca na listagem (PLAN-03)", async () => {
    const created = await createPlan(pg.db, {
      name: "Mensal 2x",
      price: "140.00",
      weeklyFrequency: 2,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await updatePlan(pg.db, {
      planId: created.value.id,
      name: "Mensal 2x Ajustado",
      price: "150.00",
      weeklyFrequency: 2,
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.name).toBe("Mensal 2x Ajustado");
    expect(updated.value.price).toBe("150.00");

    const listed = await listPlans(pg.db);
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe("Mensal 2x Ajustado");
    expect(listed[0].price).toBe("150.00");
  });

  it("edita limpa a descricao e manter omitido preserva (PLAN-03)", async () => {
    const created = await createPlan(pg.db, {
      name: "Mensal Descricao",
      price: "140.00",
      weeklyFrequency: 2,
      description: "Aulas livres na semana",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // String vazia vinda do formulario limpa a descricao
    const cleared = await updatePlan(pg.db, {
      planId: created.value.id,
      name: "Mensal Descricao",
      price: "140.00",
      weeklyFrequency: 2,
      description: "",
    });
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(cleared.value.description).toBeNull();

    // Chamada sem descricao (ex.: inativar pelo botao) preserva o campo
    const kept = await updatePlan(pg.db, {
      planId: created.value.id,
      name: "Mensal Descricao",
      price: "140.00",
      weeklyFrequency: 2,
      status: "INATIVO",
    });
    expect(kept.ok).toBe(true);
    if (!kept.ok) return;
    expect(kept.value.description).toBeNull();
  });

  it("inativa via update e o seletor omite o plano (PLAN-04)", async () => {
    const active = await createPlan(pg.db, {
      name: "Mensal Ativo",
      price: "100.00",
      weeklyFrequency: 1,
    });
    expect(active.ok).toBe(true);
    if (!active.ok) return;

    // Antes de inativar: aparece no seletor
    const before = await listSelectablePlans(pg.db);
    expect(before.map((plan) => plan.id)).toContain(active.value.id);

    const deactivated = await updatePlan(pg.db, {
      planId: active.value.id,
      name: "Mensal Ativo",
      price: "100.00",
      weeklyFrequency: 1,
      status: "INATIVO",
    });
    expect(deactivated.ok).toBe(true);
    if (!deactivated.ok) return;
    expect(deactivated.value.status).toBe("INATIVO");

    const after = await listSelectablePlans(pg.db);
    expect(after).toHaveLength(0);
  });

  it("seletor mantem o plano atual da aluna mesmo inativo (PLAN-04, PLAN-05)", async () => {
    const plan = await createPlan(pg.db, {
      name: "Mensal Antigo",
      price: "120.00",
      weeklyFrequency: 2,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    await updatePlan(pg.db, {
      planId: plan.value.id,
      name: "Mensal Antigo",
      price: "120.00",
      weeklyFrequency: 2,
      status: "INATIVO",
    });

    const other = await createPlan(pg.db, {
      name: "Mensal Novo",
      price: "160.00",
      weeklyFrequency: 2,
    });
    expect(other.ok).toBe(true);

    // Em edicao com esse plano: o inativo atual volta e o ATIVO segue
    // oferecido; ordenado por nome
    const selectable = await listSelectablePlans(pg.db, plan.value.id);
    expect(selectable.map((item) => item.id)).toEqual([
      plan.value.id,
      other.ok ? other.value.id : "",
    ]);

    // Sem plano atual: nenhum inativo e oferecido
    const fresh = await listSelectablePlans(pg.db);
    expect(fresh.map((item) => item.id)).toEqual([other.ok ? other.value.id : ""]);
  });

  it("recusa plano com nome duplicado", async () => {
    const first = await createPlan(pg.db, {
      name: "Mensal Unico",
      price: "100.00",
      weeklyFrequency: 1,
    });
    expect(first.ok).toBe(true);

    const duplicate = await createPlan(pg.db, {
      name: "Mensal Unico",
      price: "200.00",
      weeklyFrequency: 2,
    });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.field).toBe("name");
      expect(duplicate.error).toContain("nome");
    }
  });
});
