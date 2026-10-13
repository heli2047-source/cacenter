# Orçamento — Oficina CACENTER

Formulário de orçamento da oficina mecânica, em
`https://grupocacenter.com.br/orcamento/`.

Ferramenta **interna de balcão**: o atendente preenche no celular enquanto
atende, os totais se calculam sozinhos e o botão abre o WhatsApp da oficina com
o orçamento já escrito. Substitui a ficha em papel do `ORÇAMENTO.pdf`.

## Fluxo

1. Preenche cliente, veículo, peças e serviços. **Nome e placa são os únicos
   campos obrigatórios** — são as duas chaves de busca do histórico, e sem elas
   o orçamento seria impossível de achar depois. Peça e serviço são opcionais:
   dá para mandar o orçamento só com o veículo e fechar os valores depois de
   abrir o motor.
2. **Enviar por WhatsApp** grava o orçamento no navegador e abre a folha de
   destinatários: a lista fixa de `DESTINOS_FIXOS` mais o cliente, quando o
   campo "WhatsApp do cliente" está preenchido. O envio é **um a um** — toca num
   destinatário, o WhatsApp abre naquela conversa, volta e toca no próximo. Quem
   já recebeu fica marcado com `✓ enviado`, e a marca cai sozinha se o orçamento
   for revisado depois, porque aí o que foi enviado é a versão antiga.
3. O formulário fica em **modo de edição** daquele orçamento. Corrigir um valor
   e enviar de novo **atualiza o mesmo registro** em vez de criar um segundo.
4. **Novo orçamento** limpa a tela e sai do modo de edição.
5. **Buscar** (cabeçalho) abre o histórico. Busca por nome ou placa, ignorando
   acento, maiúsculas e o hífen da placa — `abc1d23` acha `ABC-1D23`. Cada
   resultado abre com a mensagem exata que foi enviada e três ações: **Editar**
   (devolve ao formulário), **Reenviar** (abre o WhatsApp sem alterar o
   registro) e **Excluir**.

## Onde os orçamentos ficam

No `localStorage` do próprio navegador, na chave `cacenter.orcamentos.v1`.
**Não há servidor nem banco de dados.** O que isso significa na prática:

- Os orçamentos existem **só no aparelho e no navegador em que foram feitos**.
  O celular do balcão não enxerga o que foi salvo no computador da oficina, nem
  o Chrome enxerga o que foi salvo no Safari.
- **Limpar dados do navegador apaga tudo.** Aba anônima não guarda nada.
- O iOS pode descartar o armazenamento de sites pouco usados. Para uso diário
  não costuma acontecer, mas o histórico aqui é conveniência, não arquivo legal
  — o registro que vale continua sendo a conversa no WhatsApp.
- O histórico guarda no máximo 300 orçamentos; o mais antigo sai quando passa
  disso. Se o navegador recusar o tamanho, o código descarta os mais antigos em
  vez de falhar o envio em curso.
- O orçamento é gravado quando o botão abre o WhatsApp. Se o atendente desistir
  de mandar a mensagem lá dentro, o registro fica salvo assim mesmo — a página
  não tem como saber o que aconteceu dentro do aplicativo.

## Manutenção

| O que mudar | Onde |
|---|---|
| Destinatários fixos do WhatsApp | `app.js`, constante `DESTINOS_FIXOS` — um `{ nome, telefone }` por linha, telefone em formato internacional sem símbolos (`5519989161240`) |
| Limite de tamanho da mensagem | `app.js`, constante `LIMITE_MENSAGEM` |
| Quantos orçamentos o histórico guarda | `app.js`, constante `LIMITE_HISTORICO` |
| Campos do cliente / veículo | `index.html` — basta o `data-cliente="Rótulo"` ou `data-veiculo="Rótulo"` no input; a mensagem e o registro se montam sozinhos a partir desses atributos |
| Estrutura de uma linha de item | `index.html`, `<template id="tplLinha">` |
| Cartão do histórico | `index.html`, `<template id="tplResultado">` |

O número atual (`5519989161240`) é **provisório, para testes**.

Não existe disparo simultâneo a partir da página: o link `wa.me` abre uma
conversa por vez e o navegador barra a abertura de várias janelas num mesmo
toque. Para atingir muita gente de uma vez, o caminho é a lista de transmissão
do próprio WhatsApp; a página sozinha só dispararia com a API oficial do
WhatsApp Business, que exige servidor, conta aprovada e cobrança por conversa.

**Ao alterar `styles.css` ou `app.js`, suba o `?v=` das duas referências no
`index.html`.** O celular do balcão guarda os arquivos em cache e, sem trocar a
URL, continuaria rodando a versão anterior depois do deploy — com o HTML novo e
o JavaScript velho, que é o pior dos dois mundos.

Ao mexer no formato do registro gravado, **suba a chave**
(`cacenter.orcamentos.v2`): os aparelhos em uso têm orçamentos no formato antigo
e o código descarta silenciosamente o que não reconhece.

## Relação com o site da locadora

Esta pasta é independente. Não importa `../styles.css` nem `../app.js`: aqueles
arquivos servem a landing page da locadora e um ajuste lá não deve quebrar o
orçamento. O único arquivo compartilhado é a imagem `../assets/logo.png`.

O preço dessa independência é que o bloco `:root` de cores e fontes em
`orcamento/styles.css` é uma **cópia** do bloco equivalente em `../styles.css`.
Se a identidade visual da CACENTER mudar, são dois arquivos para atualizar.

A página leva `<meta name="robots" content="noindex, nofollow">` e fica fora do
`sitemap.xml`: é ferramenta de trabalho, não página de captação.
