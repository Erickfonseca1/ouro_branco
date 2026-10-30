"""Simulador dos objetivos secretos de Ouro Branco (marcos e reivindicação).

Mede quanto tempo os 3 marcos de cada variante levam para ser cumpridos,
sozinhos (sem oposição) e numa partida piloto de 8 jogadores (com oposição,
sinal de proximidade e reivindicação). Os marcos vêm de simulador/marcos.json,
que é uma codificação ABSTRATA (números, sem texto) e contém spoilers.

O relatório usa só identificadores papel+letra: pode ser lido por quem joga.

Uso:
    python3 simulador/marcos.py                       # relatório no terminal
    python3 simulador/marcos.py --md simulador/resultados-marcos.md
    python3 simulador/marcos.py --n 2000 --seed 7
"""
from __future__ import annotations
import argparse
import json
import math
import os
import random
import statistics as st

# ----------------------------------------------------------------------------
# Parâmetros (mude aqui para testar)
# ----------------------------------------------------------------------------
P = dict(
    turnos=12,
    acoes_objetivo=1.5,        # ações por turno (das 3) dedicadas ao objetivo, em média
    p_coop=0.6,                # chance de o outro jogador aceitar cada proposta
    coop_lider=0.8,            # multiplica p_coop quando o proponente já deu sinal de proximidade
    credito=8.0,               # quanto o jogador pode ficar negativo (crédito da casa automática)
    juros_credito=0.25,        # por turno, sobre saldo negativo
    custo_prestigio=(3, 6),    # 1ª e 2ª compra de ★ no mesmo turno
    inclinacao=0.15,           # massa de probabilidade que um jogador que investiu tudo acrescenta ao seu desfecho
    perda_passiva=0.03,        # chance por turno de um marco cumprido cair, × fragil
    eficacia_ataque=0.6,       # chance de um ataque derrubar o marco escolhido, × fragil
    custo_ataque=0.5,          # chance de cada ataque tirar 1 ação do objetivo do atacante
    ataque_sinal=0.3,          # ações/turno de cada oponente contra quem deu sinal (2º marco)
    ataque_defesa=0.6,         # ações de cada oponente no turno de defesa de uma reivindicação
    reivindicar_desde=8,       # primeiro turno em que se pode reivindicar (doc. 04, §2.3)
    refazer_fracao=0.5,        # fração das ações para refazer um marco derrubado
)

INTENSIDADES = {               # (ataque_sinal, ataque_defesa)
    "baixa": (0.15, 0.3),
    "média": (0.3, 0.6),
    "alta": (0.5, 1.0),
}

PILOTO = ["Coronel", "Casa Aviadora", "Exportador", "Armador",
          "Governador", "Dono do jornal", "Caudilho", "Naturalista"]
AGENTES = ["Naturalista-A", "Exportador-A", "Contrabandista-B"]  # ordem do sorteio (doc. 02, §1.4)

AQUI = os.path.dirname(os.path.abspath(__file__))


def carregar(caminho=None):
    with open(caminho or os.path.join(AQUI, "marcos.json"), encoding="utf-8") as f:
        dados = json.load(f)
    # confere p_favoravel contra a tabela de bifurcações
    for v in dados["variantes"]:
        for mk in v["marcos"]:
            if mk["bifurcacao"]:
                bif = dados["bifurcacoes"][mk["bifurcacao"]]["desfechos"]
                p = sum(bif[x] for x in mk["desfecho_favoravel"]) * mk.get("p_condicional", 1.0)
                if abs(p - mk["p_favoravel"]) > 0.01:
                    print(f"aviso: {mk['id']} p_favoravel {mk['p_favoravel']} ≠ tabela {p:.2f}")
    return dados


def sortear_qtd(x, rng):
    """Número inteiro de ações com média x (parte inteira + moeda para a fração)."""
    base = int(x)
    return base + (1 if rng.random() < x - base else 0)


# ----------------------------------------------------------------------------
# Estado de um marco e de um jogador
# ----------------------------------------------------------------------------
class Marco:
    def __init__(self, spec):
        self.s = spec
        self.cumprido = False
        self.cumprido_em = None
        self.falta_acoes = spec["acoes"]
        self.falta_parceiros = spec["parceiros"] if spec["coop"] else 0
        self.custo_acao = spec["custo"] / max(1, spec["acoes"])
        self.influencia = 0            # ações gastas antes da resolução da bifurcação
        self.bif = None                # None, "favoravel" ou "atalho"
        self.atalho_desde = None
        self.via_atalho = False

    @property
    def fragil(self):
        if self.via_atalho:
            return self.s["fragil_atalho"] if self.s["fragil_atalho"] is not None else 0.5
        return self.s["fragil"]

    def bif_pendente(self, t, bifs):
        b = self.s["bifurcacao"]
        return b is not None and self.bif is None and t <= bifs[b]["turno"]

    def derrubar(self, expirou=False):
        self.cumprido = False
        a = self.s["acoes"] if not self.via_atalho else max(1, self.s["atalho_acoes"])
        if expirou:
            self.falta_acoes = max(1, a - 1)
        else:
            self.falta_acoes = max(1, math.ceil(a * P["refazer_fracao"]))
        self.falta_parceiros = (self.s["parceiros"] if self.s["coop"] else 0) or (1 if self.via_atalho else 0)


