"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Trabalho = {
  id: string;
  data: string;
  cliente: string | null;
  tipo_trabalho: string | null;
  valor_cobrado: number | null;
  recebido: boolean | null;
  entregue: boolean | null;
  freela_nome: string | null;
  freela_valor: number | null;
  freela_pago: boolean | null;
  observacoes: string | null;
  created_at?: string;
};

type Custo = {
  id: string;
  data: string;
  nome: string | null;
  valor: number | null;
  tipo: string | null;
  trabalho_id?: string | null;
  observacoes?: string | null;
  created_at?: string;
};

type TrabalhoForm = {
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

type CustoForm = {
  data: string;
  tipo: "Empresa" | "Pessoal";
  nome: string;
  valor: string;
  observacoes: string;
};

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
const SUPABASE_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function money(value: number | string | null | undefined) {
  const number = Number(String(value ?? 0).replace(",", "."));
  return moeda.format(Number.isFinite(number) ? number : 0);
}

function parseMoney(value: string) {
  const cleaned = String(value || "0")
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  return Number(cleaned) || 0;
}

function localTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayMonthKey() {
  return localTodayDate().slice(0, 7);
}

function initialMonthKey() {
  if (typeof window === "undefined") return todayMonthKey();
  return localStorage.getItem("financeiro-jean-month") || todayMonthKey();
}

function getMonthKey(date?: string | null) {
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

function shortDate(date?: string | null) {
  if (!date) return "--/--";
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

function emptyTrabalhoForm(date = localTodayDate()): TrabalhoForm {
  return {
    data: date,
    cliente: "",
    tipo_trabalho: "",
    valor_cobrado: "",
    recebido: false,
    entregue: false,
    freela_nome: "",
    freela_valor: "",
    freela_pago: false,
    observacoes: "",
  };
}

function trabalhoToForm(trabalho: Trabalho): TrabalhoForm {
  return {
    data: trabalho.data || localTodayDate(),
    cliente: trabalho.cliente || "",
    tipo_trabalho: trabalho.tipo_trabalho || "",
    valor_cobrado: String(trabalho.valor_cobrado ?? ""),
    recebido: Boolean(trabalho.recebido),
    entregue: Boolean(trabalho.entregue),
    freela_nome: trabalho.freela_nome || "",
    freela_valor: String(trabalho.freela_valor ?? ""),
    freela_pago: Boolean(trabalho.freela_pago),
    observacoes: trabalho.observacoes || "",
  };
}

function emptyCustoForm(date = localTodayDate()): CustoForm {
  return {
    data: date,
    tipo: "Empresa",
    nome: "",
    valor: "",
    observacoes: "",
  };
}

function custoToForm(custo: Custo): CustoForm {
  return {
    data: custo.data || localTodayDate(),
    tipo: custo.tipo === "Pessoal" ? "Pessoal" : "Empresa",
    nome: custo.nome || "",
    valor: String(custo.valor ?? ""),
    observacoes: custo.observacoes || "",
  };
}

async function apiGet<T>(table: string): Promise<T[]> {
  if (!SUPABASE_URL) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL está vazia no Vercel.");
  }

  if (!SUPABASE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY está vazia no Vercel.");
  }

  const endpoint = `${SUPABASE_URL}/rest/v1/${table}?select=*&order=data.asc,created_at.asc`;

  const response = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao buscar tabela "${table}". Status ${response.status}. URL usada: ${endpoint}. Resposta: ${text}`);
  }

  return response.json();
}

async function apiInsert<T>(table: string, body: unknown): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return data[0];
}

async function apiUpdate<T>(table: string, id: string, body: unknown): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return data[0];
}

async function apiDelete(table: string, id: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) throw new Error(await response.text());
}

export default function FinanceiroJeanNovaes() {
  const [activeTab, setActiveTab] = useState<"Dashboard" | "Trabalhos" | "Custos">("Dashboard");
  const [month, setMonthState] = useState(initialMonthKey());
  const savingRef = useRef(false);

  function setMonth(monthKey: string) {
    setMonthState(monthKey);
    if (typeof window !== "undefined") {
      localStorage.setItem("financeiro-jean-month", monthKey);
    }
  }

  const [trabalhos, setTrabalhos] = useState<Trabalho[]>([]);
  const [custos, setCustos] = useState<Custo[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  const [novoTrabalhoAberto, setNovoTrabalhoAberto] = useState(false);
  const [novoCustoAberto, setNovoCustoAberto] = useState(false);

  const [trabalhoForm, setTrabalhoForm] = useState<TrabalhoForm>(emptyTrabalhoForm());
  const [custoForm, setCustoForm] = useState<CustoForm>(emptyCustoForm());

  const [trabalhoEditando, setTrabalhoEditando] = useState<Trabalho | null>(null);
  const [custoEditando, setCustoEditando] = useState<Custo | null>(null);

  async function carregarDados(mes?: string) {
    try {
      setErro("");
      setLoading(true);

      const [trabalhosData, custosData] = await Promise.all([
        apiGet<Trabalho>("trabalhos"),
        apiGet<Custo>("custos"),
      ]);

      setTrabalhos(trabalhosData);
      setCustos(custosData);

      if (mes) setMonth(mes);
    } catch (error) {
      console.error(error);
      setErro(error instanceof Error ? error.message : "Erro desconhecido ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  const trabalhosDoMes = useMemo(() => {
    return trabalhos
      .filter((item) => getMonthKey(item.data) === month)
      .sort((a, b) => String(a.data).localeCompare(String(b.data)));
  }, [trabalhos, month]);

  const custosDoMes = useMemo(() => {
    return custos
      .filter((item) => getMonthKey(item.data) === month)
      .sort((a, b) => String(a.data).localeCompare(String(b.data)));
  }, [custos, month]);

  const stats = useMemo(() => {
    const fechado = trabalhosDoMes.reduce((sum, t) => sum + Number(t.valor_cobrado || 0), 0);

    const recebido = trabalhosDoMes
      .filter((t) => Boolean(t.recebido))
      .reduce((sum, t) => sum + Number(t.valor_cobrado || 0), 0);

    const custosGerais = custosDoMes.reduce((sum, c) => sum + Number(c.valor || 0), 0);

    const freelasPagos = trabalhosDoMes
      .filter((t) => Boolean(t.freela_pago))
      .reduce((sum, t) => sum + Number(t.freela_valor || 0), 0);

    const saiu = custosGerais + freelasPagos;

    return {
      fechado,
      recebido,
      saiu,
      sobrou: recebido - saiu,
      custosGerais,
    };
  }, [trabalhosDoMes, custosDoMes]);

  function custosDoTrabalho(trabalhoId: string) {
    return custos.filter((custo) => custo.trabalho_id === trabalhoId);
  }

  function totalCustosTrabalho(trabalho: Trabalho) {
    const custosVinculados = custosDoTrabalho(trabalho.id).reduce(
      (sum, c) => sum + Number(c.valor || 0),
      0
    );

    return custosVinculados + Number(trabalho.freela_valor || 0);
  }

  function lucroPrevisto(trabalho: Trabalho) {
    return Number(trabalho.valor_cobrado || 0) - totalCustosTrabalho(trabalho);
  }

  function trabalhoFinalizado(trabalho: Trabalho) {
    const temFreela = Number(trabalho.freela_valor || 0) > 0;
    return Boolean(trabalho.recebido) && Boolean(trabalho.entregue) && (!temFreela || Boolean(trabalho.freela_pago));
  }

  async function criarTrabalho() {
    if (savingRef.current) return;

    try {
      savingRef.current = true;
      setSaving(true);
      setErro("");

      if (!trabalhoForm.data) {
        setErro("Preencha a data do trabalho.");
        return;
      }

      const body = {
        data: trabalhoForm.data,
        cliente: trabalhoForm.cliente.trim() || "Sem cliente",
        tipo_trabalho: trabalhoForm.tipo_trabalho.trim() || "Trabalho",
        valor_cobrado: parseMoney(trabalhoForm.valor_cobrado),
        recebido: trabalhoForm.recebido,
        entregue: trabalhoForm.entregue,
        freela_nome: trabalhoForm.freela_nome.trim(),
        freela_valor: parseMoney(trabalhoForm.freela_valor),
        freela_pago: trabalhoForm.freela_pago,
        observacoes: trabalhoForm.observacoes,
      };

      await apiInsert<Trabalho>("trabalhos", body);

      setNovoTrabalhoAberto(false);
      setTrabalhoForm(emptyTrabalhoForm(trabalhoForm.data));
      await carregarDados(getMonthKey(body.data));
    } catch (error) {
      console.error(error);
      setErro("Não consegui salvar o trabalho.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function salvarEdicaoTrabalho() {
    if (!trabalhoEditando || savingRef.current) return;

    try {
      savingRef.current = true;
      setSaving(true);
      setErro("");

      const body = {
        data: trabalhoForm.data,
        cliente: trabalhoForm.cliente.trim() || "Sem cliente",
        tipo_trabalho: trabalhoForm.tipo_trabalho.trim() || "Trabalho",
        valor_cobrado: parseMoney(trabalhoForm.valor_cobrado),
        recebido: trabalhoForm.recebido,
        entregue: trabalhoForm.entregue,
        freela_nome: trabalhoForm.freela_nome.trim(),
        freela_valor: parseMoney(trabalhoForm.freela_valor),
        freela_pago: trabalhoForm.freela_pago,
        observacoes: trabalhoForm.observacoes,
      };

      await apiUpdate<Trabalho>("trabalhos", trabalhoEditando.id, body);

      setTrabalhoEditando(null);
      setTrabalhoForm(emptyTrabalhoForm(body.data));
      await carregarDados(getMonthKey(body.data));
    } catch (error) {
      console.error(error);
      setErro("Não consegui editar o trabalho.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function excluirTrabalho(id: string) {
    if (savingRef.current) return;
    if (!confirm("Tem certeza que deseja apagar este trabalho?")) return;

    try {
      savingRef.current = true;
      setSaving(true);
      setErro("");

      await apiDelete("trabalhos", id);
      setTrabalhoEditando(null);
      await carregarDados();
    } catch (error) {
      console.error(error);
      setErro("Não consegui apagar o trabalho.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function criarCusto() {
    if (savingRef.current) return;

    try {
      savingRef.current = true;
      setSaving(true);
      setErro("");

      if (!custoForm.data) {
        setErro("Preencha a data do custo.");
        return;
      }

      const body = {
        data: custoForm.data,
        nome: custoForm.nome.trim() || "Custo",
        valor: parseMoney(custoForm.valor),
        tipo: custoForm.tipo,
        observacoes: custoForm.observacoes,
      };

      await apiInsert<Custo>("custos", body);

      setNovoCustoAberto(false);
      setCustoForm(emptyCustoForm(custoForm.data));
      await carregarDados(getMonthKey(body.data));
    } catch (error) {
      console.error(error);
      setErro("Não consegui salvar o custo.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function salvarEdicaoCusto() {
    if (!custoEditando || savingRef.current) return;

    try {
      savingRef.current = true;
      setSaving(true);
      setErro("");

      const body = {
        data: custoForm.data,
        nome: custoForm.nome.trim() || "Custo",
        valor: parseMoney(custoForm.valor),
        tipo: custoForm.tipo,
        observacoes: custoForm.observacoes,
      };

      await apiUpdate<Custo>("custos", custoEditando.id, body);

      setCustoEditando(null);
      setCustoForm(emptyCustoForm(body.data));
      await carregarDados(getMonthKey(body.data));
    } catch (error) {
      console.error(error);
      setErro("Não consegui editar o custo.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function excluirCusto(id: string) {
    if (savingRef.current) return;
    if (!confirm("Tem certeza que deseja apagar este custo?")) return;

    try {
      savingRef.current = true;
      setSaving(true);
      setErro("");

      await apiDelete("custos", id);
      setCustoEditando(null);
      await carregarDados();
    } catch (error) {
      console.error(error);
      setErro("Não consegui apagar o custo.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function abrirEdicaoTrabalho(trabalho: Trabalho) {
    setNovoTrabalhoAberto(false);
    setTrabalhoEditando(trabalho);
    setTrabalhoForm(trabalhoToForm(trabalho));
  }

  function abrirEdicaoCusto(custo: Custo) {
    setNovoCustoAberto(false);
    setCustoEditando(custo);
    setCustoForm(custoToForm(custo));
  }

  function abrirNovoTrabalho() {
    setTrabalhoEditando(null);
    setNovoTrabalhoAberto((value) => !value);
    setTrabalhoForm(emptyTrabalhoForm(`${month}-01`));
  }

  function abrirNovoCusto() {
    setCustoEditando(null);
    setNovoCustoAberto((value) => !value);
    setCustoForm(emptyCustoForm(`${month}-01`));
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
              activeTab === item ? "bg-white text-black font-semibold" : "bg-zinc-900 border border-zinc-800"
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
              <ResumoCards stats={stats} />

              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <button
                    onClick={abrirNovoTrabalho}
                    className="w-full bg-white text-black rounded-3xl p-5 text-lg font-semibold"
                  >
                    + Novo Trabalho
                  </button>

                  {novoTrabalhoAberto && (
                    <TrabalhoFormBox
                      title="Novo Trabalho"
                      value={trabalhoForm}
                      setValue={setTrabalhoForm}
                      onSave={criarTrabalho}
                      saving={saving}
                    />
                  )}
                </div>

                <div className="space-y-3">
                  <button
                    onClick={abrirNovoCusto}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-lg font-semibold"
                  >
                    + Novo Custo
                  </button>

                  {novoCustoAberto && (
                    <CustoFormBox
                      title="Novo Custo"
                      value={custoForm}
                      setValue={setCustoForm}
                      onSave={criarCusto}
                      saving={saving}
                    />
                  )}
                </div>
              </section>

              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TrabalhosBox
                  month={month}
                  setMonth={setMonth}
                  trabalhos=trabalhos={trabalhosDoMes}
                  trabalhoFinalizado={trabalhoFinalizado}
                  onEdit={abrirEdicaoTrabalho}
                />

                <CustosBox
                  title="Últimos custos"
                  custos=custos={custosDoMes}
                  onEdit={abrirEdicaoCusto}
                />
              </section>
            </>
          )}

          {activeTab === "Trabalhos" && (
            <section className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 space-y-5">
              <MonthHeader title="Trabalhos" month={month} setMonth={setMonth} count={`${trabalhosDoMes.length} trabalhos`} />

              <ListaTrabalhos
                trabalhos={trabalhosDoMes}
                trabalhoFinalizado={trabalhoFinalizado}
                onEdit={abrirEdicaoTrabalho}
              />
            </section>
          )}

          {activeTab === "Custos" && (
            <section className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 space-y-5">
              <MonthHeader title="Custos" month={month} setMonth={setMonth} count={money(stats.custosGerais)} />

              <ListaCustos custos={custosDoMes} onEdit={abrirEdicaoCusto} total={stats.custosGerais} />
            </section>
          )}

          {trabalhoEditando && (
            <Modal title="Editar Trabalho" onClose={() => setTrabalhoEditando(null)}>
              <TrabalhoFormBox
                title="Editar Trabalho"
                value={trabalhoForm}
                setValue={setTrabalhoForm}
                onSave={salvarEdicaoTrabalho}
                saving={saving}
                onDelete={() => excluirTrabalho(trabalhoEditando.id)}
              />

              <div className="grid grid-cols-2 gap-3 mt-4">
                <InfoCard label="Custos" value={money(totalCustosTrabalho(trabalhoEditando))} />
                <InfoCard label="Lucro previsto" value={money(lucroPrevisto(trabalhoEditando))} />
              </div>
            </Modal>
          )}

          {custoEditando && (
            <Modal title="Editar Custo" onClose={() => setCustoEditando(null)}>
              <CustoFormBox
                title="Editar Custo"
                value={custoForm}
                setValue={setCustoForm}
                onSave={salvarEdicaoCusto}
                saving={saving}
                onDelete={() => excluirCusto(custoEditando.id)}
              />
            </Modal>
          )}
        </div>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 p-4 flex items-center justify-around">
        {navItems.map((item) => (
          <button
            key={item}
            onClick={() => setActiveTab(item)}
            className={`flex flex-col items-center gap-1 ${activeTab === item ? "text-white" : "text-zinc-500"}`}
          >
            <span className="text-lg">●</span>
            <span className="text-xs">{item}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}

function ResumoCards({
  stats,
}: {
  stats: {
    fechado: number;
    recebido: number;
    saiu: number;
    sobrou: number;
  };
}) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <InfoCard label="Fechado no mês" value={money(stats.fechado)} />
      <InfoCard label="Recebido no mês" value={money(stats.recebido)} />
      <InfoCard label="Saiu no mês" value={money(stats.saiu)} />
      <InfoCard label="Sobrou" value={money(stats.sobrou)} />
    </section>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800">
      <p className="text-zinc-400 text-sm">{label}</p>
      <h2 className="text-3xl font-bold mt-2">{value}</h2>
    </div>
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
          <button className="text-zinc-500 text-xl" onClick={() => setMonth(shiftMonth(month, -1))}>
            ‹
          </button>

          <h3 className="text-xl md:text-2xl font-bold capitalize">
            {title} — {monthLabel(month)}
          </h3>

          <button className="text-zinc-500 text-xl" onClick={() => setMonth(shiftMonth(month, 1))}>
            ›
          </button>
        </div>
      </div>

      {count && <p className="text-zinc-500 text-sm">{count}</p>}
    </div>
  );
}

function TrabalhosBox({
  month,
  setMonth,
  trabalhos,
  trabalhoFinalizado,
  onEdit,
}: {
  month: string;
  setMonth: (month: string) => void;
  trabalhos: Trabalho[];
  trabalhoFinalizado: (trabalho: Trabalho) => boolean;
  onEdit: (trabalho: Trabalho) => void;
}) {
  return (
    <div className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 space-y-5">
      <MonthHeader title="Trabalhos" month={month} setMonth={setMonth} count={`${trabalhos.length} trabalhos`} />
      <ListaTrabalhos trabalhos={trabalhos} trabalhoFinalizado={trabalhoFinalizado} onEdit={onEdit} />
    </div>
  );
}

function CustosBox({
  title,
  custos,
  onEdit,
}: {
  title: string;
  custos: Custo[];
  onEdit: (custo: Custo) => void;
}) {
  return (
    <div className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">{title}</h3>
        <p className="text-zinc-500 text-sm">{custos.length} registros</p>
      </div>

      <ListaCustos custos={custos} onEdit={onEdit} />
    </div>
  );
}

function ListaTrabalhos({
  trabalhos,
  trabalhoFinalizado,
  onEdit,
}: {
  trabalhos: Trabalho[];
  trabalhoFinalizado: (trabalho: Trabalho) => boolean;
  onEdit: (trabalho: Trabalho) => void;
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
          onClick={() => onEdit(item)}
          className={`w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-zinc-900 ${
            trabalhoFinalizado(item) ? "opacity-50" : "opacity-100"
          }`}
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-semibold shrink-0">
              {shortDate(item.data)}
            </div>

            <div className="min-w-0">
              <h4 className="font-semibold truncate">{item.tipo_trabalho || "Trabalho"}</h4>
              <p className="text-zinc-500 text-sm truncate">{item.cliente || "Sem cliente"}</p>
            </div>
          </div>

          <span className="text-zinc-600 text-lg shrink-0">editar</span>
        </button>
      ))}
    </div>
  );
}

function ListaCustos({
  custos,
  onEdit,
  total,
}: {
  custos: Custo[];
  onEdit: (custo: Custo) => void;
  total?: number;
}) {
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
          <button
            key={custo.id}
            onClick={() => onEdit(custo)}
            className="w-full flex items-center justify-between gap-4 p-4 bg-zinc-950 text-left hover:bg-zinc-900"
          >
            <div>
              <h4 className="font-semibold">{custo.nome || "Custo"}</h4>
              <p className="text-zinc-500 text-sm mt-1">
                {shortDate(custo.data)} • {custo.tipo || "Empresa"}
              </p>
            </div>

            <p className="font-bold">{money(custo.valor)}</p>
          </button>
        ))}
      </div>

      {typeof total === "number" && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 flex items-center justify-between">
          <p className="text-zinc-500 text-sm">Total do mês</p>
          <p className="font-bold text-2xl">{money(total)}</p>
        </div>
      )}
    </>
  );
}

function TrabalhoFormBox({
  title,
  value,
  setValue,
  onSave,
  saving,
  onDelete,
}: {
  title: string;
  value: TrabalhoForm;
  setValue: (value: TrabalhoForm) => void;
  onSave: () => void;
  saving: boolean;
  onDelete?: () => void;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-5">
      <h3 className="text-xl font-bold">{title}</h3>

      <div>
        <label className="text-zinc-400 text-sm block mb-2">Data do trabalho</label>
        <input
          type="date"
          value={value.data}
          onChange={(event) => setValue({ ...value, data: event.target.value })}
          className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 outline-none w-full"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          placeholder="Cliente"
          value={value.cliente}
          onChange={(event) => setValue({ ...value, cliente: event.target.value })}
          className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 outline-none"
        />

        <input
          placeholder="Tipo de trabalho"
          value={value.tipo_trabalho}
          onChange={(event) => setValue({ ...value, tipo_trabalho: event.target.value })}
          className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 outline-none"
        />
      </div>

      <input
        placeholder="Valor cobrado — ex: 700 ou 1500,50"
        inputMode="decimal"
        value={value.valor_cobrado}
        onChange={(event) => setValue({ ...value, valor_cobrado: event.target.value })}
        className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 outline-none w-full"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setValue({ ...value, recebido: !value.recebido })}
          className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-left"
        >
          Recebido? {value.recebido ? "Sim" : "Não"}
        </button>

        <button
          type="button"
          onClick={() => setValue({ ...value, entregue: !value.entregue })}
          className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-left"
        >
          Entregue? {value.entregue ? "Sim" : "Não"}
        </button>
      </div>

      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <h4 className="font-semibold">Freela</h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            placeholder="Nome do freela"
            value={value.freela_nome}
            onChange={(event) => setValue({ ...value, freela_nome: event.target.value })}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 outline-none"
          />

          <input
            placeholder="Valor do freela — ex: 300"
            inputMode="decimal"
            value={value.freela_valor}
            onChange={(event) => setValue({ ...value, freela_valor: event.target.value })}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 outline-none"
          />

          <button
            type="button"
            onClick={() => setValue({ ...value, freela_pago: !value.freela_pago })}
            className="bg-orange-500/15 text-orange-300 border border-orange-500/20 rounded-2xl p-4 text-left"
          >
            Freela pago? {value.freela_pago ? "Sim" : "Não"}
          </button>
        </div>
      </div>

      <textarea
        placeholder="Observações"
        value={value.observacoes}
        onChange={(event) => setValue({ ...value, observacoes: event.target.value })}
        className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 outline-none w-full min-h-[100px]"
      />

      <div className="flex gap-3">
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className="w-1/3 bg-red-500/15 text-red-300 border border-red-500/20 rounded-2xl p-4 font-semibold disabled:opacity-50"
          >
            Apagar
          </button>
        )}

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex-1 bg-white text-black rounded-2xl p-4 font-semibold disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}

function CustoFormBox({
  title,
  value,
  setValue,
  onSave,
  saving,
  onDelete,
}: {
  title: string;
  value: CustoForm;
  setValue: (value: CustoForm) => void;
  onSave: () => void;
  saving: boolean;
  onDelete?: () => void;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4">
      <h3 className="text-xl font-bold">{title}</h3>

      <div className="grid grid-cols-2 gap-3">
        {(["Empresa", "Pessoal"] as const).map((tipo) => (
          <button
            type="button"
            key={tipo}
            onClick={() => setValue({ ...value, tipo })}
            className={`rounded-2xl p-4 font-medium ${
              value.tipo === tipo ? "bg-white text-black" : "bg-zinc-950 border border-zinc-800"
            }`}
          >
            {tipo}
          </button>
        ))}
      </div>

      <div>
        <label className="text-zinc-400 text-sm block mb-2">Data do custo</label>
        <input
          type="date"
          value={value.data}
          onChange={(event) => setValue({ ...value, data: event.target.value })}
          className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 outline-none w-full"
        />
      </div>

      <input
        placeholder="Nome"
        value={value.nome}
        onChange={(event) => setValue({ ...value, nome: event.target.value })}
        className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 outline-none w-full"
      />

      <input
        placeholder="Valor — ex: 89,90"
        inputMode="decimal"
        value={value.valor}
        onChange={(event) => setValue({ ...value, valor: event.target.value })}
        className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 outline-none w-full"
      />

      <textarea
        placeholder="Observação"
        value={value.observacoes}
        onChange={(event) => setValue({ ...value, observacoes: event.target.value })}
        className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 outline-none w-full min-h-[90px]"
      />

      <div className="flex gap-3">
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className="w-1/3 bg-red-500/15 text-red-300 border border-red-500/20 rounded-2xl p-4 font-semibold disabled:opacity-50"
          >
            Apagar
          </button>
        )}

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex-1 bg-white text-black rounded-2xl p-4 font-semibold disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 p-4 overflow-y-auto">
      <div className="max-w-3xl mx-auto bg-zinc-950 border border-zinc-800 rounded-3xl p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">{title}</h2>

          <button onClick={onClose} className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2">
            Fechar
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
