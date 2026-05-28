# Financeiro Jean Novaes Audiovisual

Primeira versão funcional do app financeiro privado.

## O que esta versão faz

- Dashboard mensal: entrou, saiu, sobrou
- Botão + Novo Trabalho
- Botão + Novo Custo
- Lista de trabalhos do mês
- Tela Trabalhos
- Tela Custos
- Navegação desktop e mobile
- Trabalhos finalizados continuam na lista, mas ficam apagados
- Freela entra automaticamente como custo do trabalho
- Sem anexos, para manter simples e gratuito
- Dados salvos no navegador com localStorage

## Como rodar

1. Instale o Node.js
2. Abra a pasta do projeto no terminal
3. Rode:

```bash
npm install
npm run dev
```

4. Abra:

```bash
http://localhost:3000
```

## Observação importante

Esta versão salva os dados no navegador. É ótima para testar sem custo.
Depois podemos migrar para Supabase Free se você quiser sincronizar entre celular e notebook.
teste deploy
