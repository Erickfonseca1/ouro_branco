"""Simulador da economia de Ouro Branco (modo piloto, 8 jogadores).

Roda muitas partidas com estratégias simples e mede se a economia
"aperta sem quebrar todo mundo". Não simula marcos nem intriga.

Uso:
    python3 simulador/economia.py            # todos os cenários, relatório no terminal
    python3 simulador/economia.py --md out.md # também grava um relatório Markdown
"""
from __future__ import annotations
import argparse
import random
import statistics as st
from dataclasses import dataclass, field

# ----------------------------------------------------------------------------
# Parâmetros (espelham o documento 04; mude aqui para testar)
# ----------------------------------------------------------------------------
P = dict(
    turnos=12,
    p_base=[4, 4.5, 5, 5.5, 6, 6, 6.5, 7, 7, 7, 7, 7],
    corte_colapso={8: 0.35, 9: 0.35, 10: 0.60, 11: 0.60},  # turno (0-based): fração cortada
    passo_preco=0.25,          # queda por lote acima da demanda
    teto_acima_base=2.0,
    piso_preco=1.0,
    producao_seringal=3,
    aviamento=[4] * 3 + [5] * 4 + [6] * 5,
    frete_fracao=0.10,         # frete por lote = 10% do preço base (mínimo 0,3)
    perda_barranco=0.5,        # fração perdida do lote não vendido sem armazém
    casa_automatica=0.60,      # fração de P paga pela casa comercial automática
    exportador_compra=0.75,    # fração de P que o exportador jogador paga
    exportador_limite=8,      # lotes de terceiros que a licença permite comprar por turno
    vapor_capacidade=6,
    imposto=0.20,
    juros_aviadora=0.20,       # por turno, casa aviadora jogadora
    juros_automatica=0.25,
    juros_thornbury=0.10,
    luxo_faixas=[(3, 1), (6, 2), (10, 4)],  # (★ até, custo)
    prestigio_custo=3,
    expandir_custo=6,
    malaria_chance=0.15,       # por seringal e por turno, −1 lote
    seringais_sistema=4,
    sistema_vende=0.66,        # fração da produção que os seringais do sistema vendem
    renda_fixa={"Governador": 2.0, "Jornal": 4.0, "Naturalista": 3.0},
)

PAPEIS = {
    # papel: (caixa inicial, seringais, vapores, prestígio inicial)
    "Coronel": (12, 2, 0, 4),
    "Aviadora": (30, 0, 0, 4),
    "Exportador": (20, 1, 0, 4),
    "Armador": (14, 0, 2, 3),
    "Governador": (10, 1, 0, 5),
    "Jornal": (10, 0, 0, 3),
    "Caudilho": (8, 1, 0, 2),
    "Naturalista": (8, 0, 0, 2),
}


@dataclass
class Jogador:
    papel: str
    caixa: float
    seringais: int
    vapores: int
    prestigio: int
    estrategia: str
    divida: float = 0.0
    juros_divida: float = 0.0
    armazem: int = 0
    estoque: int = 0
    quebrou_em: int | None = None
    historico_caixa: list = field(default_factory=list)

    def patrimonio(self, preco):
        return self.caixa + self.seringais * 8 + self.vapores * 6 + self.estoque * preco * 0.6 - self.divida


def luxo(prestigio):
    for teto, custo in P["luxo_faixas"]:
        if prestigio <= teto:
            return custo
    return P["luxo_faixas"][-1][1]


def p_base(turno, colapso):
    base = P["p_base"][turno]
    if colapso:
        base *= 1 - P["corte_colapso"].get(turno, 0)
    return max(1.5, base)


def decidir_venda(j, producao, demanda, n_produtores, rng):
    """Quantos lotes o jogador oferece neste turno."""
    disponivel = producao + j.estoque
    if j.estrategia == "despeja":
        return disponivel
    # cota do cartel: fatia da demanda proporcional aos seringais do jogador
    cota = max(1, round(demanda * j.seringais / n_produtores))
    if j.estrategia == "cartel":
        return min(disponivel, cota)
    if j.estrategia == "oportunista":   # respeita o cartel metade das vezes
        return disponivel if rng.random() < 0.5 else min(disponivel, cota)
    return disponivel


