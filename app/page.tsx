"use client";

import { useEffect, useMemo, useState } from "react";

type Trabalho = {
  id: string;
  data: string;
  cliente: string;
  tipo_trabalho: string;
  valor_cobrado: number;
  recebido: boolean;
  entregue: boolean;
  freela_nome: string;
  freela_valor: number;
  freela_pago: boolean;
  observacoes: string;
  created_at?: string;
};

type Custo = {
  id: string;
  data: string;
  nome: string;
  valor: number;
  tipo: "Empresa" | "Pessoal" | "Trabalho";
  trabalho_id?: string | null;
  observacoes?: string;
  created_at?: string;
};

const SUPABASE_URL = "https://whjwzkmfrkkletjlyiin.supabase.co";
const SUPABASE_KEY = "sb_publishable_XmDbAw7t2R7cGXfSC6P6Sg_muVxF5wA";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function money(value: number) {
  return moeda.format(Number.isFinite(value) ? value : 0);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function todayMonthKey() {
  return todayDate().slice(0, 7);
}

function getMonthKey(date: string) {
  return date ? date.slice(0, 7) : "";
}

function shiftMonth(monthKey: string, direction: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + direction, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function shortDate(date: string) {
  if (!date) return "--/--";
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

async function supabaseGet<T>(table: string): Promise<T[]> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=data.asc`, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar ${table}`);
  }

  return response.json();
}

async function supabaseInsert<T>(table: string, body: unknown): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text);
  }

  const data = await response.json();
  return data[0];
}

async function supabasePatch<T>(table: string, id: string, body: unknown): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      ...headers,
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text);
  }

  const data = await response.json();
  return data[0];
}

