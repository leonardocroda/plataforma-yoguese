import { describe, expect, it } from "vitest";
import {
  avancarDias,
  datasDeOcorrencia,
  hojeEstudio,
  isDataPassada,
  proximaOcorrencia,
  weekdayDaData,
} from "../ocorrencias";

// Testes derivados de RES-06 (datas de ocorrencia) e RES-10 (data passada/hoje
// no fuso do estudio). Semana 2026-11: 01=domingo, 07=sabado.
describe("ocorrencias", () => {
  it("considera recusada apenas a data estritamente anterior a hoje", () => {
    const hoje = "2026-11-06";
    expect(isDataPassada("2026-11-05", hoje)).toBe(true);
    expect(isDataPassada(hoje, hoje)).toBe(false);
    expect(isDataPassada("2026-11-07", hoje)).toBe(false);
    expect(isDataPassada("2026-12-12", hoje)).toBe(false);
  });

  it("hoje no fuso do estudio muda na meia-noite local (03:00 UTC)", () => {
    // 22:59 de 2026-11-04 em America/Sao_Paulo
    expect(hojeEstudio(new Date("2026-11-05T01:59:00Z"))).toBe("2026-11-04");
    // 00:00 de 2026-11-05 em America/Sao_Paulo
    expect(hojeEstudio(new Date("2026-11-05T03:00:00Z"))).toBe("2026-11-05");
  });

  it("weekday segue 1=domingo a 7=sabado", () => {
    expect(weekdayDaData("2026-11-01")).toBe(1); // domingo
    expect(weekdayDaData("2026-11-03")).toBe(3); // terca
    expect(weekdayDaData("2026-11-07")).toBe(7); // sabado
  });

  it("datas de ocorrencia cobrem extremos e virada de mes/ano", () => {
    // Turma de terca (3): 2025-12-30 (terca, extremo) e 2026-01-06 caiem no
    // range que atravessa a virada do ano
    expect(
      datasDeOcorrencia({ weekday: 3 }, "2025-12-30", "2026-01-07"),
    ).toEqual(["2025-12-30", "2026-01-06"]);

    // Virada de fevereiro em ano bissexto: tercas entre 28/02 e 10/03/2024
    expect(datasDeOcorrencia({ weekday: 3 }, "2024-02-25", "2024-03-10")).toEqual(
      ["2024-02-27", "2024-03-05"],
    );
  });

  it("datas de ocorrencia incluindo os dois extremos quando sao do slot", () => {
    // Turma de sexta (6): 2026-11-06 e uma sexta
    expect(datasDeOcorrencia({ weekday: 6 }, "2026-11-06", "2026-11-20")).toEqual(
      ["2026-11-06", "2026-11-13", "2026-11-20"],
    );
  });

  it("datas de ocorrencia com range invalido devolve vazio", () => {
    expect(datasDeOcorrencia({ weekday: 3 }, "2026-11-10", "2026-11-03")).toEqual(
      [],
    );
  });

  it("datas de ocorrencia nao deslocam no periodo de transicao de horario de verao", () => {
    // Domingos entre os dias em que America/Sao_Paulo mudava de horario
    // (transicao historica em 04/11/2018): a semana calendario continua
    // sem deslocar datas.
    expect(
      datasDeOcorrencia({ weekday: 1 }, "2018-10-28", "2018-11-25"),
    ).toEqual([
      "2018-10-28",
      "2018-11-04",
      "2018-11-11",
      "2018-11-18",
      "2018-11-25",
    ]);
  });

  it("proxima ocorrencia e o proprio dia quando hoje e dia de aula", () => {
    expect(proximaOcorrencia({ weekday: 3 }, "2026-11-03")).toBe("2026-11-03");
  });

  it("proxima ocorrencia avanca para a proxima semana", () => {
    expect(proximaOcorrencia({ weekday: 3 }, "2026-11-04")).toBe("2026-11-10");
  });

  it("avancarDias atravessa a virada de mes", () => {
    expect(avancarDias("2026-10-31", 1)).toBe("2026-11-01");
  });
});