def simular(estrategias, colapso, rng, ambicao=0.5):
    js = []
    for papel, (caixa, ser, vap, pres) in PAPEIS.items():
        js.append(Jogador(papel, caixa, ser, vap, pres, estrategias.get(papel, "despeja")))
    aviadora = next(j for j in js if j.papel == "Aviadora")
    exportador = next(j for j in js if j.papel == "Exportador")
    armador = next(j for j in js if j.papel == "Armador")

    thornbury = 0.0
    precos, quedas, aviadora_quebrou = [], 0, None
    seringais_total = sum(j.seringais for j in js) + P["seringais_sistema"]

    for t in range(P["turnos"]):
        # 0. renda fixa
        for j in js:
            j.caixa += P["renda_fixa"].get(j.papel, 0)

        # 1. expansão (ambição) nos turnos de alta
        for j in js:
            if j.seringais and t < 7 and j.caixa >= P["expandir_custo"] + 4 and rng.random() < ambicao:
                j.caixa -= P["expandir_custo"]
                j.seringais += 1
                seringais_total += 1
        demanda = 2 * seringais_total

        # 2. aviamento (crédito se faltar caixa)
        producao = {}
        for j in js:
            if not j.seringais:
                producao[j.papel] = 0
                continue
            custo = j.seringais * P["aviamento"][t]
            falta = max(0.0, custo - j.caixa)
            if falta:
                if aviadora is not j and aviadora.caixa + 40 > falta:   # aviadora jogadora empresta
                    if aviadora.caixa < falta:
                        thornbury += falta - aviadora.caixa
                        aviadora.caixa = falta
                    aviadora.caixa -= falta
                    j.divida += falta
                    j.juros_divida = P["juros_aviadora"]
                else:
                    j.divida += falta
                    j.juros_divida = P["juros_automatica"]
                j.caixa += falta
            j.caixa -= custo
            lotes = 0
            for _ in range(j.seringais):
                lotes += P["producao_seringal"] - (1 if rng.random() < P["malaria_chance"] else 0)
            producao[j.papel] = lotes

        produtores = [j for j in js if j.seringais]
        sistema_prod = P["seringais_sistema"] * P["producao_seringal"]
        sistema_venda = round(sistema_prod * P["sistema_vende"])

        # 3. frete e decisão de venda
        frete_lote = max(0.3, P["frete_fracao"] * p_base(t, colapso))
        ofertas = {}
        espaco_armador = armador.vapores * P["vapor_capacidade"]
        for j in produtores:
            frete = producao[j.papel] * frete_lote
            j.caixa -= frete
            no_armador = min(espaco_armador, producao[j.papel])
            espaco_armador -= no_armador
            armador.caixa += no_armador * frete_lote
            ofertas[j.papel] = decidir_venda(j, producao[j.papel], demanda, seringais_total, rng)

        # 4. preço
        v = sum(ofertas.values()) + sistema_venda
        base = p_base(t, colapso)
        preco = base - P["passo_preco"] * (v - demanda)
        preco = min(base + P["teto_acima_base"], max(P["piso_preco"], preco))
        preco = round(preco * 4) / 4
        if precos and preco < precos[-1]:
            quedas += 1
        else:
            quedas = 0
        precos.append(preco)

        # 5. pagamentos
        limite = P["exportador_limite"]
        for j in rng.sample(produtores, len(produtores)):
            vendidos = ofertas[j.papel]
            sobra = producao[j.papel] + j.estoque - vendidos
            guardado = min(sobra, j.armazem * 6)
            j.estoque = guardado + int((sobra - guardado) * (1 - P["perda_barranco"]))
            if j is exportador:
                j.caixa += vendidos * preco * (1 - P["imposto"])
                continue
            ao_exportador = min(vendidos, limite)
            limite -= ao_exportador
            exportador.caixa += ao_exportador * preco * ((1 - P["imposto"]) - P["exportador_compra"])
            j.caixa += ao_exportador * preco * P["exportador_compra"]
            j.caixa += (vendidos - ao_exportador) * preco * P["casa_automatica"]

        # 6. juros e amortização
        for j in js:
            if j.divida:
                juros = j.divida * j.juros_divida
                if j.juros_divida == P["juros_aviadora"]:
                    aviadora.caixa += juros
                j.caixa -= juros
                pagar = min(j.divida, max(0.0, j.caixa - 2))
                j.caixa -= pagar
                j.divida -= pagar
                if j.juros_divida == P["juros_aviadora"]:
                    aviadora.caixa += pagar
        aviadora.caixa -= thornbury * P["juros_thornbury"]
        if quedas >= 2 and thornbury:
            cobranca = thornbury / 2
            aviadora.caixa -= cobranca
            thornbury -= cobranca
        if aviadora.caixa < 0 and aviadora_quebrou is None:
            aviadora_quebrou = t + 1

        # 7. luxo e prestígio
        for j in js:
            c = luxo(j.prestigio)
            if j.caixa >= c:
                j.caixa -= c
            else:
                j.prestigio = max(0, j.prestigio - 1)
            # compra prestígio com sobra (até ★6, uma vez por turno)
            if j.caixa > 12 and j.prestigio < 6:
                j.caixa -= P["prestigio_custo"]
                j.prestigio += 1

        for j in js:
            j.historico_caixa.append(round(j.caixa - j.divida, 1))
            if j.quebrou_em is None and j.caixa - j.divida < -10:
                j.quebrou_em = t + 1

    return dict(precos=precos, jogadores=js, aviadora_quebrou=aviadora_quebrou)