class Jogador:
    def __init__(self, var, papel_info):
        self.id = var["id"]
        self.papel = var["papel"]
        self.marcos = [Marco(s) for s in var["marcos"]]
        self.caixa = papel_info["caixa"]
        self.renda = papel_info["renda"] + var.get("renda_extra", 0)
        self.prestigio = papel_info["prestigio"]
        self.sinal = False
        self.reivindicando = False
        self.caiu_na_defesa = False
        self.bloqueado_ate = 0
        self.tres_em = None            # (turno, ordem) em que completou os 3 marcos pela última vez
        self.contagem_em = {}          # nº de marcos -> (turno, ordem) em que chegou a esse número
        self.compras_turno = 0

    def n_cumpridos(self):
        return sum(m.cumprido for m in self.marcos)


# ----------------------------------------------------------------------------
# Um turno de ações do jogador
# ----------------------------------------------------------------------------
def pode_pagar(j, valor):
    return j.caixa - valor >= -P["credito"]


def util(mk, j, t, bifs):
    """Este marco pode receber uma ação útil agora?"""
    if mk.cumprido:
        return False
    s = mk.s
    if s["bifurcacao"] and mk.bif is None and t > bifs[s["bifurcacao"]]["turno"]:
        return False
    if s["bifurcacao"] and mk.bif == "favoravel" and mk.falta_acoes == 0 and mk.falta_parceiros == 0:
        return False
    if s["prestigio_min"] > j.prestigio:
        return pode_pagar(j, P["custo_prestigio"][min(j.compras_turno, 1)])
    if mk.falta_acoes > 0:
        return pode_pagar(j, mk.custo_acao)
    return mk.falta_parceiros > 0


def gastar_acao(j, mk, t, p_coop, rng):
    s = mk.s
    if s["prestigio_min"] > j.prestigio:
        j.caixa -= P["custo_prestigio"][min(j.compras_turno, 1)]
        j.compras_turno += 1
        j.prestigio += 1
        return
    if mk.falta_acoes > 0:
        mk.falta_acoes -= 1
        j.caixa -= mk.custo_acao
        if mk.bif is None and s["bifurcacao"]:
            mk.influencia += 1
        if mk.falta_acoes > 0:
            return
    if mk.falta_parceiros > 0:
        p = p_coop * (P["coop_lider"] if j.sinal else 1.0)
        mk.falta_parceiros -= sum(rng.random() < p for _ in range(mk.falta_parceiros))


def pronto_em(mk, t):
    """Estimativa grosseira do turno em que um marco aberto poderia valer."""
    s = mk.s
    base = max(t, s["turno_min"], mk.atalho_desde or 0)
    return base + math.ceil((mk.falta_acoes + mk.falta_parceiros) / max(1.0, P["acoes_objetivo"]))


def escolher(j, t, bifs):
    """Prioridade: influência em bifurcação ainda aberta, depois o marco mais perto de valer.
    Marcos com janela (ex.: denúncia recente) só são fechados quando os outros estão perto."""
    def segurar(mk):
        if not mk.s["janela"] or mk.falta_acoes + mk.falta_parceiros > 1:
            return False
        outros = [o for o in j.marcos if o is not mk and not o.cumprido]
        return any(pronto_em(o, t) > t + mk.s["janela"] - 1 for o in outros)

    cands = [mk for mk in j.marcos if util(mk, j, t, bifs) and not segurar(mk)]
    if not cands:
        return None
    cands.sort(key=lambda mk: (not mk.bif_pendente(t, bifs),
                               mk.falta_acoes + mk.falta_parceiros + max(0, mk.s["prestigio_min"] - j.prestigio)))
    return cands[0]


def turno_jogador(j, t, n_acoes, bifs, p_coop, rng):
    j.caixa += j.renda
    if j.caixa < 0:
        j.caixa -= -j.caixa * P["juros_credito"]
    j.compras_turno = 0
    for _ in range(n_acoes):
        mk = escolher(j, t, bifs)
        if mk is None:
            break
        gastar_acao(j, mk, t, p_coop, rng)


def verificar(j, t, bifs, ordem):
    """Marca como cumpridos os marcos cujas condições estão todas de pé."""
    for mk in j.marcos:
        if mk.cumprido:
            continue
        s = mk.s
        if t < s["turno_min"] or s["prestigio_min"] > j.prestigio:
            continue
        if mk.falta_acoes > 0 or mk.falta_parceiros > 0:
            continue
        if s["bifurcacao"]:
            if mk.bif is None and s["modo_bifurcacao"] == "evento":
                continue
            if mk.bif == "atalho" and t < mk.atalho_desde:
                continue
        mk.cumprido = True
        mk.cumprido_em = t
    n = j.n_cumpridos()
    if n and n not in j.contagem_em:
        j.contagem_em[n] = (t, ordem)
    for k in list(j.contagem_em):
        if k > n:
            del j.contagem_em[k]
    if n == 3 and j.tres_em is None:
        j.tres_em = (t, ordem)
    if n < 3:
        j.tres_em = None
    if n >= 2:
        j.sinal = True


