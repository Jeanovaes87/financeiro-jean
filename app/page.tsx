"use client";

import { useEffect, useMemo, useState } from "react";

type Trabalho = {
  id: string;
  data: string;
  cliente: string;
  tipo: string;
  valorCobrado: number;
  recebido: boolean;
  entregue: boolean;
  freelaNome: string;
  freelaValor: number;
  freelaPago: boolean;
  observacoes: string;
};

type Custo = {
  id: string;
  data: string;
  nome: string;
  valor: number;
  tipo: "Empresa" | "Pessoal" | "Trabalho";
  trabalhoId?: string;
  observacoes?: string;
};

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function money(value: number) {
  return moeda.format(Number.isFinite(value) ? value : 0);
}

function getMonthKey(date: string) {
  if (!date) return "";
  return date.slice(0, 7);
}

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function shiftMonth(monthKey: string, direction: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + direction, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function todayMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shortDate(date: string) {
  if (!date) return "--/--";
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

const initialTrabalhos: Trabalho[] = [];

const initialCustos: Custo[] = [];

export default function FinanceiroJeanNovaes() {
  const [activeTab, setActiveTab] = useState<"Dashboard" | "Trabalhos" | "Custos">("Dashboard");
  const [month, setMonth] = useState("2026-05");
  const [trabalhos, setTrabalhos] = useState<Trabalho[]>([]);
  const [custos, setCustos] = useState<Custo[]>([]);
  const [novoTrabalhoAberto, setNovoTrabalhoAberto] = useState(false);
  const [novoCustoAberto, setNovoCustoAberto] = useState(false);
  const [trabalhoAbertoId, setTrabalhoAbertoId] = useState<string | null>(null);

  const [novoTrabalho, setNovoTrabalho] = useState({
    data: "2026-05-12",
    cliente: "",
    tipo: "",
    valorCobrado: "",
    recebido: false,
    entregue: false,
    freelaNome: "",
    freelaValor: "",
    freelaPago: false,
    observacoes: "",
  });

  const [novoCusto, setNovoCusto] = useState({
    data: "2026-05-12",
    tipo: "Empresa" as "Empresa" | "Pessoal",
    nome: "",
    valor: "",
    observacoes: "",
  });

  useEffect(() => {
    const savedTrabalhos = localStorage.getItem("jn_trabalhos");
    const savedCustos = localStorage.getItem("jn_custos");

    setTrabalhos(savedTrabalhos ? JSON.parse(savedTrabalhos) : initialTrabalhos);
    setCustos(savedCustos ? JSON.parse(savedCustos) : initialCustos);
  }, []);

  useEffect(() => {
    if (trabalhos.length) localStorage.setItem("jn_trabalhos", JSON.stringify(trabalhos));
  }, [trabalhos]);

  useEffect(() => {
    if (custos.length) localStorage.setItem("jn_custos", JSON.stringify(custos));
  }, [custos]);

  const trabalhosDoMes = useMemo(
    () => trabalhos
      .filter((t) => getMonthKey(t.data) === month)
      .sort((a, b) => a.data.localeCompare(b.data)),
    [trabalhos, month]
  );

  const custosDoMes = useMemo(
    () => custos
      .filter((c) => getMonthKey(c.data) === month)
      .sort((a, b) => a.data.localeCompare(b.data)),
    [custos, month]
  );

  const stats = useMemo(() => {
    const entrou = trabalhosDoMes
      .filter((t) => t.recebido)
      .reduce((sum, t) => sum + t.valorCobrado, 0);

    const custosGerais = custosDoMes.reduce((sum, c) => sum + c.valor, 0);

    const freelasPagos = trabalhosDoMes
      .filter((t) => t.freelaPago)
      .reduce((sum, t) => sum + t.freelaValor, 0);

    const saiu = custosGerais + freelasPagos;

    return {
      entrou,
      saiu,
      sobrou: entrou - saiu,
      totalCustosMes: custosDoMes.reduce((sum, c) => sum + c.valor, 0),
    };
  }, [trabalhosDoMes, custosDoMes]);

  function custosDoTrabalho(trabalhoId: string) {
    return custos.filter((c) => c.trabalhoId === trabalhoId);
  }

  function totalCustosTrabalho(trabalho: Trabalho) {
    const custosVinculados = custosDoTrabalho(trabalho.id).reduce((sum, c) => sum + c.valor, 0);
    return custosVinculados + trabalho.freelaValor;
  }

  function lucroPrevisto(trabalho: Trabalho) {
    return trabalho.valorCobrado - totalCustosTrabalho(trabalho);
  }

  function trabalhoFinalizado(trabalho: Trabalho) {
    return trabalho.recebido && trabalho.entregue && (!trabalho.freelaValor || trabalho.freelaPago);
  }

  function salvarTrabalho() {
    const trabalho: Trabalho = {
      id: crypto.randomUUID(),
      data: novoTrabalho.data,
      cliente: novoTrabalho.cliente || "Sem cliente",
      tipo: novoTrabalho.tipo || "Trabalho",
      valorCobrado: Number(novoTrabalho.valorCobrado) || 0,
      recebido: novoTrabalho.recebido,
      entregue: novoTrabalho.entregue,
      freelaNome: novoTrabalho.freelaNome,
      freelaValor: Number(novoTrabalho.freelaValor) || 0,
      freelaPago: novoTrabalho.freelaPago,
      observacoes: novoTrabalho.observacoes,
    };

    setTrabalhos((prev) => [trabalho, ...prev]);
    setMonth(getMonthKey(trabalho.data));
    setNovoTrabalhoAberto(false);
    setNovoTrabalho({
      data: trabalho.data,
      cliente: "",
      tipo: "",
      valorCobrado: "",
      recebido: false,
      entregue: false,
      freelaNome: "",
      freelaValor: "",
      freelaPago: false,
      observacoes: "",
    });
  }

  function salvarCusto() {
    const custo: Custo = {
      id: crypto.randomUUID(),
      data: novoCusto.data,
      nome: novoCusto.nome || "Custo",
      valor: Number(novoCusto.valor) || 0,
      tipo: novoCusto.tipo,
      observacoes: novoCusto.observacoes,
    };

    setCustos((prev) => [custo, ...prev]);
    setMonth(getMonthKey(custo.data));
    setNovoCustoAberto(false);
    setNovoCusto({
      data: custo.data,
      tipo: "Empresa",
      nome: "",
      valor: "",
      observacoes: "",
    });
  }

  function toggleTrabalho(id: string, key: "recebido" | "entregue" | "freelaPago") {
    setTrabalhos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [key]: !t[key] } : t))
    );
  }

  function updateObservacoes(id: string, observacoes: string) {
    setTrabalhos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, observacoes } : t))
    );
  }

  const navItems: Array<typeof activeTab> = ["Dashboard", "Trabalhos", "Custos"];

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-28 md:pb-8 md:flex">
      <aside className="hidden md:flex w-72 border-r border-zinc-800 p-6 flex-col gap-3 sticky top-0 h-screen">
        <h2 className="text-xl font-bold mb-6">Financeiro Jean Novaes</h2>

        {navItems.map((item) => (
          <button
            key={item}
            onClick={() => setActiveTab(item)}
            className={`rounded-2xl p-4 text-left ${
              activeTab === item
                ? "bg-white text-black font-semibold"
                : "bg-zinc-900 border border-zinc-800"
            }`}
          >
            {item}
          </button>
        ))}
      </aside>

      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <header>
            <h1 className="text-3xl md:text-5xl font-bold">
              Financeiro Jean Novaes Audiovisual
            </h1>
          </header>

          {activeTab === "Dashboard" && (
            <>
              <ResumoCards entrou={stats.entrou} saiu={stats.saiu} sobrou={stats.sobrou} />

              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <button
                    onClick={() => setNovoTrabalhoAberto((v) => !v)}
                    className="w-full bg-white text-black rounded-3xl p-5 text-lg font-semibold hover:scale-[1.02] transition"
                  >
                    + Novo Trabalho
                  </button>

                  {novoTrabalhoAberto && (
                    <NovoTrabalhoForm
                      value={novoTrabalho}
                      setValue={setNovoTrabalho}
                      onSave={salvarTrabalho}
                    />
                  )}
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => setNovoCustoAberto((v) => !v)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-lg font-semibold hover:scale-[1.02] transition"
                  >
                    + Novo Custo
                  </button>

                  {novoCustoAberto && (
                    <NovoCustoForm
                      value={novoCusto}
                      setValue={setNovoCusto}
                      onSave={salvarCusto}
                    />
                  )}
                </div>
              </section>

              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TrabalhosMes
                  month={month}
                  setMonth={setMonth}
                  trabalhos={trabalhosDoMes.slice(0, 5)}
                  trabalhoAbertoId={trabalhoAbertoId}
                  setTrabalhoAbertoId={setTrabalhoAbertoId}
                  custosDoTrabalho={custosDoTrabalho}
                  totalCustosTrabalho={totalCustosTrabalho}
                  lucroPrevisto={lucroPrevisto}
                  trabalhoFinalizado={trabalhoFinalizado}
                  toggleTrabalho={toggleTrabalho}
                  updateObservacoes={updateObservacoes}
                />

                <UltimosCustos custos={custosDoMes.slice(0, 5)} />
              </section>
            </>
          )}

          {activeTab === "Trabalhos" && (
            <section className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 space-y-5">
              <MonthHeader title="Trabalhos" month={month} setMonth={setMonth} count={`${trabalhosDoMes.length} trabalhos`} />
              <ListaTrabalhosCompacta
                trabalhos={trabalhosDoMes}
                trabalhoFinalizado={trabalhoFinalizado}
                onOpen={(id) => setTrabalhoAbertoId(id)}
              />
            </section>
          )}

          {activeTab === "Custos" && (
            <section className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 space-y-5">
              <MonthHeader title="Custos" month={month} setMonth={setMonth} count={money(stats.totalCustosMes)} />
              <ListaCustos custos={custosDoMes} total={stats.totalCustosMes} />
            </section>
          )}
        </div>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 p-4 flex items-center justify-around">
        {navItems.map((item) => (
          <button
            key={item}
            onClick={() => setActiveTab(item)}
            className={`flex flex-col items-center gap-1 ${
              activeTab === item ? "text-white" : "text-zinc-500"
            }`}
          >
            <span className="text-lg">●</span>
            <span className="text-xs">{item}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}

function ResumoCards({ entrou, saiu, sobrou }: { entrou: number; saiu: number; sobrou: number }) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[
        ["Entrou no mês", entrou],
        ["Saiu no mês", saiu],
        ["Sobrou", sobrou],
      ].map(([label, value]) => (
        <div key={String(label)} className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800">
          <p className="text-zinc-400 text-sm">{label}</p>
          <h2 className="text-3xl font-bold mt-2">{money(Number(value))}</h2>
        </div>
      ))}
    </section>
  );
}

