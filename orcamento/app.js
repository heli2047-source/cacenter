document.addEventListener('DOMContentLoaded', () => {
  const OFICINA_PHONE = '5519989161240';
  const LIMITE_MENSAGEM = 1800;
  const CHAVE_ARMAZENAMENTO = 'cacenter.orcamentos.v1';
  const LIMITE_HISTORICO = 300;

  const BLOCOS = {
    pecas: { container: document.getElementById('linhasPecas'), total: document.getElementById('totalPecas'), rotulo: 'PEÇAS' },
    servicos: { container: document.getElementById('linhasServicos'), total: document.getElementById('totalServicos'), rotulo: 'SERVIÇOS' }
  };

  const form = document.getElementById('orcamentoForm');
  const tplLinha = document.getElementById('tplLinha');
  const tplResultado = document.getElementById('tplResultado');
  const totalGeralEl = document.getElementById('totalGeral');
  const btnEnviar = document.getElementById('btnEnviar');
  const btnEnviarTexto = document.getElementById('btnEnviarTexto');
  const aviso = document.getElementById('aviso');
  const campoNome = document.getElementById('nome');
  const campoPlacas = document.getElementById('placas');

  const faixaEdicao = document.getElementById('faixaEdicao');
  const faixaDetalhe = document.getElementById('faixaDetalhe');
  const dlgBusca = document.getElementById('dlgBusca');
  const campoBusca = document.getElementById('campoBusca');
  const dlgLista = document.getElementById('dlgLista');
  const dlgInfo = document.getElementById('dlgInfo');
  const badgeSalvos = document.getElementById('badgeSalvos');

  const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const quantidade = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
  const dataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  let totalGeral = 0;
  let idEmEdicao = null;

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

  /** Remove acentos e caixa para comparar texto digitado com texto gravado. */
  function normalizar(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  /**
   * Reduz a placa ao que nela é estável.
   *
   * `ABC-1D23`, `abc1d23` e `ABC 1D23` são a mesma placa; a busca não pode depender de o
   * atendente lembrar como digitou o hífen no dia do cadastro.
   */
  function soAlfanumerico(texto) {
    return normalizar(texto).replace(/[^a-z0-9]/g, '');
  }

  /** Lê um campo da linha pelo atributo `data-campo`. */
  function campo(linha, nome) {
    return linha.querySelector(`[data-campo="${nome}"]`);
  }

  /**
   * Lê a quantidade de uma linha, tratando o campo em branco como uma unidade.
   *
   * O atendente que digita só o valor está lançando uma unidade, e obrigá-lo a preencher `1`
   * em toda linha seria atrito puro no celular.
   */
  function lerQtd(linha) {
    const texto = campo(linha, 'qtd').value.trim();
    return texto === '' ? 1 : parseNumero(texto);
  }

  /** Recalcula os subtotais de um bloco e devolve a soma. */
  function somarBloco(container) {
    let total = 0;

    container.querySelectorAll('.linha').forEach(linha => {
      const subtotal = emCentavos(lerQtd(linha) * parseNumero(campo(linha, 'valor').value));
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

  /**
   * Habilita o envio e diz, em texto, o que ainda falta para liberar.
   *
   * Nome e placa são as duas únicas exigências, e só porque são as chaves de busca do
   * histórico: um orçamento gravado sem eles seria impossível de achar depois. Peça e serviço
   * ficam de fora de propósito — o atendente às vezes manda o orçamento só com o veículo, para
   * fechar os valores depois de abrir o motor.
   */
  function atualizarEnvio() {
    const faltando = [];
    if (campoNome.value.trim() === '') faltando.push('o nome do cliente');
    if (campoPlacas.value.trim() === '') faltando.push('a placa do veículo');

    btnEnviar.disabled = faltando.length > 0;
    aviso.classList.remove('erro');
    aviso.textContent = faltando.length ? `Falta preencher ${faltando.join(', ')}.` : '';
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

  /** Deixa o bloco com uma única linha em branco. */
  function zerarBloco(chave) {
    BLOCOS[chave].container.replaceChildren();
    adicionarLinha(chave);
  }

  /** Lista os itens preenchidos de um bloco, já com subtotal calculado. */
  function itensDoBloco(chave) {
    const itens = [];

    BLOCOS[chave].container.querySelectorAll('.linha').forEach(linha => {
      const descricao = campo(linha, 'desc').value.trim();
      const unitario = parseNumero(campo(linha, 'valor').value);
      if (descricao === '' && unitario === 0) return;

      const qtd = lerQtd(linha);
      itens.push({
        descricao: descricao || 'Item sem descrição',
        qtd,
        unitario,
        subtotal: emCentavos(qtd * unitario)
      });
    });

    return itens;
  }

  /**
   * Lê um grupo de campos como `{ campo, rotulo, valor }`.
   *
   * O `campo` guarda o id do input, não o rótulo, para que o registro antigo continue voltando
   * ao formulário certo se amanhã o rótulo for reescrito na tela.
   */
  function coletarCampos(atributo) {
    return Array.from(document.querySelectorAll(`[${atributo}]`))
      .filter(input => input.value.trim() !== '')
      .map(input => ({ campo: input.id, rotulo: input.getAttribute(atributo), valor: input.value.trim() }));
  }

  /** Monta o registro do orçamento a partir do que está na tela. */
  function coletarOrcamento() {
    const pecas = itensDoBloco('pecas');
    const servicos = itensDoBloco('servicos');
    const somar = itens => emCentavos(itens.reduce((soma, item) => soma + item.subtotal, 0));

    return {
      nome: campoNome.value.trim(),
      placas: campoPlacas.value.trim(),
      cliente: coletarCampos('data-cliente'),
      veiculo: coletarCampos('data-veiculo'),
      pecas,
      servicos,
      totalPecas: somar(pecas),
      totalServicos: somar(servicos),
      totalGeral: emCentavos(somar(pecas) + somar(servicos))
    };
  }

  /**
   * Escreve o orçamento no formato que o WhatsApp renderiza.
   *
   * A data vem do registro, não do relógio: reenviar amanhã um orçamento fechado hoje não pode
   * reescrever a data que o cliente já viu.
   */
  function montarMensagem(reg) {
    const partes = ['*ORÇAMENTO — CACENTER*', `Data: ${new Date(reg.criadoEm).toLocaleDateString('pt-BR')}`];

    if (reg.atualizadoEm) {
      partes.push(`Revisado em: ${new Date(reg.atualizadoEm).toLocaleDateString('pt-BR')}`);
    }

    const linhasDe = lista => lista.map(item => `${item.rotulo}: ${item.valor}`);
    if (reg.cliente.length) partes.push('', '*CLIENTE*', ...linhasDe(reg.cliente));
    if (reg.veiculo.length) partes.push('', '*VEÍCULO*', ...linhasDe(reg.veiculo));

    [['pecas', 'PEÇAS', reg.totalPecas], ['servicos', 'SERVIÇOS', reg.totalServicos]].forEach(([chave, rotulo, total]) => {
      if (!reg[chave].length) return;

      const listadas = reg[chave].map((item, i) =>
        `${i + 1}. ${item.descricao} — ${quantidade.format(item.qtd)} × ${moeda.format(item.unitario)} = ${moeda.format(item.subtotal)}`
      );

      partes.push('', `*${rotulo}*`, ...listadas, `Total: ${moeda.format(total)}`);
    });

    partes.push('', `*VALOR TOTAL: ${moeda.format(reg.totalGeral)}*`);
    return partes.join('\n');
  }

  /**
   * Lê o histórico do armazenamento do navegador.
   *
   * Devolve lista vazia em vez de explodir quando o armazenamento está bloqueado (aba anônima,
   * cookies de terceiros desligados) ou quando o conteúdo gravado não é mais o que esta versão
   * espera: perder o histórico é ruim, mas uma tela que nem abre é pior.
   */
  function lerOrcamentos() {
    try {
      const bruto = localStorage.getItem(CHAVE_ARMAZENAMENTO);
      const lista = bruto ? JSON.parse(bruto) : [];
      return Array.isArray(lista) ? lista.filter(reg => reg && reg.id) : [];
    } catch (erro) {
      return [];
    }
  }

  /**
   * Grava o histórico, descartando os mais antigos quando o navegador recusa o tamanho.
   *
   * O limite de armazenamento varia por navegador e é compartilhado com o resto do domínio.
   * Diante de um `QuotaExceededError` vale mais manter os orçamentos recentes do que falhar o
   * envio que o atendente está fazendo agora.
   */
  function gravarOrcamentos(lista) {
    let aGravar = lista.slice(0, LIMITE_HISTORICO);

    while (aGravar.length) {
      try {
        localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(aGravar));
        return true;
      } catch (erro) {
        aGravar = aGravar.slice(0, Math.floor(aGravar.length / 2));
      }
    }

    return false;
  }

  /**
   * Insere o orçamento ou atualiza o que está em edição, e devolve o registro gravado.
   *
   * Reenviar um orçamento revisado tem que sobrescrever o registro, não criar um segundo: dois
   * registros com o mesmo nome e a mesma placa, um com valor velho, transformariam a busca numa
   * armadilha. O `id` e o `criadoEm` originais sobrevivem à edição; só o `atualizadoEm` muda.
   */
  function salvarOrcamento(dados) {
    const lista = lerOrcamentos();
    const existente = idEmEdicao ? lista.findIndex(reg => reg.id === idEmEdicao) : -1;
    const agora = new Date().toISOString();

    let registro;
    if (existente >= 0) {
      registro = { ...lista[existente], ...dados, atualizadoEm: agora };
      lista.splice(existente, 1);
    } else {
      registro = { ...dados, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, criadoEm: agora };
    }

    lista.unshift(registro);
    gravarOrcamentos(lista);
    atualizarBadge();
    return registro;
  }

  /** Apaga um orçamento do histórico. */
  function excluirOrcamento(id) {
    gravarOrcamentos(lerOrcamentos().filter(reg => reg.id !== id));
    if (idEmEdicao === id) sairDeEdicao();
    atualizarBadge();
  }

  /** Mostra no botão de busca quantos orçamentos estão guardados. */
  function atualizarBadge() {
    const total = lerOrcamentos().length;
    badgeSalvos.textContent = total > 99 ? '99+' : String(total);
    badgeSalvos.hidden = total === 0;
  }

  /** Marca o formulário como edição de um registro já gravado. */
  function entrarEmEdicao(reg) {
    idEmEdicao = reg.id;
    faixaEdicao.hidden = false;
    faixaDetalhe.textContent = `${reg.nome} · ${reg.placas} · salvo em ${dataHora.format(new Date(reg.atualizadoEm || reg.criadoEm))}`;
    btnEnviarTexto.textContent = 'Atualizar e enviar';
  }

  /** Volta o formulário ao modo de orçamento novo, sem limpar o que está digitado. */
  function sairDeEdicao() {
    idEmEdicao = null;
    faixaEdicao.hidden = true;
    faixaDetalhe.textContent = '';
    btnEnviarTexto.textContent = 'Enviar por WhatsApp';
  }

  /** Esvazia o formulário inteiro e sai do modo de edição. */
  function limparFormulario() {
    form.querySelectorAll('input').forEach(input => { input.value = ''; });
    zerarBloco('pecas');
    zerarBloco('servicos');
    sairDeEdicao();
    recalcular();
  }

  /** Devolve um registro gravado ao formulário para revisão. */
  function carregarNoFormulario(reg) {
    limparFormulario();

    [...reg.cliente, ...reg.veiculo].forEach(({ campo: id, valor }) => {
      const input = document.getElementById(id);
      if (input) input.value = valor;
    });

    ['pecas', 'servicos'].forEach(chave => {
      const itens = reg[chave];
      if (!itens.length) return;

      BLOCOS[chave].container.replaceChildren();
      itens.forEach(item => {
        const linha = adicionarLinha(chave);
        campo(linha, 'desc').value = item.descricao;
        campo(linha, 'qtd').value = quantidade.format(item.qtd);
        campo(linha, 'valor').value = item.unitario.toFixed(2).replace('.', ',');
      });
    });

    entrarEmEdicao(reg);
    recalcular();
  }

  /** Abre o WhatsApp da oficina com o orçamento escrito, ou avisa se a mensagem não couber. */
  function enviarPorWhatsApp(reg) {
    const mensagem = montarMensagem(reg);

    if (mensagem.length > LIMITE_MENSAGEM) {
      aviso.textContent = `Orçamento longo demais para o WhatsApp (${mensagem.length} de ${LIMITE_MENSAGEM} caracteres). Encurte as descrições ou divida em dois envios.`;
      aviso.classList.add('erro');
      return false;
    }

    window.open(`https://wa.me/${OFICINA_PHONE}?text=${encodeURIComponent(mensagem)}`, '_blank');
    return true;
  }

  /** Filtra o histórico por nome ou placa, ignorando acento, caixa e pontuação da placa. */
  function filtrar(termo) {
    const lista = lerOrcamentos();
    const texto = normalizar(termo);
    if (!texto) return lista;

    const placa = soAlfanumerico(termo);
    return lista.filter(reg =>
      normalizar(reg.nome).includes(texto) || (placa !== '' && soAlfanumerico(reg.placas).includes(placa))
    );
  }

  /** Desenha a lista de resultados da busca. */
  function renderizarBusca() {
    const termo = campoBusca.value;
    const achados = filtrar(termo);
    const salvos = lerOrcamentos().length;

    dlgLista.replaceChildren();

    if (salvos === 0) {
      dlgInfo.textContent = 'Nenhum orçamento salvo ainda. Os orçamentos enviados aparecem aqui.';
      return;
    }

    if (!achados.length) {
      dlgInfo.textContent = `Nenhum orçamento encontrado para "${termo.trim()}".`;
      return;
    }

    dlgInfo.textContent = achados.length === salvos
      ? `${salvos} orçamento${salvos > 1 ? 's' : ''} salvo${salvos > 1 ? 's' : ''}.`
      : `${achados.length} de ${salvos} orçamentos.`;

    achados.forEach(reg => dlgLista.appendChild(montarResultado(reg)));
  }

  /** Monta o cartão de um orçamento na lista de resultados. */
  function montarResultado(reg) {
    const no = tplResultado.content.firstElementChild.cloneNode(true);
    const quando = new Date(reg.atualizadoEm || reg.criadoEm);

    no.dataset.id = reg.id;
    no.querySelector('.resultado-nome').textContent = reg.nome;
    no.querySelector('.resultado-placa').textContent = reg.placas;
    no.querySelector('.resultado-data').textContent = (reg.atualizadoEm ? 'revisado ' : '') + dataHora.format(quando);
    no.querySelector('.resultado-total').textContent = moeda.format(reg.totalGeral);
    no.querySelector('.resultado-texto').textContent = montarMensagem(reg);

    return no;
  }

  /** Abre o histórico com a busca em branco e o foco já no campo. */
  function abrirBusca() {
    campoBusca.value = '';
    renderizarBusca();
    dlgBusca.showModal();
    document.body.classList.add('modal-aberto');
    campoBusca.focus();
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
  campoNome.addEventListener('input', atualizarEnvio);
  campoPlacas.addEventListener('input', atualizarEnvio);

  document.getElementById('btnNovo').addEventListener('click', () => {
    limparFormulario();
    campoNome.focus();
  });

  form.addEventListener('submit', e => {
    e.preventDefault();

    const registro = salvarOrcamento(coletarOrcamento());
    if (!enviarPorWhatsApp(registro)) return;

    entrarEmEdicao(registro);
  });

  document.getElementById('btnBuscar').addEventListener('click', abrirBusca);
  document.getElementById('btnFechar').addEventListener('click', () => dlgBusca.close());
  dlgBusca.addEventListener('close', () => document.body.classList.remove('modal-aberto'));
  campoBusca.addEventListener('input', renderizarBusca);

  dlgLista.addEventListener('click', e => {
    const cartao = e.target.closest('.resultado');
    if (!cartao) return;

    const id = cartao.dataset.id;
    const registro = lerOrcamentos().find(reg => reg.id === id);
    if (!registro) return;

    if (e.target.closest('[data-alternar]')) {
      const corpo = cartao.querySelector('.resultado-corpo');
      corpo.hidden = !corpo.hidden;
      cartao.classList.toggle('aberto', !corpo.hidden);
    } else if (e.target.closest('[data-editar]')) {
      carregarNoFormulario(registro);
      dlgBusca.close();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (e.target.closest('[data-reenviar]')) {
      enviarPorWhatsApp(registro);
    } else if (e.target.closest('[data-excluir]')) {
      excluirOrcamento(id);
      renderizarBusca();
    }
  });

  atualizarBadge();
  recalcular();
});
