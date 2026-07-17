"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Trabalho = {
  id: string;
  data: string;
  data_fim?: string | null;
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

type Freela = {
  id: string;
  trabalho_id: string;
  nome: string;
  valor: number | null;
  pago: boolean | null;
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

type CustoFixo = {
  id: string;
  nome: string | null;
  valor: number | null;
  tipo: "Empresa" | "Pessoal" | string | null;
  observacoes?: string | null;
  ativo?: boolean | null;
  created_at?: string;
};

type CustoFixoForm = {
  nome: string;
  valor: string;
  tipo: "Empresa" | "Pessoal";
  observacoes: string;
  ativo: boolean;
};

type CustoRascunho = {
  id: string;
  nome: string;
  valor: string;
  observacoes: string;
};

type FreelaRascunho = {
  id: string;
  nome: string;
  valor: string;
  pago: boolean;
  salvo?: boolean;
};

type TrabalhoForm = {
  data: string;
  data_fim: string;
  cliente: string;
  tipo_trabalho: string;
  valor_cobrado: string;
  recebido: boolean;
  entregue: boolean;
  freelas_rascunho: FreelaRascunho[];
  observacoes: string;
  custos_rascunho: CustoRascunho[];
};

type CustoForm = {
  data: string;
  tipo: "Empresa" | "Pessoal" | "Trabalho";
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

function shortDateRange(start?: string | null, end?: string | null) {
  if (!end || end === start) return shortDate(start);
  return `${shortDate(start)}–${shortDate(end)}`;
}

function googleDate(date?: string | null) {
  if (!date) return "";
  return date.replaceAll("-", "");
}

function addOneDay(date?: string | null) {
  if (!date) return "";
  const base = new Date(`${date}T00:00:00`);
  base.setDate(base.getDate() + 1);
  return `${base.getFullYear()}${String(base.getMonth() + 1).padStart(2, "0")}${String(base.getDate()).padStart(2, "0")}`;
}

function googleAgendaUrl(trabalho: TrabalhoForm | Trabalho) {
  const titulo = `${trabalho.tipo_trabalho || "Trabalho"} — ${trabalho.cliente || "Sem cliente"}`;
  const inicio = googleDate(trabalho.data);
  const fim = addOneDay(trabalho.data_fim || trabalho.data);

  const detalhes = [
    `Cliente: ${trabalho.cliente || "Sem cliente"}`,
    `Tipo de trabalho: ${trabalho.tipo_trabalho || "Trabalho"}`,
    `Valor: ${money(Number(trabalho.valor_cobrado || 0))}`,
    "freelas_rascunho" in trabalho && trabalho.freelas_rascunho.length
      ? `Freelas: ${trabalho.freelas_rascunho
          .map((freela) => `${freela.nome || "Sem nome"} — ${money(parseMoney(freela.valor))}`)
          .join(", ")}`
      : "freela_nome" in trabalho && trabalho.freela_nome
        ? `Freela: ${trabalho.freela_nome}`
        : "",
    trabalho.observacoes ? `Observações: ${trabalho.observacoes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: titulo,
    dates: `${inicio}/${fim}`,
    details: detalhes,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function monthRange(month: string) {
  const start = `${month}-01`;
  const date = new Date(`${start}T00:00:00`);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const endKey = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  return { start, end: endKey };
}

function trabalhoApareceNoMes(trabalho: Trabalho, month: string) {
  const { start, end } = monthRange(month);
  const dataInicio = trabalho.data;
  const dataFim = trabalho.data_fim || trabalho.data;
  return dataInicio <= end && dataFim >= start;
}

function emptyTrabalhoForm(date = localTodayDate()): TrabalhoForm {
  return {
    data: date,
    data_fim: "",
    cliente: "",
    tipo_trabalho: "",
    valor_cobrado: "",
    recebido: false,
    entregue: false,
    freelas_rascunho: [],
    observacoes: "",
    custos_rascunho: [],
  };
}

function trabalhoToForm(trabalho: Trabalho, freelas: Freela[]): TrabalhoForm {
  const freelasDoTrabalho = freelas
    .filter((freela) => freela.trabalho_id === trabalho.id)
    .map((freela) => ({
      id: freela.id,
      nome: freela.nome || "",
      valor: String(freela.valor ?? ""),
      pago: Boolean(freela.pago),
      salvo: true,
    }));

  const freelaAntigo =
    freelasDoTrabalho.length === 0 && Number(trabalho.freela_valor || 0) > 0
      ? [{
          id: crypto.randomUUID(),
          nome: trabalho.freela_nome || "",
          valor: String(trabalho.freela_valor ?? ""),
          pago: Boolean(trabalho.freela_pago),
          salvo: false,
        }]
      : [];

  return {
    data: trabalho.data || localTodayDate(),
    data_fim: trabalho.data_fim || "",
    cliente: trabalho.cliente || "",
    tipo_trabalho: trabalho.tipo_trabalho || "",
    valor_cobrado: String(trabalho.valor_cobrado ?? ""),
    recebido: Boolean(trabalho.recebido),
    entregue: Boolean(trabalho.entregue),
    freelas_rascunho: [...freelasDoTrabalho, ...freelaAntigo],
    observacoes: trabalho.observacoes || "",
    custos_rascunho: [],
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
    tipo: custo.tipo === "Pessoal" ? "Pessoal" : custo.tipo === "Trabalho" ? "Trabalho" : "Empresa",
    nome: custo.nome || "",
    valor: String(custo.valor ?? ""),
    observacoes: custo.observacoes || "",
  };
}

function emptyCustoFixoForm(): CustoFixoForm {
  return {
    nome: "",
    valor: "",
    tipo: "Empresa",
    observacoes: "",
    ativo: true,
  };
}

function custoFixoToForm(custo: CustoFixo): CustoFixoForm {
  return {
    nome: custo.nome || "",
    valor: String(custo.valor ?? ""),
    tipo: custo.tipo === "Pessoal" ? "Pessoal" : "Empresa",
    observacoes: custo.observacoes || "",
    ativo: custo.ativo !== false,
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

async function apiGetFreelas(): Promise<Freela[]> {
  if (!SUPABASE_URL) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL está vazia no Vercel.");
  }

  if (!SUPABASE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY está vazia no Vercel.");
  }

  const endpoint = `${SUPABASE_URL}/rest/v1/freelas?select=*&order=created_at.asc`;

  const response = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao buscar tabela "freelas". Status ${response.status}. Resposta: ${text}`);
  }

  return response.json();
}

async function apiGetCustosFixos(): Promise<CustoFixo[]> {
  if (!SUPABASE_URL) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL está vazia no Vercel.");
  }

  if (!SUPABASE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY está vazia no Vercel.");
  }

  const endpoint = `${SUPABASE_URL}/rest/v1/custos_fixos?select=*&order=created_at.asc`;

  const response = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao buscar tabela "custos_fixos". Status ${response.status}. URL usada: ${endpoint}. Resposta: ${text}`);
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
  const [activeTab, setActiveTab] = useState<"Dashboard" | "Trabalhos" | "Custos" | "Custos Fixos">("Dashboard");
  const [month, setMonthState] = useState(initialMonthKey());
  const savingRef = useRef(false);

  function setMonth(monthKey: string) {
    setMonthState(monthKey);
    if (typeof window !== "undefined") {
      localStorage.setItem("financeiro-jean-month", monthKey);
    }
  }

  const [trabalhos, setTrabalhos] = useState<Trabalho[]>([]);
  const [freelas, setFreelas] = useState<Freela[]>([]);
  const [custos, setCustos] = useState<Custo[]>([]);
  const [custosFixos, setCustosFixos] = useState<CustoFixo[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  const [novoTrabalhoAberto, setNovoTrabalhoAberto] = useState(false);
  const [novoCustoAberto, setNovoCustoAberto] = useState(false);
  const [novoCustoFixoAberto, setNovoCustoFixoAberto] = useState(false);

  const [trabalhoForm, setTrabalhoForm] = useState<TrabalhoForm>(emptyTrabalhoForm());
  const [custoForm, setCustoForm] = useState<CustoForm>(emptyCustoForm());
  const [custoFixoForm, setCustoFixoForm] = useState<CustoFixoForm>(emptyCustoFixoForm());

  const [trabalhoEditando, setTrabalhoEditando] = useState<Trabalho | null>(null);
  const [custoEditando, setCustoEditando] = useState<Custo | null>(null);
  const [custoFixoEditando, setCustoFixoEditando] = useState<CustoFixo | null>(null);
  const [custoTrabalhoAbertoId, setCustoTrabalhoAbertoId] = useState<string | null>(null);

  async function carregarDados(mes?: string) {
    try {
      setErro("");
      setLoading(true);

      const [trabalhosData, freelasData, custosData, custosFixosData] = await Promise.all([
        apiGet<Trabalho>("trabalhos"),
        apiGetFreelas(),
        apiGet<Custo>("custos"),
        apiGetCustosFixos(),
      ]);

      setTrabalhos(trabalhosData);
      setFreelas(freelasData);
      setCustos(custosData);
      setCustosFixos(custosFixosData);

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
      .filter((item) => trabalhoApareceNoMes(item, month))
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

    const custosTrabalho = custosDoMes
      .filter((c) => c.tipo === "Trabalho" || c.tipo === "Empresa")
      .reduce((sum, c) => sum + Number(c.valor || 0), 0);

    const custosPessoais = custosDoMes
      .filter((c) => c.tipo === "Pessoal")
      .reduce((sum, c) => sum + Number(c.valor || 0), 0);

    const idsTrabalhosDoMes = new Set(trabalhosDoMes.map((trabalho) => trabalho.id));

    const freelasPagosNovos = freelas
      .filter((freela) => idsTrabalhosDoMes.has(freela.trabalho_id) && Boolean(freela.pago))
      .reduce((sum, freela) => sum + Number(freela.valor || 0), 0);

    const trabalhosComFreelasNovos = new Set(freelas.map((freela) => freela.trabalho_id));

    const freelasPagosAntigos = trabalhosDoMes
      .filter((trabalho) => !trabalhosComFreelasNovos.has(trabalho.id) && Boolean(trabalho.freela_pago))
      .reduce((sum, trabalho) => sum + Number(trabalho.freela_valor || 0), 0);

    const freelasPagos = freelasPagosNovos + freelasPagosAntigos;

    const custosTrabalhoTotal = custosTrabalho + freelasPagos;

    const custosGerais = custosTrabalhoTotal + custosPessoais;

    return {
      fechado,
      recebido,
      custosTrabalho: custosTrabalhoTotal,
      custosPessoais,
      custosGerais,
    };
  }, [trabalhosDoMes, custosDoMes, freelas]);

  function custosDoTrabalho(trabalhoId: string) {
    return custos.filter((custo) => custo.trabalho_id === trabalhoId);
  }

  function freelasDoTrabalho(trabalhoId: string) {
    return freelas.filter((freela) => freela.trabalho_id === trabalhoId);
  }

  function totalFreelasTrabalho(trabalho: Trabalho) {
    const vinculados = freelasDoTrabalho(trabalho.id);

    if (vinculados.length > 0) {
      return vinculados.reduce((sum, freela) => sum + Number(freela.valor || 0), 0);
    }

    return Number(trabalho.freela_valor || 0);
  }

  function totalCustosTrabalho(trabalho: Trabalho) {
    const custosVinculados = custosDoTrabalho(trabalho.id).reduce(
      (sum, c) => sum + Number(c.valor || 0),
      0
    );

    return custosVinculados + totalFreelasTrabalho(trabalho);
  }

  function lucroPrevisto(trabalho: Trabalho) {
    return Number(trabalho.valor_cobrado || 0) - totalCustosTrabalho(trabalho);
  }

  function trabalhoFinalizado(trabalho: Trabalho) {
    const vinculados = freelasDoTrabalho(trabalho.id);
    const temFreelaNovo = vinculados.length > 0;
    const novosPagos = !temFreelaNovo || vinculados.every((freela) => Boolean(freela.pago));

    const temFreelaAntigo = !temFreelaNovo && Number(trabalho.freela_valor || 0) > 0;
    const antigoPago = !temFreelaAntigo || Boolean(trabalho.freela_pago);

    return Boolean(trabalho.recebido) && Boolean(trabalho.entregue) && novosPagos && antigoPago;
  }

  async function criarTrabalho() {
    if (savingRef.current) return;

    let agendaWindow: Window | null = null;

    try {
      savingRef.current = true;
      setSaving(true);
      setErro("");

      if (!trabalhoForm.data) {
        setErro("Preencha a data do trabalho.");
        return;
      }

      agendaWindow = window.open("", "_blank");

      const body = {
        data: trabalhoForm.data,
        data_fim: trabalhoForm.data_fim || null,
        cliente: trabalhoForm.cliente.trim() || "Sem cliente",
        tipo_trabalho: trabalhoForm.tipo_trabalho.trim() || "Trabalho",
        valor_cobrado: parseMoney(trabalhoForm.valor_cobrado),
        recebido: trabalhoForm.recebido,
        entregue: trabalhoForm.entregue,
        freela_nome: "",
        freela_valor: 0,
        freela_pago: false,
        observacoes: trabalhoForm.observacoes,
      };

      const trabalhoCriado = await apiInsert<Trabalho>("trabalhos", body);

      const freelasValidos = trabalhoForm.freelas_rascunho.filter(
        (freela) => freela.nome.trim() || parseMoney(freela.valor) > 0
      );

      for (const freela of freelasValidos) {
        await apiInsert<Freela>("freelas", {
          trabalho_id: trabalhoCriado.id,
          nome: freela.nome.trim() || "Freela",
          valor: parseMoney(freela.valor),
          pago: freela.pago,
        });
      }

      const custosValidos = trabalhoForm.custos_rascunho.filter(
        (custo) => custo.nome.trim() || parseMoney(custo.valor) > 0
      );

      for (const custo of custosValidos) {
        await apiInsert<Custo>("custos", {
          data: trabalhoForm.data,
          nome: custo.nome.trim() || "Custo do trabalho",
          valor: parseMoney(custo.valor),
          tipo: "Trabalho",
          trabalho_id: trabalhoCriado.id,
          observacoes: custo.observacoes,
        });
      }

      if (agendaWindow) {
        agendaWindow.location.href = googleAgendaUrl(trabalhoCriado);
      } else {
        window.open(googleAgendaUrl(trabalhoCriado), "_blank", "noopener,noreferrer");
      }

      setNovoTrabalhoAberto(false);
      setTrabalhoForm(emptyTrabalhoForm(trabalhoForm.data));
      await carregarDados(getMonthKey(body.data));
    } catch (error) {
      if (agendaWindow) agendaWindow.close();
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
        data_fim: trabalhoForm.data_fim || null,
        cliente: trabalhoForm.cliente.trim() || "Sem cliente",
        tipo_trabalho: trabalhoForm.tipo_trabalho.trim() || "Trabalho",
        valor_cobrado: parseMoney(trabalhoForm.valor_cobrado),
        recebido: trabalhoForm.recebido,
        entregue: trabalhoForm.entregue,
        freela_nome: "",
        freela_valor: 0,
        freela_pago: false,
        observacoes: trabalhoForm.observacoes,
      };

      await apiUpdate<Trabalho>("trabalhos", trabalhoEditando.id, body);

      const freelasAtuais = freelasDoTrabalho(trabalhoEditando.id);
      for (const freela of freelasAtuais) {
        await apiDelete("freelas", freela.id);
      }

      const freelasValidos = trabalhoForm.freelas_rascunho.filter(
        (freela) => freela.nome.trim() || parseMoney(freela.valor) > 0
      );

      for (const freela of freelasValidos) {
        await apiInsert<Freela>("freelas", {
          trabalho_id: trabalhoEditando.id,
          nome: freela.nome.trim() || "Freela",
          valor: parseMoney(freela.valor),
          pago: freela.pago,
        });
      }

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
        trabalho_id: null,
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

  async function criarCustoDoTrabalho(trabalho: Trabalho) {
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
        nome: custoForm.nome.trim() || "Custo do trabalho",
        valor: parseMoney(custoForm.valor),
        tipo: "Trabalho",
        trabalho_id: trabalho.id,
        observacoes: custoForm.observacoes,
      };

      await apiInsert<Custo>("custos", body);

      setCustoTrabalhoAbertoId(null);
      setCustoForm(emptyCustoForm(trabalho.data));
      await carregarDados(getMonthKey(trabalho.data));
    } catch (error) {
      console.error(error);
      setErro("Não consegui salvar o custo do trabalho.");
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

  async function criarCustoFixo() {
    if (savingRef.current) return;

    try {
      savingRef.current = true;
      setSaving(true);
      setErro("");

      const body = {
        nome: custoFixoForm.nome.trim() || "Custo fixo",
        valor: parseMoney(custoFixoForm.valor),
        tipo: custoFixoForm.tipo,
        observacoes: custoFixoForm.observacoes,
        ativo: custoFixoForm.ativo,
      };

      await apiInsert<CustoFixo>("custos_fixos", body);

      setNovoCustoFixoAberto(false);
      setCustoFixoForm(emptyCustoFixoForm());
      await carregarDados();
    } catch (error) {
      console.error(error);
      setErro("Não consegui salvar o custo fixo.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function salvarEdicaoCustoFixo() {
    if (!custoFixoEditando || savingRef.current) return;

    try {
      savingRef.current = true;
      setSaving(true);
      setErro("");

      const body = {
        nome: custoFixoForm.nome.trim() || "Custo fixo",
        valor: parseMoney(custoFixoForm.valor),
        tipo: custoFixoForm.tipo,
        observacoes: custoFixoForm.observacoes,
        ativo: custoFixoForm.ativo,
      };

      await apiUpdate<CustoFixo>("custos_fixos", custoFixoEditando.id, body);

      setCustoFixoEditando(null);
      setCustoFixoForm(emptyCustoFixoForm());
      await carregarDados();
    } catch (error) {
      console.error(error);
      setErro("Não consegui editar o custo fixo.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function excluirCustoFixo(id: string) {
    if (savingRef.current) return;
    if (!confirm("Tem certeza que deseja apagar este custo fixo?")) return;

    try {
      savingRef.current = true;
      setSaving(true);
      setErro("");

      await apiDelete("custos_fixos", id);
      setCustoFixoEditando(null);
      setCustoFixoForm(emptyCustoFixoForm());
      await carregarDados();
    } catch (error) {
      console.error(error);
      setErro("Não consegui apagar o custo fixo.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function abrirNovoCustoFixo() {
    setCustoFixoEditando(null);
    setNovoCustoFixoAberto((value) => !value);
    setCustoFixoForm(emptyCustoFixoForm());
  }

  function abrirEdicaoCustoFixo(custo: CustoFixo) {
    setNovoCustoFixoAberto(false);
    setCustoFixoEditando(custo);
    setCustoFixoForm(custoFixoToForm(custo));
  }

  function custosFixosJaImportadosNoMes() {
    const ativos = custosFixos.filter((custo) => custo.ativo !== false);

    if (!ativos.length) return false;

    return ativos.every((fixo) =>
      custosDoMes.some((custo) =>
        custo.nome === fixo.nome &&
        custo.tipo === fixo.tipo &&
        custo.observacoes?.includes(`[fixo:${fixo.id}]`)
      )
    );
  }

  async function importarCustosFixosDoMes() {
    if (savingRef.current) return;

    const ativos = custosFixos.filter((custo) => custo.ativo !== false);

    if (!ativos.length) {
      setErro("Cadastre pelo menos um custo fixo ativo antes de importar.");
      return;
    }

    try {
      savingRef.current = true;
      setSaving(true);
      setErro("");

      const dataDoMes = `${month}-01`;

      for (const fixo of ativos) {
        const jaExiste = custosDoMes.some((custo) =>
          custo.nome === fixo.nome &&
          custo.tipo === fixo.tipo &&
          custo.observacoes?.includes(`[fixo:${fixo.id}]`)
        );

        if (jaExiste) continue;

        await apiInsert<Custo>("custos", {
          data: dataDoMes,
          nome: fixo.nome || "Custo fixo",
          valor: Number(fixo.valor || 0),
          tipo: fixo.tipo === "Pessoal" ? "Pessoal" : "Empresa",
          trabalho_id: null,
          observacoes: `${fixo.observacoes || ""}${fixo.observacoes ? "\n" : ""}[fixo:${fixo.id}]`,
        });
      }

      await carregarDados(month);
    } catch (error) {
      console.error(error);
      setErro("Não consegui importar os custos fixos.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function abrirEdicaoTrabalho(trabalho: Trabalho) {
    setNovoTrabalhoAberto(false);
    setTrabalhoEditando(trabalho);
    setTrabalhoForm(trabalhoToForm(trabalho, freelas));
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
    setCustoTrabalhoAbertoId(null);
    setNovoCustoAberto((value) => !value);
    setCustoForm(emptyCustoForm(`${month}-01`));
  }

  function abrirNovoCustoDoTrabalho(trabalho: Trabalho) {
    setCustoEditando(null);
    setNovoCustoAberto(false);
    setCustoTrabalhoAbertoId((atual) => atual === trabalho.id ? null : trabalho.id);
    setCustoForm({
      data: trabalho.data,
      tipo: "Trabalho",
      nome: "",
      valor: "",
      observacoes: "",
    });
  }

  const navItems: Array<typeof activeTab> = ["Dashboard", "Trabalhos", "Custos", "Custos Fixos"];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#123b4a_0%,#071016_38%,#030507_100%)] text-white pb-28 md:pb-8 md:flex">
      <aside className="hidden md:flex w-72 border-r border-cyan-800/40 p-6 flex-col gap-3 sticky top-0 h-screen bg-[#081117]/95">
        <h2 className="text-xl font-bold mb-6">Financeiro Jean Novaes</h2>

        {navItems.map((item) => (
          <button
            key={item}
            onClick={() => setActiveTab(item)}
            className={`rounded-2xl p-4 text-left ${
              activeTab === item ? "bg-white text-black font-semibold" : "bg-zinc-900 border border-cyan-900/40"
            }`}
          >
            {item}
          </button>
        ))}
      </aside>

      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <header>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white drop-shadow-[0_0_18px_rgba(34,211,238,0.15)]">
              Financeiro Jean Novaes Audiovisual
            </h1>
          </header>

          {erro && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-2xl p-4">
              {erro}
            </div>
          )}

          {loading && (
            <div className="bg-zinc-900 border border-cyan-900/40 rounded-2xl p-4 text-cyan-100/70">
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
                    className="w-full bg-gradient-to-r from-cyan-700 to-teal-600 text-white rounded-3xl p-5 text-lg font-semibold shadow-lg shadow-cyan-950/40 hover:from-cyan-600 hover:to-teal-500 active:scale-[0.99] transition">+ Novo Trabalho
                  </button>

                  {novoTrabalhoAberto && (
                    <TrabalhoFormBox
                      title="Novo Trabalho"
                      value={trabalhoForm}
                      setValue={setTrabalhoForm}
                      onSave={criarTrabalho}
                      saving={saving}
                      permitirCustosLivres
                      saveLabel="Salvar + Agenda"
                    />
                  )}
                </div>

                <div className="space-y-3">
                  <button
                    onClick={abrirNovoCusto}
                    className="w-full bg-gradient-to-r from-cyan-700 to-teal-600 text-white rounded-3xl p-5 text-lg font-semibold shadow-lg shadow-cyan-950/40 hover:from-cyan-600 hover:to-teal-500 active:scale-[0.99] transition">+ Novo Custo
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

              <CustosFixosImportBox
                month={month}
                custosFixos={custosFixos}
                jaImportados={custosFixosJaImportadosNoMes()}
                onImport={importarCustosFixosDoMes}
                saving={saving}
              />

              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TrabalhosBox
                  month={month}
                  setMonth={setMonth}
                  trabalhos={trabalhosDoMes}
                  trabalhoFinalizado={trabalhoFinalizado}
                  onEdit={abrirEdicaoTrabalho}
                />

                <CustosBox
                  title="Últimos custos"
                  custos={custosDoMes}
                  onEdit={abrirEdicaoCusto}
                />
              </section>
            </>
          )}

          {activeTab === "Trabalhos" && (
            <section className="bg-[#0d1820]/90 rounded-3xl p-6 border border-cyan-800/40 shadow-xl shadow-cyan-950/20 space-y-5">
              <MonthHeader title="Trabalhos" month={month} setMonth={setMonth} count={`${trabalhosDoMes.length} trabalhos`} />

              <ListaTrabalhos
                trabalhos={trabalhosDoMes}
                trabalhoFinalizado={trabalhoFinalizado}
                onEdit={abrirEdicaoTrabalho}
              />
            </section>
          )}

          {activeTab === "Custos" && (
            <section className="bg-[#0d1820]/90 rounded-3xl p-6 border border-cyan-800/40 shadow-xl shadow-cyan-950/20 space-y-5">
              <MonthHeader title="Custos" month={month} setMonth={setMonth} count={money(stats.custosGerais)} />

              <ListaCustos custos={custosDoMes} onEdit={abrirEdicaoCusto} total={stats.custosGerais} />
            </section>
          )}

          {activeTab === "Custos Fixos" && (
            <section className="bg-[#0d1820]/90 rounded-3xl p-6 border border-cyan-800/40 shadow-xl shadow-cyan-950/20 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold">Custos Fixos</h3>
                  <p className="text-cyan-100/55 text-sm mt-1">
                    Modelo mensal para despesas recorrentes. Você importa para cada mês quando quiser.
                  </p>
                </div>

                <button
                  onClick={abrirNovoCustoFixo}
                  className="bg-gradient-to-r from-cyan-700 to-teal-600 text-white rounded-2xl px-5 py-3 font-semibold shadow-lg shadow-cyan-950/40 hover:from-cyan-600 hover:to-teal-500 active:scale-[0.99] transition"
                >
                  + Novo Custo Fixo
                </button>
              </div>

              {novoCustoFixoAberto && (
                <CustoFixoFormBox
                  title="Novo Custo Fixo"
                  value={custoFixoForm}
                  setValue={setCustoFixoForm}
                  onSave={criarCustoFixo}
                  saving={saving}
                />
              )}

              <ListaCustosFixos custos={custosFixos} onEdit={abrirEdicaoCustoFixo} />
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

              <a
                href={googleAgendaUrl(trabalhoForm)}
                target="_blank"
                rel="noreferrer"
                className="block text-center bg-cyan-500/15 border border-cyan-400/30 text-cyan-100 rounded-2xl p-4 font-semibold hover:bg-cyan-500/25 transition"
              >
                📅 Adicionar à Agenda Google
              </a>

              <CustosDoTrabalhoBox
                trabalho={trabalhoEditando}
                custos={custosDoTrabalho(trabalhoEditando.id)}
                freelas={freelasDoTrabalho(trabalhoEditando.id)}
                onAdd={() => abrirNovoCustoDoTrabalho(trabalhoEditando)}
                onEdit={abrirEdicaoCusto}
              />

              {custoTrabalhoAbertoId === trabalhoEditando.id && (
                <CustoFormBox
                  title="Novo custo do trabalho"
                  value={custoForm}
                  setValue={setCustoForm}
                  onSave={() => criarCustoDoTrabalho(trabalhoEditando)}
                  saving={saving}
                  contexto="trabalho"
                />
              )}

              <div className="grid grid-cols-2 gap-3 mt-4">
                <InfoCard label="Custos" value={money(totalCustosTrabalho(trabalhoEditando))} />
                <InfoCard label="Lucro previsto" value={money(lucroPrevisto(trabalhoEditando))} />
              </div>
            </Modal>
          )}

          {custoFixoEditando && (
            <Modal title="Editar Custo Fixo" onClose={() => setCustoFixoEditando(null)}>
              <CustoFixoFormBox
                title="Editar Custo Fixo"
                value={custoFixoForm}
                setValue={setCustoFixoForm}
                onSave={salvarEdicaoCustoFixo}
                saving={saving}
                onDelete={() => excluirCustoFixo(custoFixoEditando.id)}
              />
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
                contexto={custoForm.tipo === "Trabalho" ? "trabalho" : "geral"}
              />
            </Modal>
          )}
        </div>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#061016] border-t border-cyan-900/40 p-4 flex items-center justify-around">
        {navItems.map((item) => (
          <button
            key={item}
            onClick={() => setActiveTab(item)}
            className={`flex flex-col items-center gap-1 ${activeTab === item ? "text-white" : "text-cyan-100/55"}`}
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
    custosTrabalho: number;
    custosPessoais: number;
    custosGerais: number;
  };
}) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <InfoCard label="Fechado no mês" value={money(stats.fechado)} />
      <InfoCard label="Recebido no mês" value={money(stats.recebido)} />
      <InfoCard label="Custos Trabalho" value={money(stats.custosTrabalho)} />
      <InfoCard label="Custos Pessoais" value={money(stats.custosPessoais)} />
    </section>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="relative overflow-hidden bg-[#0d1820]/90 rounded-3xl p-6 border border-cyan-800/40 shadow-xl shadow-cyan-950/20">
      <div className="absolute left-0 top-0 h-full w-1 bg-cyan-500/60" />
      <p className="text-cyan-100/70 text-sm">{label}</p>
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
        <p className="text-cyan-100/55 text-xs uppercase tracking-wide">Mês vigente</p>

        <div className="flex items-center gap-3 mt-1">
          <button className="text-cyan-100/55 text-xl" onClick={() => setMonth(shiftMonth(month, -1))}>
            ‹
          </button>

          <h3 className="text-xl md:text-2xl font-bold capitalize">
            {title} — {monthLabel(month)}
          </h3>

          <button className="text-cyan-100/55 text-xl" onClick={() => setMonth(shiftMonth(month, 1))}>
            ›
          </button>
        </div>
      </div>

      {count && <p className="text-cyan-100/55 text-sm">{count}</p>}
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
    <div className="bg-[#0d1820]/90 rounded-3xl p-6 border border-cyan-800/40 shadow-xl shadow-cyan-950/20 space-y-5">
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
  const [mostrarTodosCustos, setMostrarTodosCustos] = useState(false);

  const custosOrdenados = [...custos].sort((a, b) => {
    const dataB = String(b.data || b.created_at || "");
    const dataA = String(a.data || a.created_at || "");

    if (dataB !== dataA) return dataB.localeCompare(dataA);

    return String(b.created_at || "").localeCompare(String(a.created_at || ""));
  });

  const custosVisiveis = mostrarTodosCustos ? custosOrdenados : custosOrdenados.slice(0, 5);

  return (
    <div className="bg-[#0d1820]/90 rounded-3xl p-6 border border-cyan-800/40 shadow-xl shadow-cyan-950/20 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">{title}</h3>
        <p className="text-cyan-100/55 text-sm">{custos.length} registros</p>
      </div>

      <ListaCustos custos={custosVisiveis} onEdit={onEdit} />

      {custosOrdenados.length > 5 && (
        <button
          type="button"
          onClick={() => setMostrarTodosCustos((value) => !value)}
          className="w-full bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 text-cyan-100 font-semibold hover:bg-cyan-950/35 transition"
        >
          {mostrarTodosCustos ? "Ocultar custos" : `Ver todos os custos (${custosOrdenados.length})`}
        </button>
      )}
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
      <div className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-6 text-cyan-100/55">
        Nenhum trabalho neste mês.
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-800 border border-cyan-900/40 rounded-2xl overflow-hidden">
      {trabalhos.map((item) => (
        <button
          key={item.id}
          onClick={() => onEdit(item)}
          className={`w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-cyan-950/35 ${
            trabalhoFinalizado(item) ? "opacity-50" : "opacity-100"
          }`}
        >
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="bg-[#061016]/80 border border-cyan-900/40 rounded-xl px-3 py-2 text-sm font-semibold shrink-0">
              {shortDateRange(item.data, item.data_fim)}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{item.tipo_trabalho || "Trabalho"}</p>
              <p className="text-sm text-cyan-100/70 truncate">{item.cliente || "Sem cliente"}</p>
            </div>

            <div className="text-right shrink-0">
              <p className="font-bold whitespace-nowrap">{money(item.valor_cobrado || 0)}</p>
            </div>
          </div>

          <span
            className="text-cyan-100/55 text-xl shrink-0"
            title="Editar"
            aria-label="Editar"
          >
            ✎
          </span>
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
      <div className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-6 text-cyan-100/55">
        Nenhum custo neste mês.
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-zinc-800 border border-cyan-900/40 rounded-2xl overflow-hidden">
        {custos.map((custo) => (
          <button
            key={custo.id}
            onClick={() => onEdit(custo)}
            className="w-full flex items-center justify-between gap-4 p-4 bg-[#061016] text-left hover:bg-cyan-950/35"
          >
            <div>
              <h4 className="font-semibold">{custo.nome || "Custo"}</h4>
              <p className="text-cyan-100/55 text-sm mt-1">
                {shortDate(custo.data)} • {custo.tipo || "Empresa"}
              </p>
            </div>

            <p className="font-bold">{money(custo.valor)}</p>
          </button>
        ))}
      </div>

      {typeof total === "number" && (
        <div className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-5 flex items-center justify-between">
          <p className="text-cyan-100/55 text-sm">Total do mês</p>
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
  permitirCustosLivres = false,
  saveLabel = "Salvar",
}: {
  title: string;
  value: TrabalhoForm;
  setValue: (value: TrabalhoForm) => void;
  onSave: () => void;
  saving: boolean;
  onDelete?: () => void;
  contexto?: "geral" | "trabalho";
  permitirCustosLivres?: boolean;
  saveLabel?: string;
}) {
  function adicionarFreelaRascunho() {
    setValue({
      ...value,
      freelas_rascunho: [
        ...value.freelas_rascunho,
        { id: crypto.randomUUID(), nome: "", valor: "", pago: false },
      ],
    });
  }

  function atualizarFreelaRascunho(
    id: string,
    campo: "nome" | "valor" | "pago",
    novoValor: string | boolean
  ) {
    setValue({
      ...value,
      freelas_rascunho: value.freelas_rascunho.map((freela) =>
        freela.id === id ? { ...freela, [campo]: novoValor } : freela
      ),
    });
  }

  function removerFreelaRascunho(id: string) {
    setValue({
      ...value,
      freelas_rascunho: value.freelas_rascunho.filter((freela) => freela.id !== id),
    });
  }

  function adicionarCustoRascunho() {
    setValue({
      ...value,
      custos_rascunho: [
        ...value.custos_rascunho,
        { id: crypto.randomUUID(), nome: "", valor: "", observacoes: "" },
      ],
    });
  }

  function atualizarCustoRascunho(id: string, campo: keyof CustoRascunho, novoValor: string) {
    setValue({
      ...value,
      custos_rascunho: value.custos_rascunho.map((custo) =>
        custo.id === id ? { ...custo, [campo]: novoValor } : custo
      ),
    });
  }

  function removerCustoRascunho(id: string) {
    setValue({
      ...value,
      custos_rascunho: value.custos_rascunho.filter((custo) => custo.id !== id),
    });
  }

  const totalCustosRascunho = value.custos_rascunho.reduce(
    (sum, custo) => sum + parseMoney(custo.valor),
    0
  );

  const totalFreelasRascunho = value.freelas_rascunho.reduce(
    (sum, freela) => sum + parseMoney(freela.valor),
    0
  );

  const lucroPrevistoRascunho =
    parseMoney(value.valor_cobrado) - totalFreelasRascunho - totalCustosRascunho;

  return (
    <div className="bg-[#0d1820]/90 border border-cyan-800/40 rounded-3xl p-5 shadow-xl shadow-cyan-950/20 space-y-5">
      <h3 className="text-xl font-bold">{title}</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-cyan-100/70 text-sm block mb-2">Data inicial</label>
          <input
            type="date"
            value={value.data}
            onChange={(event) => setValue({ ...value, data: event.target.value })}
            className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none w-full"
          />
        </div>

        <div>
          <label className="text-cyan-100/70 text-sm block mb-2">Data final (opcional)</label>
          <input
            type="date"
            value={value.data_fim}
            onChange={(event) => setValue({ ...value, data_fim: event.target.value })}
            className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          placeholder="Cliente"
          value={value.cliente}
          onChange={(event) => setValue({ ...value, cliente: event.target.value })}
          className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none"
        />

        <input
          placeholder="Tipo de trabalho"
          value={value.tipo_trabalho}
          onChange={(event) => setValue({ ...value, tipo_trabalho: event.target.value })}
          className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none"
        />
      </div>

      <input
        placeholder="Valor cobrado — ex: 700 ou 1500,50"
        inputMode="decimal"
        value={value.valor_cobrado}
        onChange={(event) => setValue({ ...value, valor_cobrado: event.target.value })}
        className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none w-full"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setValue({ ...value, recebido: !value.recebido })}
          className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 text-left"
        >
          Recebido? {value.recebido ? "Sim" : "Não"}
        </button>

        <button
          type="button"
          onClick={() => setValue({ ...value, entregue: !value.entregue })}
          className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 text-left"
        >
          Entregue? {value.entregue ? "Sim" : "Não"}
        </button>
      </div>

      <div className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h4 className="font-semibold">Freelas</h4>
            <p className="text-cyan-100/55 text-sm mt-1">
              Adicione quantas pessoas trabalharam neste serviço.
            </p>
          </div>

          <button
            type="button"
            onClick={adicionarFreelaRascunho}
            className="bg-white text-black rounded-2xl px-4 py-3 font-semibold shrink-0"
          >
            + Adicionar freela
          </button>
        </div>

        {value.freelas_rascunho.length === 0 && (
          <div className="bg-zinc-900 border border-cyan-900/40 rounded-2xl p-4 text-cyan-100/55 text-sm">
            Nenhum freela adicionado.
          </div>
        )}

        <div className="space-y-3">
          {value.freelas_rascunho.map((freela) => (
            <div
              key={freela.id}
              className="bg-zinc-900 border border-cyan-900/40 rounded-2xl p-4 space-y-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-[1fr_170px] gap-3">
                <input
                  placeholder="Nome do freela"
                  value={freela.nome}
                  onChange={(event) =>
                    atualizarFreelaRascunho(freela.id, "nome", event.target.value)
                  }
                  className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none"
                />

                <input
                  placeholder="Valor — ex: 300"
                  inputMode="decimal"
                  value={freela.valor}
                  onChange={(event) =>
                    atualizarFreelaRascunho(freela.id, "valor", event.target.value)
                  }
                  className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none"
                />
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-3">
                <button
                  type="button"
                  onClick={() =>
                    atualizarFreelaRascunho(freela.id, "pago", !freela.pago)
                  }
                  className={`rounded-2xl p-4 text-left ${
                    freela.pago
                      ? "bg-green-500/15 text-green-300 border border-green-500/20"
                      : "bg-orange-500/15 text-orange-300 border border-orange-500/20"
                  }`}
                >
                  Freela pago? {freela.pago ? "Sim" : "Não"}
                </button>

                <button
                  type="button"
                  onClick={() => removerFreelaRascunho(freela.id)}
                  className="bg-red-500/15 text-red-300 border border-red-500/20 rounded-2xl px-4 py-3"
                >
                  Apagar
                </button>
              </div>
            </div>
          ))}
        </div>

        {value.freelas_rascunho.length > 0 && (
          <div className="bg-zinc-900 border border-cyan-900/40 rounded-2xl p-4">
            <p className="text-cyan-100/55 text-sm">Total de freelas</p>
            <p className="font-bold text-xl mt-1">{money(totalFreelasRascunho)}</p>
          </div>
        )}
      </div>

      {permitirCustosLivres && (
        <div className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="font-semibold">Custos do trabalho</h4>
              <p className="text-cyan-100/55 text-sm mt-1">
                Gasolina, pedágio, hotel, comida e outros custos previstos.
              </p>
            </div>

            <button
              type="button"
              onClick={adicionarCustoRascunho}
              className="bg-white text-black rounded-2xl px-4 py-3 font-semibold shrink-0"
            >
              + Custo
            </button>
          </div>

          {value.custos_rascunho.length === 0 && (
            <div className="bg-zinc-900 border border-cyan-900/40 rounded-2xl p-4 text-cyan-100/55 text-sm">
              Nenhum custo adicionado ainda.
            </div>
          )}

          <div className="space-y-3">
            {value.custos_rascunho.map((custo) => (
              <div key={custo.id} className="bg-zinc-900 border border-cyan-900/40 rounded-2xl p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_auto] gap-3">
                  <input
                    placeholder="Nome do custo — ex: gasolina, hotel, pedágio"
                    value={custo.nome}
                    onChange={(event) => atualizarCustoRascunho(custo.id, "nome", event.target.value)}
                    className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none"
                  />

                  <input
                    placeholder="Valor"
                    inputMode="decimal"
                    value={custo.valor}
                    onChange={(event) => atualizarCustoRascunho(custo.id, "valor", event.target.value)}
                    className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => removerCustoRascunho(custo.id)}
                    className="bg-red-500/15 text-red-300 border border-red-500/20 rounded-2xl px-4 py-3"
                  >
                    Apagar
                  </button>
                </div>

                <input
                  placeholder="Observação opcional"
                  value={custo.observacoes}
                  onChange={(event) => atualizarCustoRascunho(custo.id, "observacoes", event.target.value)}
                  className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none w-full"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-zinc-900 border border-cyan-900/40 rounded-2xl p-4">
              <p className="text-cyan-100/55 text-sm">Total de custos previstos</p>
              <p className="font-bold text-xl mt-1">{money(totalCustosRascunho)}</p>
            </div>

            <div className="bg-zinc-900 border border-cyan-900/40 rounded-2xl p-4">
              <p className="text-cyan-100/55 text-sm">Lucro previsto</p>
              <p className="font-bold text-xl mt-1">{money(lucroPrevistoRascunho)}</p>
            </div>
          </div>
        </div>
      )}

      <textarea
        placeholder="Observações"
        value={value.observacoes}
        onChange={(event) => setValue({ ...value, observacoes: event.target.value })}
        className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none w-full min-h-[100px]"
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
          {saving ? "Salvando..." : saveLabel}
        </button>
      </div>
    </div>
  );
}

function CustosDoTrabalhoBox({
  trabalho,
  custos,
  freelas,
  onAdd,
  onEdit,
}: {
  trabalho: Trabalho;
  custos: Custo[];
  freelas: Freela[];
  onAdd: () => void;
  onEdit: (custo: Custo) => void;
}) {
  const totalCustosLivres = custos.reduce((sum, custo) => sum + Number(custo.valor || 0), 0);

  const freelasExibidos =
    freelas.length > 0
      ? freelas
      : Number(trabalho.freela_valor || 0) > 0
        ? [{
            id: `antigo-${trabalho.id}`,
            trabalho_id: trabalho.id,
            nome: trabalho.freela_nome || "sem nome",
            valor: Number(trabalho.freela_valor || 0),
            pago: Boolean(trabalho.freela_pago),
          }]
        : [];

  const totalFreelas = freelasExibidos.reduce(
    (sum, freela) => sum + Number(freela.valor || 0),
    0
  );

  return (
    <div className="bg-[#0d1820]/90 border border-cyan-800/40 rounded-3xl p-5 shadow-xl shadow-cyan-950/20 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold">Custos do trabalho</h3>
          <p className="text-cyan-100/55 text-sm mt-1">
            Gasolina, pedágio, hotel, comida e outros custos deste trabalho.
          </p>
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="bg-white text-black rounded-2xl px-4 py-3 font-semibold shrink-0"
        >
          + Custo
        </button>
      </div>

      <div className="space-y-3">
        {custos.length === 0 && freelasExibidos.length === 0 && (
          <div className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 text-cyan-100/55">
            Nenhum custo vinculado a este trabalho.
          </div>
        )}

        {custos.map((custo) => (
          <button
            key={custo.id}
            type="button"
            onClick={() => onEdit(custo)}
            className="w-full flex items-center justify-between gap-4 bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 text-left hover:bg-cyan-950/35"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">{custo.nome || "Custo"}</p>
              <p className="text-cyan-100/55 text-sm truncate">{shortDate(custo.data)} • custo do trabalho</p>
            </div>

            <p className="font-bold whitespace-nowrap">{money(custo.valor)}</p>
          </button>
        ))}

        {freelasExibidos.map((freela) => (
          <div
            key={freela.id}
            className="flex items-center justify-between gap-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">Freela — {freela.nome || "sem nome"}</p>
              <p className="text-orange-300 text-sm">
                {freela.pago ? "Pago" : "Pagamento pendente"}
              </p>
            </div>

            <p className="font-bold whitespace-nowrap">{money(freela.valor)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4">
          <p className="text-cyan-100/55 text-sm">Custos livres</p>
          <p className="text-2xl font-bold mt-1">{money(totalCustosLivres)}</p>
        </div>

        <div className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4">
          <p className="text-cyan-100/55 text-sm">Custos + freela</p>
          <p className="text-2xl font-bold mt-1">{money(totalCustosLivres + totalFreelas)}</p>
        </div>
      </div>
    </div>
  );
}

function CustosFixosImportBox({
  month,
  custosFixos,
  jaImportados,
  onImport,
  saving,
}: {
  month: string;
  custosFixos: CustoFixo[];
  jaImportados: boolean;
  onImport: () => void;
  saving: boolean;
}) {
  const ativos = custosFixos.filter((custo) => custo.ativo !== false);
  const totalEmpresa = ativos
    .filter((custo) => custo.tipo !== "Pessoal")
    .reduce((sum, custo) => sum + Number(custo.valor || 0), 0);
  const totalPessoal = ativos
    .filter((custo) => custo.tipo === "Pessoal")
    .reduce((sum, custo) => sum + Number(custo.valor || 0), 0);

  if (!ativos.length) {
    return (
      <div className="bg-[#0d1820]/90 border border-cyan-800/40 rounded-3xl p-5 shadow-xl shadow-cyan-950/20">
        <p className="text-cyan-100/70 text-sm">Custos fixos</p>
        <p className="font-semibold mt-1">Cadastre seus custos fixos para importar todo mês com um clique.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0d1820]/90 border border-cyan-800/40 rounded-3xl p-5 shadow-xl shadow-cyan-950/20 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <p className="text-cyan-100/70 text-sm">Custos fixos de {monthLabel(month)}</p>
        <h3 className="font-bold text-xl mt-1">
          {ativos.length} itens • Empresa {money(totalEmpresa)} • Pessoal {money(totalPessoal)}
        </h3>
        <p className="text-cyan-100/55 text-sm mt-1">
          {jaImportados ? "Custos fixos já importados para este mês." : "Importe para lançar estes custos no mês selecionado."}
        </p>
      </div>

      <button
        onClick={onImport}
        disabled={saving || jaImportados}
        className="bg-gradient-to-r from-cyan-700 to-teal-600 text-white rounded-2xl px-5 py-3 font-semibold shadow-lg shadow-cyan-950/40 disabled:opacity-50 hover:from-cyan-600 hover:to-teal-500 transition"
      >
        {jaImportados ? "Já importado" : `Importar para ${monthLabel(month)}`}
      </button>
    </div>
  );
}

function ListaCustosFixos({
  custos,
  onEdit,
}: {
  custos: CustoFixo[];
  onEdit: (custo: CustoFixo) => void;
}) {
  if (!custos.length) {
    return (
      <div className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-6 text-cyan-100/55">
        Nenhum custo fixo cadastrado.
      </div>
    );
  }

  const total = custos
    .filter((custo) => custo.ativo !== false)
    .reduce((sum, custo) => sum + Number(custo.valor || 0), 0);

  return (
    <div className="space-y-4">
      <div className="divide-y divide-cyan-900/40 border border-cyan-900/40 rounded-2xl overflow-hidden">
        {custos.map((custo) => (
          <button
            key={custo.id}
            onClick={() => onEdit(custo)}
            className={`w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-cyan-950/35 transition ${
              custo.ativo === false ? "opacity-45" : ""
            }`}
          >
            <div className="min-w-0">
              <h4 className="font-semibold truncate">{custo.nome || "Custo fixo"}</h4>
              <p className="text-cyan-100/55 text-sm mt-1">
                {custo.tipo === "Pessoal" ? "Pessoal" : "Empresa"} {custo.ativo === false ? "• inativo" : ""}
              </p>
            </div>

            <div className="text-right shrink-0">
              <p className="font-bold">{money(custo.valor)}</p>
              <p className="text-cyan-100/45 text-sm">✎</p>
            </div>
          </button>
        ))}
      </div>

      <div className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-5 flex items-center justify-between">
        <p className="text-cyan-100/55 text-sm">Total fixo ativo</p>
        <p className="font-bold text-2xl">{money(total)}</p>
      </div>
    </div>
  );
}

function CustoFixoFormBox({
  title,
  value,
  setValue,
  onSave,
  saving,
  onDelete,
}: {
  title: string;
  value: CustoFixoForm;
  setValue: (value: CustoFixoForm) => void;
  onSave: () => void;
  saving: boolean;
  onDelete?: () => void;
}) {
  return (
    <div className="bg-[#0d1820]/90 border border-cyan-800/40 rounded-3xl p-5 shadow-xl shadow-cyan-950/20 space-y-4">
      <h3 className="text-xl font-bold">{title}</h3>

      <div className="grid grid-cols-2 gap-3">
        {(["Empresa", "Pessoal"] as const).map((tipo) => (
          <button
            type="button"
            key={tipo}
            onClick={() => setValue({ ...value, tipo })}
            className={`rounded-2xl p-4 font-medium ${
              value.tipo === tipo ? "bg-white text-black" : "bg-[#061016]/80 border border-cyan-900/40"
            }`}
          >
            {tipo}
          </button>
        ))}
      </div>

      <input
        placeholder="Nome do custo fixo"
        value={value.nome}
        onChange={(event) => setValue({ ...value, nome: event.target.value })}
        className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none w-full"
      />

      <input
        placeholder="Valor"
        value={value.valor}
        onChange={(event) => setValue({ ...value, valor: event.target.value })}
        className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none w-full"
      />

      <textarea
        placeholder="Observação"
        value={value.observacoes}
        onChange={(event) => setValue({ ...value, observacoes: event.target.value })}
        className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none w-full min-h-[90px]"
      />

      <button
        type="button"
        onClick={() => setValue({ ...value, ativo: !value.ativo })}
        className={`w-full rounded-2xl p-4 text-left font-medium ${
          value.ativo
            ? "bg-green-500/15 text-green-300 border border-green-500/20"
            : "bg-zinc-500/15 text-zinc-300 border border-zinc-500/20"
        }`}
      >
        Status: {value.ativo ? "Ativo" : "Inativo"}
      </button>

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
  contexto = "geral",
}: {
  title: string;
  value: CustoForm;
  setValue: (value: CustoForm) => void;
  onSave: () => void;
  saving: boolean;
  onDelete?: () => void;
  contexto?: "geral" | "trabalho";
}) {
  return (
    <div className="bg-[#0d1820]/90 border border-cyan-800/40 rounded-3xl p-5 shadow-xl shadow-cyan-950/20 space-y-4">
      <h3 className="text-xl font-bold">{title}</h3>

      {contexto === "trabalho" ? (
        <div className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4">
          <p className="text-cyan-100/70 text-sm">Este custo ficará vinculado ao trabalho.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {(["Empresa", "Pessoal"] as const).map((tipo) => (
            <button
              type="button"
              key={tipo}
              onClick={() => setValue({ ...value, tipo })}
              className={`rounded-2xl p-4 font-medium ${
                value.tipo === tipo ? "bg-white text-black" : "bg-[#061016]/80 border border-cyan-900/40"
              }`}
            >
              {tipo}
            </button>
          ))}
        </div>
      )}

      <div>
        <label className="text-cyan-100/70 text-sm block mb-2">Data do custo</label>
        <input
          type="date"
          value={value.data}
          onChange={(event) => setValue({ ...value, data: event.target.value })}
          className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none w-full"
        />
      </div>

      <input
        placeholder="Nome"
        value={value.nome}
        onChange={(event) => setValue({ ...value, nome: event.target.value })}
        className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none w-full"
      />

      <input
        placeholder="Valor — ex: 89,90"
        inputMode="decimal"
        value={value.valor}
        onChange={(event) => setValue({ ...value, valor: event.target.value })}
        className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none w-full"
      />

      <textarea
        placeholder="Observação"
        value={value.observacoes}
        onChange={(event) => setValue({ ...value, observacoes: event.target.value })}
        className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none w-full min-h-[90px]"
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
      <div className="max-w-3xl mx-auto bg-[#061016]/80 border border-cyan-900/40 rounded-3xl p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">{title}</h2>

          <button onClick={onClose} className="bg-zinc-900 border border-cyan-900/40 rounded-2xl px-4 py-2">
            Fechar
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