export default function FinanceiroJeanNovaes() {
  const [activeTab, setActiveTab] = useState<"Dashboard" | "Trabalhos" | "Custos">("Dashboard");
  const [month, setMonth] = useState(todayMonthKey());
  const [trabalhos, setTrabalhos] = useState<Trabalho[]>([]);
  const [custos, setCustos] = useState<Custo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [novoTrabalhoAberto, setNovoTrabalhoAberto] = useState(false);
  const [novoCustoAberto, setNovoCustoAberto] = useState(false);
  const [trabalhoAbertoId, setTrabalhoAbertoId] = useState<string | null>(null);

  const [novoTrabalho, setNovoTrabalho] = useState({
    data: todayDate(),
    cliente: "",
    tipo_trabalho: "",
    valor_cobrado: "",
    recebido: false,
    entregue: false,
    freela_nome: "",
    freela_valor: "",
    freela_pago: false,
    observacoes: "",
  });

  const [novoCusto, setNovoCusto] = useState({
    data: todayDate(),
    tipo: "Empresa" as "Empresa" | "Pessoal",
    nome: "",
    valor: "",
    observacoes: "",
  });

  async function carregarDados() {
    try {
      setLoading(true);
      setErro("");
      const [trabalhosData, custosData] = await Promise.all([
        supabaseGet<Trabalho>("trabalhos"),
        supabaseGet<Custo>("custos"),
      ]);

      setTrabalhos(trabalhosData);
      setCustos(custosData);
    } catch (error) {
      setErro("Não consegui carregar os dados do Supabase.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  const trabalhosDoMes = useMemo(
    () =>
      trabalhos
        .filter((t) => getMonthKey(t.data) === month)
        .sort((a, b) => a.data.localeCompare(b.data)),
    [trabalhos, month]
  );

  const custosDoMes = useMemo(
    () =>
      custos
        .filter((c) => getMonthKey(c.data) === month)
        .sort((a, b) => a.data.localeCompare(b.data)),
    [custos, month]
  );

  const stats = useMemo(() => {
    const entrou = trabalhosDoMes
      .filter((t) => t.recebido)
      .reduce((sum, t) => sum + Number(t.valor_cobrado || 0), 0);

    const custosGerais = custosDoMes.reduce((sum, c) => sum + Number(c.valor || 0), 0);

    const freelasPagos = trabalhosDoMes
      .filter((t) => t.freela_pago)
      .reduce((sum, t) => sum + Number(t.freela_valor || 0), 0);

    const saiu = custosGerais + freelasPagos;

    return {
      entrou,
      saiu,
      sobrou: entrou - saiu,
      totalCustosMes: custosDoMes.reduce((sum, c) => sum + Number(c.valor || 0), 0),
    };
  }, [trabalhosDoMes, custosDoMes]);

  function custosDoTrabalho(trabalhoId: string) {
    return custos.filter((c) => c.trabalho_id === trabalhoId);
  }

  function totalCustosTrabalho(trabalho: Trabalho) {
    const custosVinculados = custosDoTrabalho(trabalho.id).reduce((sum, c) => sum + Number(c.valor || 0), 0);
    return custosVinculados + Number(trabalho.freela_valor || 0);
  }

  function lucroPrevisto(trabalho: Trabalho) {
    return Number(trabalho.valor_cobrado || 0) - totalCustosTrabalho(trabalho);
  }

  function trabalhoFinalizado(trabalho: Trabalho) {
    return trabalho.recebido && trabalho.entregue && (!trabalho.freela_valor || trabalho.freela_pago);
  }

  async function salvarTrabalho() {
    try {
      setErro("");

      const trabalho = await supabaseInsert<Trabalho>("trabalhos", {
        data: novoTrabalho.data,
        cliente: novoTrabalho.cliente || "Sem cliente",
        tipo_trabalho: novoTrabalho.tipo_trabalho || "Trabalho",
        valor_cobrado: Number(novoTrabalho.valor_cobrado) || 0,
        recebido: novoTrabalho.recebido,
        entregue: novoTrabalho.entregue,
        freela_nome: novoTrabalho.freela_nome,
        freela_valor: Number(novoTrabalho.freela_valor) || 0,
        freela_pago: novoTrabalho.freela_pago,
        observacoes: novoTrabalho.observacoes,
      });

      setTrabalhos((prev) => [...prev, trabalho]);
      setMonth(getMonthKey(trabalho.data));
      setNovoTrabalhoAberto(false);
      setNovoTrabalho({
        data: todayDate(),
        cliente: "",
        tipo_trabalho: "",
        valor_cobrado: "",
        recebido: false,
        entregue: false,
        freela_nome: "",
        freela_valor: "",
        freela_pago: false,
        observacoes: "",
      });
    } catch (error) {
      setErro("Não consegui salvar o trabalho. Veja se o Supabase está liberado.");
      console.error(error);
    }
  }

  async function salvarCusto() {
    try {
      setErro("");

      const custo = await supabaseInsert<Custo>("custos", {
        data: novoCusto.data,
        nome: novoCusto.nome || "Custo",
        valor: Number(novoCusto.valor) || 0,
        tipo: novoCusto.tipo,
        observacoes: novoCusto.observacoes,
      });

      setCustos((prev) => [...prev, custo]);
      setMonth(getMonthKey(custo.data));
      setNovoCustoAberto(false);
      setNovoCusto({
        data: todayDate(),
        tipo: "Empresa",
        nome: "",
        valor: "",
        observacoes: "",
      });
    } catch (error) {
      setErro("Não consegui salvar o custo. Veja se o Supabase está liberado.");
      console.error(error);
    }
  }

  async function toggleTrabalho(id: string, key: "recebido" | "entregue" | "freela_pago") {
    const atual = trabalhos.find((t) => t.id === id);
    if (!atual) return;

    const novoValor = !atual[key];

    setTrabalhos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [key]: novoValor } : t))
    );

    try {
      await supabasePatch<Trabalho>("trabalhos", id, { [key]: novoValor });
    } catch (error) {
      console.error(error);
      carregarDados();
    }
  }

  async function updateObservacoes(id: string, observacoes: string) {
    setTrabalhos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, observacoes } : t))
    );

    try {
      await supabasePatch<Trabalho>("trabalhos", id, { observacoes });
    } catch (error) {
      console.error(error);
    }
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

          {erro && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-2xl p-4">
              {erro}
            </div>
          )}

          {loading && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-zinc-400">
              Carregando dados...
            </div>
          )}

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
  toggleTrabalho: (id: string, key: "recebido" | "entregue" | "freela_pago") => void;
  updateObservacoes: (id: string, observacoes: string) => void;
}) {
  const trabalhoAberto = props.trabalhos.find((t) => t.id === props.trabalhoAbertoId);

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

      {trabalhoAberto && (
        <TrabalhoExpandido
          trabalho={trabalhoAberto}
          custos={props.custosDoTrabalho(trabalhoAberto.id)}
          totalCustos={props.totalCustosTrabalho(trabalhoAberto)}
          lucro={props.lucroPrevisto(trabalhoAberto)}
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
              <h4 className="font-semibold truncate">{item.tipo_trabalho}</h4>
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
  toggleTrabalho: (id: string, key: "recebido" | "entregue" | "freela_pago") => void;
  updateObservacoes: (id: string, observacoes: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
      <div className="p-5 border-b border-zinc-800 grid grid-cols-1 md:grid-cols-4 gap-3">
        {[
          ["Data", new Date(trabalho.data).toLocaleDateString("pt-BR")],
          ["Cliente", trabalho.cliente],
          ["Tipo", trabalho.tipo_trabalho],
          ["Valor", money(Number(trabalho.valor_cobrado || 0))],
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
        {!!trabalho.freela_valor && (
          <StatusButton active={trabalho.freela_pago} onClick={() => toggleTrabalho(trabalho.id, "freela_pago")} trueText="Freela pago" falseText="Freela pendente" />
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

              <p className="font-semibold">{money(Number(custo.valor || 0))}</p>
            </div>
          ))}

          {!!trabalho.freela_valor && (
            <div className="flex items-center justify-between bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4">
              <div>
                <p className="font-medium">Freela — {trabalho.freela_nome || "sem nome"}</p>
                <p className="text-orange-300 text-sm">Custo automático do trabalho</p>
              </div>

              <p className="font-semibold">{money(Number(trabalho.freela_valor || 0))}</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-5">
        <textarea
          value={trabalho.observacoes || ""}
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
    tipo_trabalho: string;
    valor_cobrado: string;
    recebido: boolean;
    entregue: boolean;
    freela_nome: string;
    freela_valor: string;
    freela_pago: boolean;
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
        <input placeholder="Tipo de trabalho" value={value.tipo_trabalho} onChange={(e) => setValue({ ...value, tipo_trabalho: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 outline-none" />
      </div>

      <input placeholder="Valor cobrado" value={value.valor_cobrado} onChange={(e) => setValue({ ...value, valor_cobrado: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 outline-none w-full" />

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
          <input placeholder="Nome do freela" value={value.freela_nome} onChange={(e) => setValue({ ...value, freela_nome: e.target.value })} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 outline-none" />
          <input placeholder="Valor do freela" value={value.freela_valor} onChange={(e) => setValue({ ...value, freela_valor: e.target.value })} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 outline-none" />
          <button onClick={() => setValue({ ...value, freela_pago: !value.freela_pago })} className="bg-orange-500/15 text-orange-300 border border-orange-500/20 rounded-2xl p-4 text-left">
            Freela pago? {value.freela_pago ? "Sim" : "Não"}
          </button>
        </div>
      </div>

      <textarea placeholder="Observações" value={value.observacoes} onChange={(e) => setValue({ ...value, observacoes: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 outline-none w-full min-h-[100px]" />

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

            <p className="font-bold">{money(Number(custo.valor || 0))}</p>
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