def resolver_bifurcacoes(t, jogadores, bifs, rng):
    for bid, b in bifs.items():
        if b["turno"] != t:
            continue
        pesos = dict(b["desfechos"])
        interessados = [(j, mk) for j in jogadores for mk in j.marcos if mk.s["bifurcacao"] == bid]
        for j, mk in interessados:
            fav = mk.s["desfecho_favoravel"]
            frac = min(1.0, mk.influencia / max(1, mk.s["acoes"]))
            for d in fav:
                pesos[d] += P["inclinacao"] * frac / len(fav)
        tot = sum(pesos.values())
        r, acc, saida = rng.random() * tot, 0.0, None
        for d, w in pesos.items():
            acc += w
            if r <= acc:
                saida = d
                break
        saida = saida or d
        for j, mk in interessados:
            s = mk.s
            fav = saida in s["desfecho_favoravel"] and rng.random() < s.get("p_condicional", 1.0)
            if fav:
                mk.bif = "favoravel"
                if not s["coop"]:
                    mk.falta_acoes = 0      # influência já cumpriu seu papel
                continue
            mk.bif = "atalho"
            mk.via_atalho = True
            if mk.cumprido:                 # modo "risco": o marco cai
                mk.cumprido = False
            mk.falta_acoes = (mk.falta_acoes if s["coop"] else 0) + s["atalho_acoes"]
            mk.falta_parceiros = max(mk.falta_parceiros, 1)
            mk.custo_acao = max(mk.custo_acao, 1.0) * 1.5
            mk.atalho_desde = t + s["atalho_turnos"]


def perdas(j, t, rng):
    caiu = False
    for mk in j.marcos:
        if not mk.cumprido:
            continue
        if mk.s["janela"] and t - mk.cumprido_em >= mk.s["janela"]:
            mk.derrubar(expirou=True)
            caiu = True
        elif rng.random() < P["perda_passiva"] * mk.fragil:
            mk.derrubar()
            caiu = True
    return caiu


def atacar(alvo, rng):
    alvos = [mk for mk in alvo.marcos if mk.cumprido and mk.fragil > 0]
    if not alvos:
        return False
    mk = rng.choice(alvos)
    if rng.random() < mk.fragil * P["eficacia_ataque"]:
        mk.derrubar()
        return True
    return False


# ----------------------------------------------------------------------------
# Partida
# ----------------------------------------------------------------------------
def partida(variantes, dados, rng, oposicao=True, p_coop=None, intensidade="média"):
    """variantes: lista de dicts de variante. Devolve resumo da partida."""
    p_coop = P["p_coop"] if p_coop is None else p_coop
    a_sinal, a_def = INTENSIDADES[intensidade]
    bifs = dados["bifurcacoes"]
    js = [Jogador(v, dados["papeis"][v["papel"]]) for v in variantes]
    ordem = 0
    tres_primeiro = {}
    reivindicacoes = falhas = 0
    primeira_reiv = None
    for t in range(1, P["turnos"] + 1):
        # 1. ataques (decididos no início do turno, com a informação pública)
        custo_acoes = {j.id: 0 for j in js}
        if oposicao and len(js) > 1:
            defendendo = [j for j in js if j.reivindicando]
            for o in js:
                alvo, inten = None, 0.0
                defs = [d for d in defendendo if d is not o]
                if defs:
                    alvo, inten = rng.choice(defs), a_def
                else:
                    lideres = [l for l in js if l is not o and l.sinal and l.n_cumpridos() >= 2]
                    if lideres:
                        top = max(l.n_cumpridos() for l in lideres)
                        alvo, inten = rng.choice([l for l in lideres if l.n_cumpridos() == top]), a_sinal
                if alvo is None:
                    continue
                for _ in range(sortear_qtd(inten, rng)):
                    if rng.random() < P["custo_ataque"]:
                        custo_acoes[o.id] += 1
                    if atacar(alvo, rng) and alvo.reivindicando:
                        alvo.caiu_na_defesa = True
        # 2. ações dos jogadores
        for j in rng.sample(js, len(js)):
            n = max(0, sortear_qtd(P["acoes_objetivo"], rng) - custo_acoes[j.id])
            turno_jogador(j, t, n, bifs, p_coop, rng)
        # 3. bifurcações
        resolver_bifurcacoes(t, js, bifs, rng)
        # 4. perdas passivas e janelas
        for j in js:
            if perdas(j, t, rng) and j.reivindicando:
                j.caiu_na_defesa = True
        # 5. verificação de marcos
        for j in rng.sample(js, len(js)):
            ordem += 1
            verificar(j, t, bifs, ordem)
            if j.tres_em and j.id not in tres_primeiro:
                tres_primeiro[j.id] = t
        # 6. defesa das reivindicações abertas no turno anterior
        vencedores = []
        for j in js:
            if not j.reivindicando:
                continue
            j.reivindicando = False
            if not j.caiu_na_defesa and j.n_cumpridos() == 3:
                vencedores.append(j)
            else:
                falhas += 1
                j.prestigio = max(0, j.prestigio - 1)
                j.bloqueado_ate = t + 1
                for mk in j.marcos:
                    if mk.cumprido and mk.s["prestigio_min"] > j.prestigio:
                        mk.derrubar()
            j.caiu_na_defesa = False
        if vencedores:
            vencedores.sort(key=lambda x: (x.tres_em or (99, 0), rng.random()))
            v = vencedores[0]
            return dict(vencedor=v.id, papel=v.papel, modo="reivindicação", turno=t,
                        reivindicacoes=reivindicacoes, falhas=falhas, primeira_reiv=primeira_reiv,
                        tres=tres_primeiro)
        # 7. novas reivindicações (a defesa precisa caber até o turno 12)
        if t >= P["reivindicar_desde"] and t < P["turnos"]:
            for j in js:
                if j.n_cumpridos() == 3 and t > j.bloqueado_ate:
                    j.reivindicando = True
                    j.caiu_na_defesa = False
                    reivindicacoes += 1
                    primeira_reiv = primeira_reiv or t
    # 8. fim do turno 12: contagem
    melhor = max(j.n_cumpridos() for j in js)
    cands = [j for j in js if j.n_cumpridos() == melhor]
    cands.sort(key=lambda x: (x.contagem_em.get(melhor, (99, 0)), rng.random()))
    v = cands[0]
    return dict(vencedor=v.id if melhor else None, papel=v.papel if melhor else None,
                modo="contagem" if melhor else "ninguém", turno=P["turnos"], marcos=melhor,
                reivindicacoes=reivindicacoes, falhas=falhas, primeira_reiv=primeira_reiv,
                tres=tres_primeiro)


