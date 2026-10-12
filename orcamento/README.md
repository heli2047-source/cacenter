# Orçamento — Oficina CACENTER

Formulário de orçamento da oficina mecânica, em
`https://grupocacenter.com.br/orcamento/`.

Ferramenta **interna de balcão**: o atendente preenche no celular enquanto
atende, os totais se calculam sozinhos e o botão abre o WhatsApp da oficina com
o orçamento já escrito. Substitui a ficha em papel do `ORÇAMENTO.pdf`.

## Sem backend, de propósito

Não há banco de dados, servidor ou API. Tudo roda no navegador e nada é
persistido: ao fechar a aba, o orçamento se perde. Quem guarda o registro é o
próprio histórico do WhatsApp.

Consequência prática: **não recarregue a página no meio do preenchimento.**

## Manutenção

| O que mudar | Onde |
|---|---|
| Número de destino do WhatsApp | `app.js`, constante `OFICINA_PHONE` (primeira linha útil) |
| Limite de tamanho da mensagem | `app.js`, constante `LIMITE_MENSAGEM` |
| Campos do cliente / veículo | `index.html` — basta o `data-cliente="Rótulo"` ou `data-veiculo="Rótulo"` no input; a mensagem se monta sozinha a partir desses atributos |
| Estrutura de uma linha de item | `index.html`, `<template id="tplLinha">` |

O número atual (`5519989161240`) é **provisório, para testes**.

## Relação com o site da locadora

Esta pasta é independente. Não importa `../styles.css` nem `../app.js`: aqueles
arquivos servem a landing page da locadora e um ajuste lá não deve quebrar o
orçamento. O único arquivo compartilhado é a imagem `../assets/logo.png`.

O preço dessa independência é que o bloco `:root` de cores e fontes em
`orcamento/styles.css` é uma **cópia** do bloco equivalente em `../styles.css`.
Se a identidade visual da CACENTER mudar, são dois arquivos para atualizar.

A página leva `<meta name="robots" content="noindex, nofollow">` e fica fora do
`sitemap.xml`: é ferramenta de trabalho, não página de captação.
