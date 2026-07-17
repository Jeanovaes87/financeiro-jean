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
  categoria?: string | null;
  forma_pagamento?: string | null;
  trabalho_id?: string | null;
  observacoes?: string | null;
  created_at?: string;
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
  tipo: "Pessoal" | "Trabalho";
  categoria: string;
  forma_pagamento: "Pix" | "Débito" | "Cartão";
  nome: string;
  valor: string;
  observacoes: string;
};

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "")
  .trim()
  .replace(/\/$/, "");
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
          .map(
            (freela) =>
              `${freela.nome || "Sem nome"} — ${money(parseMoney(freela.valor))}`,
          )
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
      ? [
          {
            id: crypto.randomUUID(),
            nome: trabalho.freela_nome || "",
            valor: String(trabalho.freela_valor ?? ""),
            pago: Boolean(trabalho.freela_pago),
            salvo: false,
          },
        ]
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

function emptyCustoForm(
  date = localTodayDate(),
  forma: "Pix" | "Débito" | "Cartão" = "Pix",
): CustoForm {
  return {
    data: date,
    tipo: "Pessoal",
    categoria: forma === "Cartão" ? "Fatura do cartão" : "Outros",
    forma_pagamento: forma,
    nome: "",
    valor: "",
    observacoes: "",
  };
}