def solo(var, dados, rng, p_coop=None):
    """Variante sozinha, sem oposição: turno em que os 3 marcos ficam de pé juntos (13 = não completou)."""
    p_coop = P["p_coop"] if p_coop is None else p_coop
    bifs = dados["bifurcacoes"]
    j = Jogador(var, dados["papeis"][var["papel"]])
    for t in range(1, P["turnos"] + 1):
        turno_jogador(j, t, sortear_qtd(P["acoes_objetivo"], rng), bifs, p_coop, rng)
        resolver_bifurcacoes(t, [j], bifs, rng)
        perdas(j, t, rng)
        verificar(j, t, bifs, t)
        if j.n_cumpridos() == 3:
            return t
    return 13


def sortear_mesa(dados, rng):
    por_id = {v["id"]: v for v in dados["variantes"]}
    mesa, agente = [], False
    ordem = sorted(PILOTO, key=lambda p: 0 if p == "Naturalista" else 1)  # sorteio do agente na ordem do doc. 02
    for papel in ordem:
        letra = rng.choice("ABC")
        vid = f"{papel}-{letra}"
        if vid in AGENTES:
            if agente:
                vid = f"{papel}-{rng.choice([l for l in 'ABC' if f'{papel}-{l}' not in AGENTES])}"
            else:
                agente = True
        mesa.append(por_id[vid])
    return mesa


