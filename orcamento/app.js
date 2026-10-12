document.addEventListener('DOMContentLoaded', () => {
  const OFICINA_PHONE = '5519989161240';
  const LIMITE_MENSAGEM = 1800;

  const BLOCOS = {
    pecas: { container: document.getElementById('linhasPecas'), total: document.getElementById('totalPecas'), rotulo: 'PEÇAS' },
    servicos: { container: document.getElementById('linhasServicos'), total: document.getElementById('totalServicos'), rotulo: 'SERVIÇOS' }
  };

  const form = document.getElementById('orcamentoForm');
  const tplLinha = document.getElementById('tplLinha');
  const totalGeralEl = document.getElementById('totalGeral');
  const btnEnviar = document.getElementById('btnEnviar');
  const aviso = document.getElementById('aviso');

  const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const quantidade = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

  let totalGeral = 0;

  /**
   * Converte o que o atendente digitou num número.
   *
   * O balcão digita dinheiro de várias formas — `1234`, `1234,56`, `1.234,56`, e às vezes
   * `1234.56` por hábito de teclado numérico. A vírgula, quando existe, é sempre o separador
   * decimal do pt-BR e os pontos são de milhar. Sem vírgula a leitura fica ambígua: `1.234`
   * tanto pode ser mil e duzentos e trinta e quatro quanto um e pouco. O desempate é o grupo
   * de exatamente três dígitos depois de um único ponto, que no pt-BR só aparece como milhar —
   * assim `1.234` vira 1234 e `1.5` continua 1,5. Campo vazio ou lixo devolve 0, nunca NaN,
   * porque o total é recalculado a cada tecla e um NaN contaminaria a soma inteira.
   */
  function parseNumero(texto) {
    const limpo = String(texto || '').replace(/[^\d.,]/g, '');
    if (!limpo) return 0;

    let normalizado;
    if (limpo.includes(',')) {
      normalizado = limpo.replace(/\./g, '').replace(',', '.');
    } else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) {
      normalizado = limpo.replace(/\./g, '');
    } else {
      normalizado = limpo;
    }

    const valor = Number.parseFloat(normalizado);
    return Number.isFinite(valor) && valor >= 0 ? valor : 0;
  }

  /**
   * Arredonda para centavos antes de somar.
   *
   * `2 × 59,90` em ponto flutuante dá 119.80000000000001; somado dez vezes o total mostrado
   * passa a divergir do que o cliente confere na tela item a item.
   */
  function emCentavos(valor) {
    return Math.round(valor * 100) / 100;
  }

  /** Lê um campo da linha pelo atributo `data-campo`. */
  function campo(linha, nome) {
    return linha.querySelector(`[data-campo="${nome}"]`);
  }

  /**
   * Recalcula os subtotais de um bloco e devolve a soma.
   *
   * A quantidade em branco vale 1: o atendente que digita só o valor está lançando uma
   * unidade, e obrigá-lo a preencher `1` em toda linha seria atrito puro no celular.
   */
  function somarBloco(container) {
    let total = 0;

    container.querySelectorAll('.linha').forEach(linha => {
      const textoQtd = campo(linha, 'qtd').value.trim();
      const qtd = textoQtd === '' ? 1 : parseNumero(textoQtd);
      const unitario = parseNumero(campo(linha, 'valor').value);
      const subtotal = emCentavos(qtd * unitario);

      campo(linha, 'subtotal').textContent = moeda.format(subtotal);
      total += subtotal;
    });

    return emCentavos(total);
  }

  /** Reescreve a numeração visível das linhas depois de uma inclusão ou remoção. */
  function renumerar(container) {
    container.querySelectorAll('.linha-num').forEach((el, i) => {
      el.textContent = `#${i + 1}`;
    });
  }

  /**
   * Recalcula os três totais e reavalia se o orçamento pode ser enviado.
   *
   * Roda inteiro a cada tecla, sem estado acumulado entre chamadas: é barato para a dezena de
   * linhas que um orçamento tem e elimina a classe de bug em que uma remoção deixa resíduo na
   * soma.
   */
  function recalcular() {
    const totalPecas = somarBloco(BLOCOS.pecas.container);
    const totalServicos = somarBloco(BLOCOS.servicos.container);
    totalGeral = emCentavos(totalPecas + totalServicos);

    BLOCOS.pecas.total.textContent = moeda.format(totalPecas);
    BLOCOS.servicos.total.textContent = moeda.format(totalServicos);
    totalGeralEl.textContent = moeda.format(totalGeral);

    atualizarEnvio();
  }

  /** Habilita o envio e diz, em texto, o que ainda falta para liberar. */
  function atualizarEnvio() {
    const temNome = document.getElementById('nome').value.trim() !== '';
    const pronto = temNome && totalGeral > 0;

    btnEnviar.disabled = !pronto;
    aviso.classList.remove('erro');

    if (pronto) {
      aviso.textContent = '';
    } else if (!temNome && totalGeral <= 0) {
      aviso.textContent = 'Preencha o nome do cliente e ao menos um item com valor.';
    } else if (!temNome) {
      aviso.textContent = 'Falta o nome do cliente.';
    } else {
      aviso.textContent = 'Lance ao menos um item com valor.';
    }
  }

  /**
   * Faz os campos `.upper` guardarem em maiúsculas o que já exibem em maiúsculas.
   *
   * O `text-transform: uppercase` da placa é só pintura: sem isto o atendente lê `ABC1D23`
   * na tela e o WhatsApp recebe `abc1d23`.
   */
  function ligarMaiusculas() {
    document.querySelectorAll('input.upper').forEach(input => {
      input.addEventListener('input', () => {
        input.value = input.value.toUpperCase();
      });
    });
  }

  /** Cria uma linha de item no bloco indicado e devolve o elemento criado. */
  function adicionarLinha(chave) {
    const container = BLOCOS[chave].container;
    const linha = tplLinha.content.firstElementChild.cloneNode(true);

    container.appendChild(linha);
    renumerar(container);
    return linha;
  }

  /**
   * Remove a linha, exceto quando é a última do bloco.
   *
   * Um bloco sem nenhuma linha deixaria o atendente sem onde digitar e sem botão óbvio de
   * volta além do `+ Adicionar`. A última linha é esvaziada no lugar de apagada.
   */
  function removerLinha(linha) {
    const container = linha.parentElement;

    if (container.querySelectorAll('.linha').length > 1) {
      linha.remove();
    } else {
      campo(linha, 'desc').value = '';
      campo(linha, 'qtd').value = '1';
      campo(linha, 'valor').value = '';
    }

    renumerar(container);
    recalcular();
  }

  /** Lista os itens preenchidos de um bloco, já com subtotal calculado. */
  function itensDoBloco(chave) {
    const itens = [];

    BLOCOS[chave].container.querySelectorAll('.linha').forEach(linha => {
      const descricao = campo(linha, 'desc').value.trim();
      const textoQtd = campo(linha, 'qtd').value.trim();
      const qtd = textoQtd === '' ? 1 : parseNumero(textoQtd);
      const unitario = parseNumero(campo(linha, 'valor').value);

      if (descricao === '' && unitario === 0) return;

      itens.push({
        descricao: descricao || 'Item sem descrição',
        qtd,
        unitario,
        subtotal: emCentavos(qtd * unitario)
      });
    });

    return itens;
  }

  /** Monta as linhas `Rótulo: valor` de um grupo, descartando os campos em branco. */
  function linhasDeCampos(seletor, atributo) {
    return Array.from(document.querySelectorAll(seletor))
      .filter(input => input.value.trim() !== '')
      .map(input => `${input.getAttribute(atributo)}: ${input.value.trim()}`);
  }

  /**
   * Escreve o orçamento no formato que o WhatsApp renderiza.
   *
   * Campos em branco ficam de fora em vez de virarem rótulo órfão: um orçamento de pessoa
   * física não tem CNPJ nem responsável, e a mensagem não deveria anunciar isso em cinco
   * linhas vazias.
   */
  function montarMensagem() {
    const partes = ['*ORÇAMENTO — CACENTER*', `Data: ${new Date().toLocaleDateString('pt-BR')}`];

    const cliente = linhasDeCampos('[data-cliente]', 'data-cliente');
    if (cliente.length) partes.push('', '*CLIENTE*', ...cliente);

    const veiculo = linhasDeCampos('[data-veiculo]', 'data-veiculo');
    if (veiculo.length) partes.push('', '*VEÍCULO*', ...veiculo);

    Object.keys(BLOCOS).forEach(chave => {
      const itens = itensDoBloco(chave);
      if (!itens.length) return;

      const total = emCentavos(itens.reduce((soma, item) => soma + item.subtotal, 0));
      const listadas = itens.map((item, i) =>
        `${i + 1}. ${item.descricao} — ${quantidade.format(item.qtd)} × ${moeda.format(item.unitario)} = ${moeda.format(item.subtotal)}`
      );

      partes.push('', `*${BLOCOS[chave].rotulo}*`, ...listadas, `Total: ${moeda.format(total)}`);
    });

    partes.push('', `*VALOR TOTAL: ${moeda.format(totalGeral)}*`);
    return partes.join('\n');
  }

  Object.keys(BLOCOS).forEach(chave => {
    const container = BLOCOS[chave].container;

    container.addEventListener('input', recalcular);

    container.addEventListener('click', e => {
      const botao = e.target.closest('[data-remove]');
      if (botao) removerLinha(botao.closest('.linha'));
    });

    adicionarLinha(chave);
  });

  document.querySelectorAll('[data-add]').forEach(botao => {
    botao.addEventListener('click', () => {
      const linha = adicionarLinha(botao.getAttribute('data-add'));
      campo(linha, 'desc').focus();
    });
  });

  ligarMaiusculas();
  document.getElementById('nome').addEventListener('input', atualizarEnvio);

  form.addEventListener('submit', e => {
    e.preventDefault();

    const mensagem = montarMensagem();

    if (mensagem.length > LIMITE_MENSAGEM) {
      aviso.textContent = `Orçamento longo demais para o WhatsApp (${mensagem.length} de ${LIMITE_MENSAGEM} caracteres). Encurte as descrições ou divida em dois envios.`;
      aviso.classList.add('erro');
      return;
    }

    window.open(`https://wa.me/${OFICINA_PHONE}?text=${encodeURIComponent(mensagem)}`, '_blank');
  });

  recalcular();
});