function MonthHeader({
  title,
  month,
  setMonth,
  count,
}: {
  title: string;
  month: string;
  setMonth: (month: string) => void;
  count?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-zinc-500 text-xs uppercase tracking-wide">Mês vigente</p>
        <div className="flex items-center gap-3 mt-1">
          <button className="text-zinc-500 text-xl" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
          <h3 className="text-xl md:text-2xl font-bold capitalize">
            {title} — {monthLabel(month)}
          </h3>
          <button className="text-zinc-500 text-xl" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
        </div>
      </div>

      {count && <p className="text-zinc-500 text-sm">{count}</p>}
    </div>
  );
}

function TrabalhosMes(props: {
  month: string;
  setMonth: (month: string) => void;
  trabalhos: Trabalho[];
  trabalhoAbertoId: string | null;
  setTrabalhoAbertoId: (id: string | null) => void;
  custosDoTrabalho: (id: string) => Custo[];
  totalCustosTrabalho: (t: Trabalho) => number;
  lucroPrevisto: (t: Trabalho) => number;
  trabalhoFinalizado: (t: Trabalho) => boolean;
  toggleTrabalho: (id: string, key: "recebido" | "entregue" | "freelaPago") => void;
  updateObservacoes: (id: string, observacoes: string) => void;
}) {
  return (
    <div className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 space-y-5">
      <MonthHeader
        title="Trabalhos"
        month={props.month}
        setMonth={props.setMonth}
        count={`${props.trabalhos.length} trabalhos`}
      />

      <ListaTrabalhosCompacta
        trabalhos={props.trabalhos}
        trabalhoFinalizado={props.trabalhoFinalizado}
        onOpen={(id) => props.setTrabalhoAbertoId(props.trabalhoAbertoId === id ? null : id)}
      />

      {props.trabalhoAbertoId && (
        <TrabalhoExpandido
          trabalho={props.trabalhos.find((t) => t.id === props.trabalhoAbertoId) || props.trabalhos[0]}
          custos={props.custosDoTrabalho(props.trabalhoAbertoId)}
          totalCustos={props.totalCustosTrabalho(props.trabalhos.find((t) => t.id === props.trabalhoAbertoId) || props.trabalhos[0])}
          lucro={props.lucroPrevisto(props.trabalhos.find((t) => t.id === props.trabalhoAbertoId) || props.trabalhos[0])}
          toggleTrabalho={props.toggleTrabalho}
          updateObservacoes={props.updateObservacoes}
        />
      )}
    </div>
  );
}