CENARIOS = {
    "Todos despejam": {},
    "Todos em cartel": {p: "cartel" for p in PAPEIS},
    "Cartel com 1 traidor (Coronel)": {**{p: "cartel" for p in PAPEIS}, "Coronel": "despeja"},
    "Mesa oportunista": {p: "oportunista" for p in PAPEIS},
}


def rodar(n=500, seed=7):
    resultados = {}
    for colapso in (False, True):
        for nome, estr in CENARIOS.items():
            rng = random.Random(seed)
            runs = [simular(estr, colapso, rng) for _ in range(n)]
            precos = [st.mean(r["precos"][t] for r in runs) for t in range(P["turnos"])]
            final = {papel: st.mean(next(j for j in r["jogadores"] if j.papel == papel).historico_caixa[-1] for r in runs)
                     for papel in PAPEIS}
            t6 = {papel: st.mean(next(j for j in r["jogadores"] if j.papel == papel).historico_caixa[5] for r in runs)
                  for papel in PAPEIS}
            quebras = st.mean(sum(1 for j in r["jogadores"] if j.quebrou_em) for r in runs)
            primeira = [min((j.quebrou_em for j in r["jogadores"] if j.quebrou_em), default=None) for r in runs]
            primeira = [x for x in primeira if x]
            avi = [r["aviadora_quebrou"] for r in runs if r["aviadora_quebrou"]]
            resultados[(colapso, nome)] = dict(
                precos=precos, final=final, t6=t6, quebras=quebras,
                primeira=st.mean(primeira) if primeira else None,
                pct_com_quebra=len(primeira) / n,
                aviadora_pct=len(avi) / n, aviadora_turno=st.mean(avi) if avi else None,
            )
    return resultados


def relatorio(res):
    linhas = []
    for colapso in (False, True):
        linhas.append(f"\n## {'Com colapso (sementes germinaram)' if colapso else 'Sem colapso'}\n")
        linhas.append("| Cenário | Preço T1→T12 | Quebras/partida | 1ª quebra (turno) | Aviadora quebra |")
        linhas.append("|---|---|---|---|---|")
        for nome in CENARIOS:
            r = res[(colapso, nome)]
            curva = " ".join(f"{p:.1f}" for p in r["precos"])
            prim = f"{r['primeira']:.1f} ({r['pct_com_quebra']:.0%})" if r["primeira"] else "—"
            avi = f"{r['aviadora_pct']:.0%}" + (f" (T{r['aviadora_turno']:.0f})" if r["aviadora_turno"] else "")
            linhas.append(f"| {nome} | {curva} | {r['quebras']:.2f} | {prim} | {avi} |")
        linhas.append("\n**Saldo líquido (caixa − dívida) por papel, média, turno 6 → turno 12:**\n")
        linhas.append("| Papel | " + " | ".join(CENARIOS) + " |")
        linhas.append("|---|" + "---|" * len(CENARIOS))
        for papel in PAPEIS:
            cel = [f"{res[(colapso, n)]['t6'][papel]:.0f} → {res[(colapso, n)]['final'][papel]:.0f}" for n in CENARIOS]
            linhas.append(f"| {papel} | " + " | ".join(cel) + " |")
    return "\n".join(linhas)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=500)
    ap.add_argument("--md")
    a = ap.parse_args()
    texto = relatorio(rodar(a.n))
    print(texto)
    if a.md:
        with open(a.md, "w", encoding="utf-8") as f:
            f.write(texto)