function custoToForm(custo: Custo): CustoForm {
  const forma =
    custo.forma_pagamento === "Débito" || custo.forma_pagamento === "Cartão"
      ? custo.forma_pagamento
      : "Pix";

  return {
    data: custo.data || localTodayDate(),
    tipo: custo.tipo === "Trabalho" ? "Trabalho" : "Pessoal",
    categoria:
      custo.categoria || (forma === "Cartão" ? "Fatura do cartão" : "Outros"),
    forma_pagamento: forma,
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
    throw new Error(
      `Erro ao buscar tabela "${table}". Status ${response.status}. URL usada: ${endpoint}. Resposta: ${text}`,
    );
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
    throw new Error(
      `Erro ao buscar tabela "freelas". Status ${response.status}. Resposta: ${text}`,
    );
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

async function apiUpdate<T>(
  table: string,
  id: string,
  body: unknown,
): Promise<T> {
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
  const [activeTab, setActiveTab] = useState<
    "Dashboard" | "Trabalhos" | "Despesas" | "Cartão"
  >("Dashboard");
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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  const [novoTrabalhoAberto, setNovoTrabalhoAberto] = useState(false);
  const [novoCustoAberto, setNovoCustoAberto] = useState(false);
  const [novaFaturaAberta, setNovaFaturaAberta] = useState(false);

  const [trabalhoForm, setTrabalhoForm] =
    useState<TrabalhoForm>(emptyTrabalhoForm());
  const [custoForm, setCustoForm] = useState<CustoForm>(emptyCustoForm());

  const [trabalhoEditando, setTrabalhoEditando] = useState<Trabalho | null>(
    null,
  );
  const [custoEditando, setCustoEditando] = useState<Custo | null>(null);
  const [custoTrabalhoAbertoId, setCustoTrabalhoAbertoId] = useState<
    string | null
  >(null);

  async function carregarDados(mes?: string) {
    try {
      setErro("");
      setLoading(true);

      const [trabalhosData, freelasData, custosData] = await Promise.all([
        apiGet<Trabalho>("trabalhos"),
        apiGetFreelas(),
        apiGet<Custo>("custos"),
      ]);

      setTrabalhos(trabalhosData);
      setFreelas(freelasData);
      setCustos(custosData);

      if (mes) setMonth(mes);
    } catch (error) {
      console.error(error);
      setErro(
        error instanceof Error
          ? error.message
          : "Erro desconhecido ao carregar dados.",
      );
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

  const faturasDoMes = useMemo(() => {
    return custosDoMes.filter(
      (item) =>
        item.forma_pagamento === "Cartão" ||
        item.categoria === "Fatura do cartão",
    );
  }, [custosDoMes]);

  const despesasDoMes = useMemo(() => {
    return custosDoMes.filter(
      (item) =>
        item.forma_pagamento !== "Cartão" &&
        item.categoria !== "Fatura do cartão",
    );
  }, [custosDoMes]);

  const stats = useMemo(() => {
    const entrou = trabalhosDoMes
      .filter((trabalho) => Boolean(trabalho.recebido))
      .reduce((sum, trabalho) => sum + Number(trabalho.valor_cobrado || 0), 0);

    const custosLancados = custosDoMes.reduce(
      (sum, custo) => sum + Number(custo.valor || 0),
      0,
    );
    const idsTrabalhosDoMes = new Set(
      trabalhosDoMes.map((trabalho) => trabalho.id),
    );

    const freelasPagosNovos = freelas
      .filter(
        (freela) =>
          idsTrabalhosDoMes.has(freela.trabalho_id) && Boolean(freela.pago),
      )
      .reduce((sum, freela) => sum + Number(freela.valor || 0), 0);

    const trabalhosComFreelasNovos = new Set(
      freelas.map((freela) => freela.trabalho_id),
    );
    const freelasPagosAntigos = trabalhosDoMes
      .filter(
        (trabalho) =>
          !trabalhosComFreelasNovos.has(trabalho.id) &&
          Boolean(trabalho.freela_pago),
      )
      .reduce((sum, trabalho) => sum + Number(trabalho.freela_valor || 0), 0);

    const saiu = custosLancados + freelasPagosNovos + freelasPagosAntigos;

    return {
      entrou,
      saiu,
      sobrou: entrou - saiu,
      quantidadeTrabalhos: trabalhosDoMes.length,
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
      return vinculados.reduce(
        (sum, freela) => sum + Number(freela.valor || 0),
        0,
      );
    }

    return Number(trabalho.freela_valor || 0);
  }

  function totalCustosTrabalho(trabalho: Trabalho) {
    const custosVinculados = custosDoTrabalho(trabalho.id).reduce(
      (sum, c) => sum + Number(c.valor || 0),
      0,
    );

    return custosVinculados + totalFreelasTrabalho(trabalho);
  }

  function lucroPrevisto(trabalho: Trabalho) {
    return Number(trabalho.valor_cobrado || 0) - totalCustosTrabalho(trabalho);
  }

  function trabalhoFinalizado(trabalho: Trabalho) {
    const vinculados = freelasDoTrabalho(trabalho.id);
    const temFreelaNovo = vinculados.length > 0;
    const novosPagos =
      !temFreelaNovo || vinculados.every((freela) => Boolean(freela.pago));

    const temFreelaAntigo =
      !temFreelaNovo && Number(trabalho.freela_valor || 0) > 0;
    const antigoPago = !temFreelaAntigo || Boolean(trabalho.freela_pago);

    return (
      Boolean(trabalho.recebido) &&
      Boolean(trabalho.entregue) &&
      novosPagos &&
      antigoPago
    );
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
        (freela) => freela.nome.trim() || parseMoney(freela.valor) > 0,
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
        (custo) => custo.nome.trim() || parseMoney(custo.valor) > 0,
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
        window.open(
          googleAgendaUrl(trabalhoCriado),
          "_blank",
          "noopener,noreferrer",
        );
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
        (freela) => freela.nome.trim() || parseMoney(freela.valor) > 0,
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
        tipo: "Pessoal",
        categoria: custoForm.categoria,
        forma_pagamento: custoForm.forma_pagamento,
        trabalho_id: null,
        observacoes: custoForm.observacoes,
      };

      await apiInsert<Custo>("custos", body);

      setNovoCustoAberto(false);
      setNovaFaturaAberta(false);
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
        categoria: "Custo do trabalho",
        forma_pagamento: custoForm.forma_pagamento,
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
        categoria: custoForm.categoria,
        forma_pagamento: custoForm.forma_pagamento,
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
    setTrabalhoForm(trabalhoToForm(trabalho, freelas));
  }

  function abrirEdicaoCusto(custo: Custo) {
    setNovoCustoAberto(false);
    setNovaFaturaAberta(false);
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
    setNovaFaturaAberta(false);
    setNovoCustoAberto((value) => !value);
    setCustoForm(emptyCustoForm(`${month}-01`, "Pix"));
  }

  function abrirNovaFatura() {
    setCustoEditando(null);
    setCustoTrabalhoAbertoId(null);
    setNovoCustoAberto(false);
    setNovaFaturaAberta((value) => !value);
    setCustoForm({
      ...emptyCustoForm(`${month}-01`, "Cartão"),
      categoria: "Fatura do cartão",
      nome: "Fatura do cartão",
    });
  }

  function abrirNovoCustoDoTrabalho(trabalho: Trabalho) {
    setCustoEditando(null);
    setNovoCustoAberto(false);
    setCustoTrabalhoAbertoId((atual) =>
      atual === trabalho.id ? null : trabalho.id,
    );
    setCustoForm({
      data: trabalho.data,
      tipo: "Trabalho",
      categoria: "Custo do trabalho",
      forma_pagamento: "Pix",
      nome: "",
      valor: "",
      observacoes: "",
    });
  }

  const navItems: Array<typeof activeTab> = [
    "Dashboard",
    "Trabalhos",
    "Despesas",
    "Cartão",
  ];
  const navIcons: Record<typeof activeTab, string> = {
    Dashboard: "⌂",
    Trabalhos: "▣",
    Despesas: "−",
    Cartão: "▰",
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#123b4a_0%,#071016_38%,#030507_100%)] text-white pb-28 md:pb-8 md:flex">
      <aside className="hidden md:flex w-72 border-r border-cyan-800/40 p-6 flex-col gap-3 sticky top-0 h-screen bg-[#081117]/95">
        <div className="mb-6">
          <p className="text-cyan-100/50 text-xs uppercase tracking-[0.2em]">
            Jean Novaes
          </p>
          <h2 className="text-2xl font-bold mt-1">Financeiro</h2>
        </div>

        {navItems.map((item) => (
          <button
            key={item}
            onClick={() => setActiveTab(item)}
            className={`rounded-2xl px-4 py-3.5 text-left flex items-center gap-3 transition ${
              activeTab === item
                ? "bg-white text-black font-semibold shadow-lg"
                : "text-cyan-50/70 hover:bg-cyan-950/35"
            }`}
          >
            <span className="w-7 text-center text-lg">{navIcons[item]}</span>
            <span>{item}</span>
          </button>
        ))}
      </aside>

      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <header className="flex items-end justify-between gap-4">
            <div>
              <p className="text-cyan-100/50 text-xs uppercase tracking-[0.2em] md:hidden">
                Jean Novaes Audiovisual
              </p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                {activeTab}
              </h1>
            </div>
            {loading && (
              <span className="text-cyan-100/45 text-sm">Atualizando...</span>
            )}
          </header>

          {erro && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-2xl p-4">
              {erro}
            </div>
          )}

          {activeTab === "Dashboard" && (
            <>
              <div className="bg-[#0d1820]/75 border border-cyan-900/35 rounded-2xl px-4 py-3">
                <MonthHeader title="Resumo" month={month} setMonth={setMonth} />
              </div>

              <ResumoCards stats={stats} />

              <section className="grid grid-cols-3 gap-3">
                <div className="space-y-3">
                  <button
                    onClick={abrirNovoTrabalho}
                    className="w-full min-h-24 bg-gradient-to-br from-cyan-700 to-teal-700 text-white rounded-2xl p-3 md:p-5 font-semibold shadow-lg shadow-cyan-950/30 active:scale-[0.98] transition flex flex-col items-center justify-center gap-1"
                  >
                    <span className="text-2xl">＋</span>
                    <span className="text-xs md:text-base">Trabalho</span>
                  </button>
                  {novoTrabalhoAberto && (
                    <div className="col-span-3">
                      <TrabalhoFormBox
                        title="Novo Trabalho"
                        value={trabalhoForm}
                        setValue={setTrabalhoForm}
                        onSave={criarTrabalho}
                        saving={saving}
                        permitirCustosLivres
                        saveLabel="Salvar + Agenda"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <button
                    onClick={abrirNovoCusto}
                    className="w-full min-h-24 bg-[#0d1820] border border-cyan-800/45 text-white rounded-2xl p-3 md:p-5 font-semibold active:scale-[0.98] transition flex flex-col items-center justify-center gap-1"
                  >
                    <span className="text-2xl">−</span>
                    <span className="text-xs md:text-base">Despesa</span>
                  </button>
                  {novoCustoAberto && (
                    <div className="col-span-3">
                      <CustoFormBox
                        title="Nova Despesa"
                        value={custoForm}
                        setValue={setCustoForm}
                        onSave={criarCusto}
                        saving={saving}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <button
                    onClick={abrirNovaFatura}
                    className="w-full min-h-24 bg-[#0d1820] border border-cyan-800/45 text-white rounded-2xl p-3 md:p-5 font-semibold active:scale-[0.98] transition flex flex-col items-center justify-center gap-1"
                  >
                    <span className="text-2xl">▰</span>
                    <span className="text-xs md:text-base">Fatura</span>
                  </button>
                  {novaFaturaAberta && (
                    <div className="col-span-3">
                      <CustoFormBox
                        title="Nova Fatura"
                        value={custoForm}
                        setValue={setCustoForm}
                        onSave={criarCusto}
                        saving={saving}
                        contexto="fatura"
                      />
                    </div>
                  )}
                </div>
              </section>

              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TrabalhosBox
                  month={month}
                  setMonth={setMonth}
                  trabalhos={trabalhosDoMes}
                  trabalhoFinalizado={trabalhoFinalizado}
                  onEdit={abrirEdicaoTrabalho}
                />

                <CustosBox
                  title="Últimas saídas"
                  custos={custosDoMes}
                  onEdit={abrirEdicaoCusto}
                />
              </section>
            </>
          )}

          {activeTab === "Trabalhos" && (
            <section className="bg-[#0d1820]/90 rounded-3xl p-6 border border-cyan-800/40 shadow-xl shadow-cyan-950/20 space-y-5">
              <MonthHeader
                title="Trabalhos"
                month={month}
                setMonth={setMonth}
                count={`${trabalhosDoMes.length} trabalhos`}
              />

              <ListaTrabalhos
                trabalhos={trabalhosDoMes}
                trabalhoFinalizado={trabalhoFinalizado}
                onEdit={abrirEdicaoTrabalho}
              />
            </section>
          )}

          {activeTab === "Despesas" && (
            <section className="bg-[#0d1820]/90 rounded-3xl p-6 border border-cyan-800/40 shadow-xl shadow-cyan-950/20 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <MonthHeader
                  title="Despesas"
                  month={month}
                  setMonth={setMonth}
                  count={money(
                    despesasDoMes.reduce(
                      (sum, custo) => sum + Number(custo.valor || 0),
                      0,
                    ),
                  )}
                />
                <button
                  onClick={abrirNovoCusto}
                  className="bg-gradient-to-r from-cyan-700 to-teal-600 text-white rounded-2xl px-5 py-3 font-semibold"
                >
                  + Nova Despesa
                </button>
              </div>
              {novoCustoAberto && (
                <CustoFormBox
                  title="Nova Despesa"
                  value={custoForm}
                  setValue={setCustoForm}
                  onSave={criarCusto}
                  saving={saving}
                />
              )}
              <ListaCustos
                custos={despesasDoMes}
                onEdit={abrirEdicaoCusto}
                total={despesasDoMes.reduce(
                  (sum, custo) => sum + Number(custo.valor || 0),
                  0,
                )}
              />
            </section>
          )}

          {activeTab === "Cartão" && (
            <section className="bg-[#0d1820]/90 rounded-3xl p-6 border border-cyan-800/40 shadow-xl shadow-cyan-950/20 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <MonthHeader
                  title="Cartão"
                  month={month}
                  setMonth={setMonth}
                  count={money(
                    faturasDoMes.reduce(
                      (sum, custo) => sum + Number(custo.valor || 0),
                      0,
                    ),
                  )}
                />
                <button
                  onClick={abrirNovaFatura}
                  className="bg-gradient-to-r from-cyan-700 to-teal-600 text-white rounded-2xl px-5 py-3 font-semibold"
                >
                  + Nova Fatura
                </button>
              </div>
              {novaFaturaAberta && (
                <CustoFormBox
                  title="Nova Fatura"
                  value={custoForm}
                  setValue={setCustoForm}
                  onSave={criarCusto}
                  saving={saving}
                  contexto="fatura"
                />
              )}
              <ListaCustos
                custos={faturasDoMes}
                onEdit={abrirEdicaoCusto}
                total={faturasDoMes.reduce(
                  (sum, custo) => sum + Number(custo.valor || 0),
                  0,
                )}
              />
            </section>
          )}

          {trabalhoEditando && (
            <Modal
              title="Editar Trabalho"
              onClose={() => setTrabalhoEditando(null)}
            >
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
                <InfoCard
                  label="Custos"
                  value={money(totalCustosTrabalho(trabalhoEditando))}
                />
                <InfoCard
                  label="Lucro previsto"
                  value={money(lucroPrevisto(trabalhoEditando))}
                />
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
                contexto={
                  custoForm.tipo === "Trabalho"
                    ? "trabalho"
                    : custoForm.forma_pagamento === "Cartão"
                      ? "fatura"
                      : "geral"
                }
              />
            </Modal>
          )}
        </div>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#061016]/95 backdrop-blur border-t border-cyan-900/40 px-3 py-2 flex items-center justify-around">
        {navItems.map((item) => (
          <button
            key={item}
            onClick={() => setActiveTab(item)}
            className={`min-w-16 rounded-xl py-2 flex flex-col items-center gap-1 transition ${
              activeTab === item
                ? "bg-cyan-950/60 text-white"
                : "text-cyan-100/45"
            }`}
          >
            <span className="text-lg leading-none">{navIcons[item]}</span>
            <span className="text-[11px]">{item}</span>
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
    entrou: number;
    saiu: number;
    sobrou: number;
    quantidadeTrabalhos: number;
  };
}) {
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      <InfoCard label="Entrou" value={money(stats.entrou)} icon="↑" />
      <InfoCard label="Saiu" value={money(stats.saiu)} icon="↓" />
      <InfoCard label="Sobrou" value={money(stats.sobrou)} icon="=" destaque />
      <InfoCard
        label="Trabalhos"
        value={String(stats.quantidadeTrabalhos)}
        icon="▣"
      />
    </section>
  );
}

function InfoCard({
  label,
  value,
  icon,
  destaque = false,
}: {
  label: string;
  value: string;
  icon?: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl md:rounded-3xl p-4 md:p-6 border shadow-xl shadow-cyan-950/15 ${
        destaque
          ? "bg-gradient-to-br from-cyan-800/55 to-teal-900/45 border-cyan-600/40"
          : "bg-[#0d1820]/90 border-cyan-900/35"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-cyan-100/60 text-xs md:text-sm">{label}</p>
        {icon && <span className="text-cyan-300/65 text-sm">{icon}</span>}
      </div>
      <h2 className="text-xl md:text-3xl font-bold mt-2 break-words">
        {value}
      </h2>
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
        <p className="text-cyan-100/55 text-xs uppercase tracking-wide">
          Mês vigente
        </p>

        <div className="flex items-center gap-3 mt-1">
          <button
            className="text-cyan-100/55 text-xl"
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            ‹
          </button>

          <h3 className="text-xl md:text-2xl font-bold capitalize">
            {title} — {monthLabel(month)}
          </h3>

          <button
            className="text-cyan-100/55 text-xl"
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
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
      <MonthHeader
        title="Trabalhos"
        month={month}
        setMonth={setMonth}
        count={`${trabalhos.length} trabalhos`}
      />
      <ListaTrabalhos
        trabalhos={trabalhos}
        trabalhoFinalizado={trabalhoFinalizado}
        onEdit={onEdit}
      />
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

  const custosVisiveis = mostrarTodosCustos
    ? custosOrdenados
    : custosOrdenados.slice(0, 5);

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
          {mostrarTodosCustos
            ? "Ocultar custos"
            : `Ver todos os custos (${custosOrdenados.length})`}
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
              <p className="text-sm font-medium truncate">
                {item.tipo_trabalho || "Trabalho"}
              </p>
              <p className="text-sm text-cyan-100/70 truncate">
                {item.cliente || "Sem cliente"}
              </p>
            </div>

            <div className="text-right shrink-0">
              <p className="font-bold whitespace-nowrap">
                {money(item.valor_cobrado || 0)}
              </p>
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
                {shortDate(custo.data)} •{" "}
                {custo.categoria ||
                  (custo.tipo === "Trabalho" ? "Custo do trabalho" : "Outros")}
                {custo.forma_pagamento ? ` • ${custo.forma_pagamento}` : ""}
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
    novoValor: string | boolean,
  ) {
    setValue({
      ...value,
      freelas_rascunho: value.freelas_rascunho.map((freela) =>
        freela.id === id ? { ...freela, [campo]: novoValor } : freela,
      ),
    });
  }

  function removerFreelaRascunho(id: string) {
    setValue({
      ...value,
      freelas_rascunho: value.freelas_rascunho.filter(
        (freela) => freela.id !== id,
      ),
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

  function atualizarCustoRascunho(
    id: string,
    campo: keyof CustoRascunho,
    novoValor: string,
  ) {
    setValue({
      ...value,
      custos_rascunho: value.custos_rascunho.map((custo) =>
        custo.id === id ? { ...custo, [campo]: novoValor } : custo,
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
    0,
  );

  const totalFreelasRascunho = value.freelas_rascunho.reduce(
    (sum, freela) => sum + parseMoney(freela.valor),
    0,
  );

  const lucroPrevistoRascunho =
    parseMoney(value.valor_cobrado) -
    totalFreelasRascunho -
    totalCustosRascunho;

  return (
    <div className="bg-[#0d1820]/90 border border-cyan-800/40 rounded-3xl p-5 shadow-xl shadow-cyan-950/20 space-y-5">
      <h3 className="text-xl font-bold">{title}</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-cyan-100/70 text-sm block mb-2">
            Data inicial
          </label>
          <input
            type="date"
            value={value.data}
            onChange={(event) =>
              setValue({ ...value, data: event.target.value })
            }
            className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none w-full"
          />
        </div>

        <div>
          <label className="text-cyan-100/70 text-sm block mb-2">
            Data final (opcional)
          </label>
          <input
            type="date"
            value={value.data_fim}
            onChange={(event) =>
              setValue({ ...value, data_fim: event.target.value })
            }
            className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          placeholder="Cliente"
          value={value.cliente}
          onChange={(event) =>
            setValue({ ...value, cliente: event.target.value })
          }
          className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none"
        />

        <input
          placeholder="Tipo de trabalho"
          value={value.tipo_trabalho}
          onChange={(event) =>
            setValue({ ...value, tipo_trabalho: event.target.value })
          }
          className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none"
        />
      </div>

      <input
        placeholder="Valor cobrado — ex: 700 ou 1500,50"
        inputMode="decimal"
        value={value.valor_cobrado}
        onChange={(event) =>
          setValue({ ...value, valor_cobrado: event.target.value })
        }
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
                    atualizarFreelaRascunho(
                      freela.id,
                      "nome",
                      event.target.value,
                    )
                  }
                  className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none"
                />

                <input
                  placeholder="Valor — ex: 300"
                  inputMode="decimal"
                  value={freela.valor}
                  onChange={(event) =>
                    atualizarFreelaRascunho(
                      freela.id,
                      "valor",
                      event.target.value,
                    )
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
            <p className="font-bold text-xl mt-1">
              {money(totalFreelasRascunho)}
            </p>
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
              <div
                key={custo.id}
                className="bg-zinc-900 border border-cyan-900/40 rounded-2xl p-4 space-y-3"
              >
                <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_auto] gap-3">
                  <input
                    placeholder="Nome do custo — ex: gasolina, hotel, pedágio"
                    value={custo.nome}
                    onChange={(event) =>
                      atualizarCustoRascunho(
                        custo.id,
                        "nome",
                        event.target.value,
                      )
                    }
                    className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none"
                  />

                  <input
                    placeholder="Valor"
                    inputMode="decimal"
                    value={custo.valor}
                    onChange={(event) =>
                      atualizarCustoRascunho(
                        custo.id,
                        "valor",
                        event.target.value,
                      )
                    }
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
                  onChange={(event) =>
                    atualizarCustoRascunho(
                      custo.id,
                      "observacoes",
                      event.target.value,
                    )
                  }
                  className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none w-full"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-zinc-900 border border-cyan-900/40 rounded-2xl p-4">
              <p className="text-cyan-100/55 text-sm">
                Total de custos previstos
              </p>
              <p className="font-bold text-xl mt-1">
                {money(totalCustosRascunho)}
              </p>
            </div>

            <div className="bg-zinc-900 border border-cyan-900/40 rounded-2xl p-4">
              <p className="text-cyan-100/55 text-sm">Lucro previsto</p>
              <p className="font-bold text-xl mt-1">
                {money(lucroPrevistoRascunho)}
              </p>
            </div>
          </div>
        </div>
      )}

      <textarea
        placeholder="Observações"
        value={value.observacoes}
        onChange={(event) =>
          setValue({ ...value, observacoes: event.target.value })
        }
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
  const totalCustosLivres = custos.reduce(
    (sum, custo) => sum + Number(custo.valor || 0),
    0,
  );

  const freelasExibidos =
    freelas.length > 0
      ? freelas
      : Number(trabalho.freela_valor || 0) > 0
        ? [
            {
              id: `antigo-${trabalho.id}`,
              trabalho_id: trabalho.id,
              nome: trabalho.freela_nome || "sem nome",
              valor: Number(trabalho.freela_valor || 0),
              pago: Boolean(trabalho.freela_pago),
            },
          ]
        : [];

  const totalFreelas = freelasExibidos.reduce(
    (sum, freela) => sum + Number(freela.valor || 0),
    0,
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
              <p className="text-cyan-100/55 text-sm truncate">
                {shortDate(custo.data)} • custo do trabalho
              </p>
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
              <p className="font-medium truncate">
                Freela — {freela.nome || "sem nome"}
              </p>
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
          <p className="text-2xl font-bold mt-1">
            {money(totalCustosLivres + totalFreelas)}
          </p>
        </div>
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
  contexto?: "geral" | "trabalho" | "fatura";
}) {
  const categorias = [
    "Alimentação",
    "Combustível",
    "Assinaturas",
    "Equipamentos",
    "Lazer",
    "Casa",
    "Outros",
  ];

  return (
    <div className="bg-[#0d1820]/90 border border-cyan-800/40 rounded-3xl p-5 shadow-xl shadow-cyan-950/20 space-y-4">
      <h3 className="text-xl font-bold">{title}</h3>

      {contexto === "trabalho" && (
        <div className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4">
          <p className="text-cyan-100/70 text-sm">
            Este custo ficará vinculado ao trabalho.
          </p>
        </div>
      )}

      {contexto === "fatura" && (
        <div className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4">
          <p className="text-cyan-100/70 text-sm">
            Cadastre apenas o valor total da fatura fechada.
          </p>
        </div>
      )}

      <div>
        <label className="text-cyan-100/70 text-sm block mb-2">Data</label>
        <input
          type="date"
          value={value.data}
          onChange={(event) => setValue({ ...value, data: event.target.value })}
          className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none w-full"
        />
      </div>

      {contexto === "geral" && (
        <div>
          <label className="text-cyan-100/70 text-sm block mb-2">
            Categoria
          </label>
          <select
            value={value.categoria}
            onChange={(event) =>
              setValue({ ...value, categoria: event.target.value })
            }
            className="bg-[#061016]/80 border border-cyan-900/40 rounded-2xl p-4 outline-none w-full"
          >
            {categorias.map((categoria) => (
              <option key={categoria} value={categoria}>
                {categoria}
              </option>
            ))}
          </select>
        </div>
      )}

      <input
        placeholder={
          contexto === "fatura" ? "Cartão — ex: Nubank" : "Descrição"
        }
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

      {contexto === "geral" && (
        <div>
          <label className="text-cyan-100/70 text-sm block mb-2">
            Forma de pagamento
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(["Pix", "Débito"] as const).map((forma) => (
              <button
                type="button"
                key={forma}
                onClick={() => setValue({ ...value, forma_pagamento: forma })}
                className={`rounded-2xl p-4 font-medium ${value.forma_pagamento === forma ? "bg-white text-black" : "bg-[#061016]/80 border border-cyan-900/40"}`}
              >
                {forma}
              </button>
            ))}
          </div>
        </div>
      )}

      <textarea
        placeholder="Observação (opcional)"
        value={value.observacoes}
        onChange={(event) =>
          setValue({ ...value, observacoes: event.target.value })
        }
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

          <button
            onClick={onClose}
            className="bg-zinc-900 border border-cyan-900/40 rounded-2xl px-4 py-2"
          >
            Fechar
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