function ListaTrabalhosCompacta({
  trabalhos,
  trabalhoFinalizado,
  onOpen,
}: {
  trabalhos: Trabalho[];
  trabalhoFinalizado: (t: Trabalho) => boolean;
  onOpen: (id: string) => void;
}) {
  if (!trabalhos.length) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-zinc-500">
        Nenhum trabalho neste mês.
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-2xl overflow-hidden">
      {trabalhos.map((item) => (
        <button
          key={item.id}
          onClick={() => onOpen(item.id)}
          className={`w-full flex items-center justify-between gap-4 p-4 text-left transition hover:bg-zinc-900 ${
            trabalhoFinalizado(item) ? "opacity-50" : "opacity-100"
          }`}
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-semibold shrink-0">
              {shortDate(item.data)}
            </div>

            <div className="min-w-0">
              <h4 className="font-semibold truncate">{item.tipo}</h4>
              <p className="text-zinc-500 text-sm truncate">{item.cliente}</p>
            </div>
          </div>

          <span className="text-zinc-600 text-lg shrink-0">›</span>
        </button>
      ))}
    </div>
  );
}

function TrabalhoExpandido({
  trabalho,
  custos,
  totalCustos,
  lucro,
  toggleTrabalho,
  updateObservacoes,
}: {
  trabalho: Trabalho;
  custos: Custo[];
  totalCustos: number;
  lucro: number;
  toggleTrabalho: (id: string, key: "recebido" | "entregue" | "freelaPago") => void;
  updateObservacoes: (id: string, observacoes: string) => void;
}) {
  if (!trabalho) return null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
      <div className="p-5 border-b border-zinc-800 grid grid-cols-1 md:grid-cols-4 gap-3">
        {[
          ["Data", new Date(trabalho.data).toLocaleDateString("pt-BR")],
          ["Cliente", trabalho.cliente],
          ["Tipo", trabalho.tipo],
          ["Valor", money(trabalho.valorCobrado)],
        ].map(([label, value]) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <p className="text-zinc-500 text-xs">{label}</p>
            <p className="font-semibold mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="p-5 border-b border-zinc-800 flex flex-wrap gap-3">
        <StatusButton active={trabalho.recebido} onClick={() => toggleTrabalho(trabalho.id, "recebido")} trueText="Recebido" falseText="A receber" />
        <StatusButton active={trabalho.entregue} onClick={() => toggleTrabalho(trabalho.id, "entregue")} trueText="Entregue" falseText="Pendente entrega" />
        {!!trabalho.freelaValor && (
          <StatusButton active={trabalho.freelaPago} onClick={() => toggleTrabalho(trabalho.id, "freelaPago")} trueText="Freela pago" falseText="Freela pendente" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 p-5 border-b border-zinc-800">
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
          <p className="text-zinc-500 text-xs">Custos</p>
          <p className="font-semibold mt-1">{money(totalCustos)}</p>
        </div>

        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
          <p className="text-zinc-500 text-xs">Lucro previsto</p>
          <p className="font-semibold mt-1">{money(lucro)}</p>
        </div>
      </div>

      <div className="p-5 space-y-4 border-b border-zinc-800">
        <h5 className="font-semibold">Custos do trabalho</h5>

        <div className="space-y-3">
          {custos.map((custo) => (
            <div key={custo.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <div>
                <p className="font-medium">{custo.nome}</p>
                <p className="text-zinc-500 text-sm">{custo.tipo}</p>
              </div>

              <p className="font-semibold">{money(custo.valor)}</p>
            </div>
          ))}

          {!!trabalho.freelaValor && (
            <div className="flex items-center justify-between bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4">
              <div>
                <p className="font-medium">Freela — {trabalho.freelaNome || "sem nome"}</p>
                <p className="text-orange-300 text-sm">Custo automático do trabalho</p>
              </div>

              <p className="font-semibold">{money(trabalho.freelaValor)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-5">
        <textarea
          value={trabalho.observacoes}
          onChange={(event) => updateObservacoes(trabalho.id, event.target.value)}
          placeholder="Observações"
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 outline-none w-full min-h-[100px]"
        />
      </div>
    </div>
  );
}

function StatusButton({
  active,
  onClick,
  trueText,
  falseText,
}: {
  active: boolean;
  onClick: () => void;
  trueText: string;
  falseText: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl px-4 py-3 text-sm font-medium ${
        active
          ? "bg-green-500/15 text-green-300 border border-green-500/20"
          : "bg-yellow-500/15 text-yellow-300 border border-yellow-500/20"
      }`}
    >
      {active ? trueText : falseText}
    </button>
  );
}

function NovoTrabalhoForm({
  value,
  setValue,
  onSave,
}: {
  value: {
    data: string;
    cliente: string;
    tipo: string;
    valorCobrado: string;
    recebido: boolean;
    entregue: boolean;
    freelaNome: string;
    freelaValor: string;
    freelaPago: boolean;
    observacoes: string;
  };
  setValue: (value: any) => void;
  onSave: () => void;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input type="date" value={value.data} onChange={(e) => setValue({ ...value, data: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 outline-none" />
        <input placeholder="Cliente" value={value.cliente} onChange={(e) => setValue({ ...value, cliente: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 outline-none" />
        <input placeholder="Tipo de trabalho" value={value.tipo} onChange={(e) => setValue({ ...value, tipo: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 outline-none" />
      </div>

      <input placeholder="Valor cobrado" value={value.valorCobrado} onChange={(e) => setValue({ ...value, valorCobrado: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 outline-none w-full" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button onClick={() => setValue({ ...value, recebido: !value.recebido })} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-left">
          Recebido? {value.recebido ? "Sim" : "Não"}
        </button>

        <button onClick={() => setValue({ ...value, entregue: !value.entregue })} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-left">
          Entregue? {value.entregue ? "Sim" : "Não"}
        </button>
      </div>

      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <h4 className="font-semibold">Freela</h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input placeholder="Nome do freela" value={value.freelaNome} onChange={(e) => setValue({ ...value, freelaNome: e.target.value })} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 outline-none" />
          <input placeholder="Valor do freela" value={value.freelaValor} onChange={(e) => setValue({ ...value, freelaValor: e.target.value })} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 outline-none" />
          <button onClick={() => setValue({ ...value, freelaPago: !value.freelaPago })} className="bg-orange-500/15 text-orange-300 border border-orange-500/20 rounded-2xl p-4 text-left">
            Freela pago? {value.freelaPago ? "Sim" : "Não"}
          </button>
        </div>
      </div>

      <textarea placeholder="Observações" value={value.observacoes} onChange={(e) => setValue({ ...value, observacoes: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 outline-none w-full min-h-[100px]" />

      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-2">
        <p className="text-sm text-zinc-300">Ao salvar:</p>
        <ul className="text-sm text-zinc-500 space-y-1">
          <li>• O trabalho entra automaticamente no mês correto</li>
          <li>• Entrou / Saiu / Sobrou são recalculados</li>
          <li>• Freela entra automaticamente como custo do trabalho</li>
          <li>• Trabalhos finalizados continuam na lista</li>
        </ul>
      </div>

      <button onClick={onSave} className="w-full bg-white text-black rounded-2xl p-4 font-semibold">
        Salvar trabalho
      </button>
    </div>
  );
}

function NovoCustoForm({
  value,
  setValue,
  onSave,
}: {
  value: {
    data: string;
    tipo: "Empresa" | "Pessoal";
    nome: string;
    valor: string;
    observacoes: string;
  };
  setValue: (value: any) => void;
  onSave: () => void;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {(["Empresa", "Pessoal"] as const).map((tipo) => (
          <button
            key={tipo}
            onClick={() => setValue({ ...value, tipo })}
            className={`rounded-2xl p-4 font-medium ${
              value.tipo === tipo
                ? "bg-white text-black"
                : "bg-zinc-950 border border-zinc-800"
            }`}
          >
            {tipo}
          </button>
        ))}
      </div>

      <input type="date" value={value.data} onChange={(e) => setValue({ ...value, data: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 outline-none w-full" />

      <input placeholder="Nome" value={value.nome} onChange={(e) => setValue({ ...value, nome: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 outline-none w-full" />

      <input placeholder="Valor" value={value.valor} onChange={(e) => setValue({ ...value, valor: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 outline-none w-full" />

      <textarea placeholder="Observação" value={value.observacoes} onChange={(e) => setValue({ ...value, observacoes: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 outline-none w-full min-h-[90px]" />

      <button onClick={onSave} className="w-full bg-white text-black rounded-2xl p-4 font-semibold">
        Salvar custo
      </button>
    </div>
  );
}

function UltimosCustos({ custos }: { custos: Custo[] }) {
  return (
    <div className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 space-y-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xl font-bold">Últimos custos</h3>
        <p className="text-zinc-500 text-sm">{custos.length} registros</p>
      </div>

      <ListaCustos custos={custos} />
    </div>
  );
}

function ListaCustos({ custos, total }: { custos: Custo[]; total?: number }) {
  if (!custos.length) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-zinc-500">
        Nenhum custo neste mês.
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-2xl overflow-hidden">
        {custos.map((custo) => (
          <div key={custo.id} className="flex items-center justify-between gap-4 p-4 bg-zinc-950">
            <div>
              <h4 className="font-semibold">{custo.nome}</h4>
              <p className="text-zinc-500 text-sm mt-1">
                {shortDate(custo.data)} • {custo.tipo}
              </p>
            </div>

            <p className="font-bold">{money(custo.valor)}</p>
          </div>
        ))}
      </div>

      {typeof total === "number" && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-zinc-500 text-sm">Total do mês</p>
            <p className="font-bold text-2xl mt-1">{money(total)}</p>
          </div>
        </div>
      )}
    </>
  );
}