# ----------------------------------------------------------------------------
# Cenários
# ----------------------------------------------------------------------------
def resumo_solo(ts):
    ok = [x for x in ts if x <= 12]
    return dict(media=st.mean(ts), mediana=st.median(ts), p10=sorted(ts)[len(ts) // 10],
                p90=sorted(ts)[9 * len(ts) // 10], completou=len(ok) / len(ts),
                media_ok=st.mean(ok) if ok else None)


def classe(media):
    return "rápida demais" if media < 7 else ("ok" if media <= 9 else "lenta")


def cenario_solo(dados, n, seed, p_coop=None):
    res = {}
    for v in dados["variantes"]:
        rng = random.Random(f"{seed}-{v['id']}")
        res[v["id"]] = resumo_solo([solo(v, dados, rng, p_coop) for _ in range(n)])
    return res


def cenario_piloto(dados, n, seed, p_coop=None, intensidade="média"):
    rng = random.Random(seed)
    jogos = []
    for _ in range(n):
        mesa = sortear_mesa(dados, rng)
        r = partida(mesa, dados, rng, oposicao=True, p_coop=p_coop, intensidade=intensidade)
        r["mesa"] = [v["id"] for v in mesa]
        jogos.append(r)
    return jogos


def resumo_piloto(jogos):
    n = len(jogos)
    reiv = [g for g in jogos if g["modo"] == "reivindicação"]
    turnos = [g["turno"] for g in reiv]
    dist = {t: sum(1 for x in turnos if x == t) / n for t in range(7, 13)}
    por_papel = {p: sum(1 for g in jogos if g["papel"] == p) / n for p in PILOTO}
    por_papel_reiv = {p: sum(1 for g in reiv if g["papel"] == p) / n for p in PILOTO}
    jogou = {}
    venceu = {}
    for g in jogos:
        for vid in g["mesa"]:
            jogou[vid] = jogou.get(vid, 0) + 1
            if g["vencedor"] == vid:
                venceu[vid] = venceu.get(vid, 0) + 1
    por_var = {vid: (venceu.get(vid, 0) / jogou[vid], jogou[vid]) for vid in jogou}
    tres = [min(g["tres"].values()) for g in jogos if g["tres"]]
    return dict(
        n=n, pct_reiv=len(reiv) / n, pct_contagem=sum(1 for g in jogos if g["modo"] == "contagem") / n,
        pct_ninguem=sum(1 for g in jogos if g["modo"] == "ninguém") / n,
        turno_med=st.mean(turnos) if turnos else None, turno_mediana=st.median(turnos) if turnos else None,
        dist=dist, pct_9_12=sum(1 for x in turnos if 9 <= x <= 12) / n,
        pct_antes_9=sum(1 for x in turnos if x < 9) / n,
        por_papel=por_papel, por_papel_reiv=por_papel_reiv, por_var=por_var,
        reivs=st.mean(g["reivindicacoes"] for g in jogos), falhas=st.mean(g["falhas"] for g in jogos),
        primeiro_tres=st.mean(tres) if tres else None, pct_alguem_tres=len(tres) / n,
    )


# ----------------------------------------------------------------------------
# Recomendações: busca de um ajuste numérico simples que traga a variante para 7–9
# ----------------------------------------------------------------------------
def ajustes_possiveis(var, rapido):
    """Gera (descrição, função que altera uma cópia da variante)."""
    out = []
    for i, mk in enumerate(var["marcos"]):
        k = i + 1
        if rapido:
            out.append((f"aumentar ações do marco {k} de {mk['acoes']} para {mk['acoes'] + 1}",
                        lambda v, i=i: v["marcos"][i].__setitem__("acoes", v["marcos"][i]["acoes"] + 1)))
            if mk["coop"]:
                out.append((f"exigir {mk['parceiros'] + 1} acordos no marco {k} (hoje {mk['parceiros']})",
                            lambda v, i=i: v["marcos"][i].__setitem__("parceiros", v["marcos"][i]["parceiros"] + 1)))
            if not mk["bifurcacao"]:
                for d in (2, 3):
                    novo = max(mk["turno_min"], 1) + d
                    out.append((f"marco {k} só pode valer a partir do turno {novo} (hoje {mk['turno_min']})",
                                lambda v, i=i, novo=novo: v["marcos"][i].__setitem__("turno_min", novo)))
        else:
            if mk["acoes"] > 1:
                out.append((f"reduzir ações do marco {k} de {mk['acoes']} para {mk['acoes'] - 1}",
                            lambda v, i=i: v["marcos"][i].__setitem__("acoes", v["marcos"][i]["acoes"] - 1)))
            if mk["coop"] and mk["parceiros"] > 1:
                out.append((f"exigir {mk['parceiros'] - 1} acordo(s) no marco {k} (hoje {mk['parceiros']})",
                            lambda v, i=i: v["marcos"][i].__setitem__("parceiros", v["marcos"][i]["parceiros"] - 1)))
            if mk["prestigio_min"]:
                out.append((f"baixar o prestígio exigido no marco {k} em 1★",
                            lambda v, i=i: v["marcos"][i].__setitem__("prestigio_min", v["marcos"][i]["prestigio_min"] - 1)))
            if mk["custo"] >= 2:
                out.append((f"baixar o custo do marco {k} de ~{mk['custo']}₵ para ~{mk['custo'] // 2}₵",
                            lambda v, i=i: v["marcos"][i].__setitem__("custo", v["marcos"][i]["custo"] // 2)))
            if mk["bifurcacao"] and mk["atalho_acoes"] > 1:
                out.append((f"reduzir ações do atalho do marco {k} de {mk['atalho_acoes']} para {mk['atalho_acoes'] - 1}",
                            lambda v, i=i: v["marcos"][i].__setitem__("atalho_acoes", v["marcos"][i]["atalho_acoes"] - 1)))
            if mk["bifurcacao"] and mk["atalho_turnos"] > 1:
                out.append((f"atalho do marco {k} em {mk['atalho_turnos'] - 1} turno(s) em vez de {mk['atalho_turnos']}",
                            lambda v, i=i: v["marcos"][i].__setitem__("atalho_turnos", v["marcos"][i]["atalho_turnos"] - 1)))
            if mk["janela"]:
                out.append((f"janela do marco {k} de {mk['janela']} para {mk['janela'] + 2} turnos",
                            lambda v, i=i: v["marcos"][i].__setitem__("janela", v["marcos"][i]["janela"] + 2)))
            if not mk["bifurcacao"] and mk["turno_min"] > 3:
                out.append((f"marco {k} pode valer a partir do turno {mk['turno_min'] - 2} (hoje {mk['turno_min']})",
                            lambda v, i=i: v["marcos"][i].__setitem__("turno_min", v["marcos"][i]["turno_min"] - 2)))
    if not rapido:
        out.append(("dar ao papel +1₵ de renda livre por turno (economia)",
                    lambda v: v.__setitem__("renda_extra", v.get("renda_extra", 0) + 1)))
    return out


ROTULOS = dict(acoes="ações", parceiros="acordos exigidos", turno_min="turno mínimo", prestigio_min="★ mínima",
               custo="custo (₵)", atalho_acoes="ações do atalho", atalho_turnos="turnos do atalho", janela="janela (turnos)")


def descrever_diferencas(orig, novo):
    out = []
    for k, (a, b) in enumerate(zip(orig["marcos"], novo["marcos"]), 1):
        for campo, rot in ROTULOS.items():
            if a[campo] != b[campo]:
                out.append(f"marco {k}: {rot} {a[campo]} → {b[campo]}")
    if novo.get("renda_extra"):
        out.append(f"papel: +{novo['renda_extra']}₵ de renda livre por turno (economia)")
    return out


def recomendar(dados, solo_res, n, seed, passos=4):
    """Busca gulosa: aplica, um por vez, o ajuste que mais aproxima a média solo de 8,
    até entrar na faixa 7–9 ou esgotar os passos."""
    recs = {}
    for v in dados["variantes"]:
        media = solo_res[v["id"]]["media"]
        if 7 <= media <= 9:
            continue
        atual, m_atual, descs = json.loads(json.dumps(v)), media, []
        for passo in range(passos):
            tentativas = []
            for desc, f in ajustes_possiveis(atual, m_atual < 7):
                nv = json.loads(json.dumps(atual))
                f(nv)
                rng = random.Random(f"{seed}-rec-{v['id']}-{passo}-{desc}")
                m = st.mean(solo(nv, dados, rng) for _ in range(n))
                tentativas.append((abs(m - 8), m, desc, nv))
            if not tentativas:
                break
            tentativas.sort(key=lambda x: x[0])
            dist, m, desc, nv = tentativas[0]
            if dist >= abs(m_atual - 8) - 0.05:
                break
            atual, m_atual = nv, m
            descs.append(desc)
            if 7 <= m <= 9:
                break
        recs[v["id"]] = dict(media=media, nova_media=m_atual, ajustes=descrever_diferencas(v, atual),
                             nova=atual if descs else None)
    return recs


# ----------------------------------------------------------------------------
# Relatório
# ----------------------------------------------------------------------------
def pct(x):
    return f"{100 * x:.0f}%"


def relatorio(dados, n_solo, n_piloto, n_sens, seed):
    L = []
    L.append("# Ouro Branco — tempo dos objetivos secretos (simulação)")
    L.append("")
    L.append("> Gerado por `simulador/marcos.py` a partir de `simulador/marcos.json` (**o JSON tem spoilers; este relatório não**: "
             "só usa papel+letra e números). Parâmetros no topo de `marcos.py`. Todos os números são de um modelo abstrato: "
             "servem para comparar variantes entre si e apontar desvios, não para prever a mesa real.")
    L.append("")
    L.append(f"Parâmetros principais: {P['acoes_objetivo']} ações/turno no objetivo, p_coop {P['p_coop']}, "
             f"perda passiva {P['perda_passiva']}×fragil, ataque após o sinal {P['ataque_sinal']} ação/oponente, "
             f"na defesa {P['ataque_defesa']}, eficácia do ataque {P['eficacia_ataque']}×fragil, reivindicação a partir do turno {P['reivindicar_desde']}.")
    L.append("")

    pos_conclusoes = len(L)
    # ---- (a) solo
    sres = cenario_solo(dados, n_solo, seed)
    L.append(f"## (a) Cada variante sozinha, sem oposição ({n_solo} simulações cada)")
    L.append("")
    L.append("Turno (fim da resolução) em que os 3 marcos ficam de pé ao mesmo tempo. Quem não completa até o turno 12 conta como 13 na média. "
             "Classificação pela média: **rápida demais** (<7), **ok** (7–9), **lenta** (>9).")
    L.append("")
    L.append("| Variante | Média | Mediana | P10–P90 | Completa até T12 | Classe |")
    L.append("|---|---|---|---|---|---|")
    for v in dados["variantes"]:
        r = sres[v["id"]]
        L.append(f"| {v['id']} | {r['media']:.1f} | {r['mediana']:.0f} | {r['p10']}–{r['p90']} | {pct(r['completou'])} | {classe(r['media'])} |")
    cont = {c: sum(1 for r in sres.values() if classe(r["media"]) == c) for c in ("rápida demais", "ok", "lenta")}
    L.append("")
    L.append(f"Resumo: {cont['rápida demais']} rápidas demais, {cont['ok']} ok, {cont['lenta']} lentas. "
             f"Média geral {st.mean(r['media'] for r in sres.values()):.1f}; "
             f"só as 24 do piloto: {st.mean(sres[v['id']]['media'] for v in dados['variantes'] if v['papel'] in PILOTO):.1f}.")
    L.append("")

    # ---- (b) piloto
    jogos = cenario_piloto(dados, n_piloto, seed)
    rp = resumo_piloto(jogos)
    L.append(f"## (b) Partida piloto com 8 jogadores ({n_piloto} partidas, oposição média, p_coop {P['p_coop']})")
    L.append("")
    L.append("Uma variante sorteada por papel (com a regra do Agente de Kew único).")
    L.append("")
    L.append(f"- **Vitória por reivindicação:** {pct(rp['pct_reiv'])} das partidas · **por contagem no turno 12:** {pct(rp['pct_contagem'])} · ninguém com marco: {pct(rp['pct_ninguem'])}")
    L.append(f"- **Sem vencedor por reivindicação até o turno 12:** {pct(1 - rp['pct_reiv'])}")
    if rp["turno_med"]:
        L.append(f"- Turno da vitória por reivindicação: média {rp['turno_med']:.1f}, mediana {rp['turno_mediana']:.0f}")
    L.append(f"- Vitórias por reivindicação nos turnos 9–12: {pct(rp['pct_9_12'])} das partidas; antes do turno 9: {pct(rp['pct_antes_9'])}")
    if rp["primeiro_tres"]:
        L.append(f"- Primeiro jogador com 3 marcos de pé: turno médio {rp['primeiro_tres']:.1f} ({pct(rp['pct_alguem_tres'])} das partidas têm alguém com 3)")
    L.append(f"- Reivindicações por partida: {rp['reivs']:.2f} · reivindicações derrubadas por partida: {rp['falhas']:.2f}")
    L.append("")
    L.append("**Distribuição do turno da primeira vitória (fração de todas as partidas):**")
    L.append("")
    L.append("| T7 | T8 | T9 | T10 | T11 | T12 | Sem reivindicação vitoriosa |")
    L.append("|---|---|---|---|---|---|---|")
    L.append("| " + " | ".join(pct(rp["dist"][t]) for t in range(7, 13)) + f" | {pct(1 - rp['pct_reiv'])} |")
    L.append("")
    L.append("**Vitória por papel (esperado com equilíbrio: 12,5% cada):**")
    L.append("")
    L.append("| Papel | Vitória total | Por reivindicação | Por contagem |")
    L.append("|---|---|---|---|")
    for p in PILOTO:
        L.append(f"| {p} | {pct(rp['por_papel'][p])} | {pct(rp['por_papel_reiv'][p])} | {pct(rp['por_papel'][p] - rp['por_papel_reiv'][p])} |")
    L.append("")
    L.append("**Taxa de vitória por variante do piloto** (quando está na mesa):")
    L.append("")
    L.append("| Variante | Vitórias | Partidas |")
    L.append("|---|---|---|")
    for vid, (w, nj) in sorted(rp["por_var"].items(), key=lambda x: -x[1][0]):
        L.append(f"| {vid} | {pct(w)} | {nj} |")
    L.append("")

    # ---- (c) sensibilidade
    L.append(f"## (c) Sensibilidade ({n_sens} partidas piloto por célula)")
    L.append("")
    L.append("Intensidade de ataque: baixa = 0,15 ação/oponente após o sinal e 0,3 na defesa; média = 0,3 e 0,6; alta = 0,5 e 1,0.")
    L.append("")
    L.append("| p_coop | Ataque | Vitória por reivindicação | Turno médio | Vitória T9–12 | Antes de T9 | Sem reivindicação vitoriosa | Papel mais forte | Papel mais fraco |")
    L.append("|---|---|---|---|---|---|---|---|---|")
    sens = {}
    for pc in (0.4, 0.6, 0.8):
        for it in INTENSIDADES:
            r = resumo_piloto(cenario_piloto(dados, n_sens, seed + 1, p_coop=pc, intensidade=it))
            sens[(pc, it)] = r
            top = max(r["por_papel"].items(), key=lambda x: x[1])
            bot = min(r["por_papel"].items(), key=lambda x: x[1])
            tm = f"{r['turno_med']:.1f}" if r["turno_med"] else "—"
            L.append(f"| {pc} | {it} | {pct(r['pct_reiv'])} | {tm} | {pct(r['pct_9_12'])} | {pct(r['pct_antes_9'])} | {pct(1 - r['pct_reiv'])} | {top[0]} {pct(top[1])} | {bot[0]} {pct(bot[1])} |")
    L.append("")
    L.append("Solo (sem oposição), média geral das 42 variantes por p_coop:")
    L.append("")
    L.append("| p_coop | Média geral | Rápidas demais | Ok | Lentas |")
    L.append("|---|---|---|---|---|")
    for pc in (0.4, 0.6, 0.8):
        sr = sres if pc == P["p_coop"] else cenario_solo(dados, max(200, n_solo // 4), seed, p_coop=pc)
        c = {k: sum(1 for r in sr.values() if classe(r["media"]) == k) for k in ("rápida demais", "ok", "lenta")}
        L.append(f"| {pc} | {st.mean(r['media'] for r in sr.values()):.1f} | {c['rápida demais']} | {c['ok']} | {c['lenta']} |")
    L.append("")

    # ---- recomendações
    recs = recomendar(dados, sres, max(300, n_solo // 4), seed)
    L.append("## Recomendações de ajuste numérico")
    L.append("")
    L.append("Para cada variante fora da faixa 7–9 (solo), o simulador aplicou, um de cada vez (até 4), o ajuste numérico que mais aproxima "
             "a média de 8. 'Marco N' é o N-ésimo marco da ficha. São sugestões abstratas: o designer decide se o ajuste cabe na ficha.")
    L.append("")
    L.append("| Variante | Média hoje | Ajustes sugeridos (em ordem) | Média com ajustes | Classe nova |")
    L.append("|---|---|---|---|---|")
    for vid, r in recs.items():
        aj = "; ".join(r["ajustes"]) if r["ajustes"] else "nenhum ajuste de um número resolve — rever o desenho"
        L.append(f"| {vid} | {r['media']:.1f} | {aj} | {r['nova_media']:.1f} | {classe(r['nova_media'])} |")
    L.append("")

    # ---- (d) piloto com os ajustes aplicados e alavancas da regra
    ajust = json.loads(json.dumps(dados))
    ajust["variantes"] = [recs[v["id"]]["nova"] if v["id"] in recs and recs[v["id"]]["nova"] else v
                          for v in dados["variantes"]]
    sres2 = cenario_solo(ajust, max(300, n_solo // 4), seed)
    c2 = {k: sum(1 for r in sres2.values() if classe(r["media"]) == k) for k in ("rápida demais", "ok", "lenta")}
    L.append("## (d) E se os ajustes forem aplicados? Alavancas da regra")
    L.append("")
    if recs:
        L.append(f"Com todos os ajustes da tabela acima, solo: {c2['rápida demais']} rápidas demais, {c2['ok']} ok, {c2['lenta']} lentas "
                 f"(média geral {st.mean(r['media'] for r in sres2.values()):.1f}).")
    else:
        L.append("Não há ajustes sugeridos: a 'ficha ajustada' é igual à atual (as duas linhas diferem só pelo acaso da simulação).")
    L.append("")
    L.append("Partida piloto (oposição média, p_coop 0,6), comparando a ficha atual, a ficha ajustada e mudanças na regra de reivindicação:")
    L.append("")
    L.append("| Cenário | Vitória por reivindicação | Turno médio | Antes de T9 | T9–12 | Sem reivindicação vitoriosa | Papel mais forte | Papel mais fraco |")
    L.append("|---|---|---|---|---|---|---|---|")
    alav = [("Ficha atual", dados, {}), ("Ficha ajustada", ajust, {}),
            ("Ficha atual + regra antiga (reivindicar a partir do T6)", dados, {"reivindicar_desde": 6}),
            ("Ficha atual + reivindicar a partir do T7", dados, {"reivindicar_desde": 7}),
            ("Ficha atual + ataques mais eficazes (0,8×fragil)", dados, {"eficacia_ataque": 0.8}),
            ("Ficha atual + oposição alta", dados, {"_int": "alta"})]
    extra = {}
    for nome, dd, mud in alav:
        mud = dict(mud)
        inten = mud.pop("_int", "média")
        velho = {k: P[k] for k in mud}
        P.update(mud)
        r = resumo_piloto(cenario_piloto(dd, n_sens, seed + 2, intensidade=inten))
        P.update(velho)
        extra[nome] = r
        top = max(r["por_papel"].items(), key=lambda x: x[1])
        bot = min(r["por_papel"].items(), key=lambda x: x[1])
        tm = f"{r['turno_med']:.1f}" if r["turno_med"] else "—"
        L.append(f"| {nome} | {pct(r['pct_reiv'])} | {tm} | {pct(r['pct_antes_9'])} | {pct(r['pct_9_12'])} | {pct(1 - r['pct_reiv'])} | {top[0]} {pct(top[1])} | {bot[0]} {pct(bot[1])} |")
    L.append("")
    L.append(f"Vitória por papel: ficha atual com a regra antiga (T6) × ficha atual (T{P['reivindicar_desde']}) × ficha ajustada:")
    L.append("")
    L.append(f"| Papel | Regra antiga (T6) | Atual (T{P['reivindicar_desde']}) | Ajustada |")
    L.append("|---|---|---|---|")
    for p in PILOTO:
        L.append(f"| {p} | {pct(extra['Ficha atual + regra antiga (reivindicar a partir do T6)']['por_papel'][p])} | "
                 f"{pct(extra['Ficha atual']['por_papel'][p])} | {pct(extra['Ficha ajustada']['por_papel'][p])} |")
    L.append("")
    L.append("Variantes do piloto com maior e menor taxa de vitória na ficha ajustada (esperado ≈12,5%):")
    L.append("")
    pv = sorted(extra["Ficha ajustada"]["por_var"].items(), key=lambda x: -x[1][0])
    L.append("Mais fortes: " + ", ".join(f"{vid} {pct(w)}" for vid, (w, _) in pv[:4]) +
             " · Mais fracas: " + ", ".join(f"{vid} {pct(w)}" for vid, (w, _) in pv[-4:]))
    L.append("")

    # ---- conclusões (inseridas no topo)
    at, aj, t6 = extra["Ficha atual"], extra["Ficha ajustada"], extra["Ficha atual + regra antiga (reivindicar a partir do T6)"]
    top = max(rp["por_papel"].items(), key=lambda x: x[1])
    bot = min(rp["por_papel"].items(), key=lambda x: x[1])
    C = ["## Principais conclusões", "",
         f"1. **Sem oposição:** {cont['ok']} das 42 variantes ficam em 7–9 turnos; {cont['rápida demais']} são rápidas demais e "
         f"{cont['lenta']} são lentas (média geral {st.mean(r['media'] for r in sres.values()):.1f}). " +
         (f"Com os ajustes sugeridos: {c2['ok']} ok, {c2['rápida demais']} rápidas, {c2['lenta']} lentas." if recs else
          "Nenhuma variante pede ajuste numérico (a seção de recomendações fica vazia)."),
         f"2. **Com 8 jogadores (reivindicação a partir do turno {P['reivindicar_desde']}):** vitória por reivindicação em "
         f"{pct(rp['pct_reiv'])} das partidas, mediana no turno {rp['turno_mediana']:.0f}, {pct(rp['pct_9_12'])} entre os turnos 9 e 12 "
         f"e {pct(rp['pct_antes_9'])} antes do 9. A partida acaba quando o MAIS RÁPIDO de 8 completa: o primeiro jogador com 3 marcos "
         f"aparece em média no turno {rp['primeiro_tres']:.1f}, e por isso a maior parte das vitórias se concentra no primeiro turno possível.",
         f"3. **A regra é a alavanca do calendário:** com a regra antiga (reivindicar a partir do turno 6), a mesma ficha venceria "
         f"{pct(t6['pct_antes_9'])} das partidas antes do turno 9 (mediana T{t6['turno_mediana']:.0f}). "
         f"Oposição mais forte empurra a vitória para depois, mas aumenta as partidas sem vencedor.",
         f"4. **Poucas partidas sem vencedor:** {pct(1 - rp['pct_reiv'])} no cenário base; o risco só cresce com p_coop baixo e ataque alto "
         f"(até {pct(1 - sens[(0.4, 'alta')]['pct_reiv'])}).",
         f"5. **Equilíbrio entre papéis:** na ficha atual {top[0]} vence {pct(top[1])} e {bot[0]} {pct(bot[1])} (esperado 12,5%). "
         "As variantes com maior e menor taxa de vitória estão na seção (b); as do agente das sementes tendem a ficar acima da média "
         "porque o marco da Germinação quase não cai.",
         "6. **Limites do modelo:** dinheiro por papel é aproximado a partir de `economia.py` (cenário 'Mesa oportunista'); "
         "alvos ausentes da mesa, atalhos opcionais das cartas de arco e PNJs não foram simulados; a oposição ataca às cegas, "
         "com chance proporcional à fragilidade, sem deduzir o objetivo exato.", ""]
    L[pos_conclusoes:pos_conclusoes] = C
    return "\n".join(L), dict(solo=sres, piloto=rp, sens=sens, recs=recs, solo_ajustado=sres2, alavancas=extra)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=2000, help="simulações solo por variante e partidas piloto")
    ap.add_argument("--n-sens", type=int, default=1000)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--json")
    ap.add_argument("--md")
    a = ap.parse_args()
    dados = carregar(a.json)
    texto, _ = relatorio(dados, a.n, a.n, a.n_sens, a.seed)
    print(texto)
    if a.md:
        with open(a.md, "w", encoding="utf-8") as f:
            f.write(texto + "\n")
