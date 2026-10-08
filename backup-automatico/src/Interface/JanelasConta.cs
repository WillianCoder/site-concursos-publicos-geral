using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Forms;
using BackupAutomatico.Nucleo;
using static BackupAutomatico.Interface.Tema;
using static BackupAutomatico.Interface.Montar;

namespace BackupAutomatico.Interface
{
    /// <summary>Desenha um QR Code (sempre preto no branco, para qualquer celular ler).</summary>
    public sealed class QrImagem : Control
    {
        Qr qr;
        public QrImagem()
        {
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            Size = new Size(S(220), S(220));
            Margin = new Padding(0, S(6), S(16), S(6));
        }

        public string Conteudo
        {
            set { qr = string.IsNullOrEmpty(value) ? null : Qr.Gerar(value); Invalidate(); }
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.Clear(Parent?.BackColor ?? P.Superficie);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            Preencher(g, new RectangleF(0, 0, Width - 1, Height - 1), S(12), Color.White);
            if (qr == null)
            {
                Tema.Texto(g, "Pix não configurado", Base, ClientRectangle, Color.Gray, TextFormatFlags.HorizontalCenter);
                return;
            }
            g.SmoothingMode = SmoothingMode.None;
            int n = qr.Tamanho + 8;
            float m = Math.Min(Width, Height) / (float)n;
            float ox = (Width - m * n) / 2, oy = (Height - m * n) / 2;
            using (var b = new SolidBrush(Color.Black))
                for (int y = 0; y < qr.Tamanho; y++)
                    for (int x = 0; x < qr.Tamanho; x++)
                        if (qr.Escuro(x, y)) g.FillRectangle(b, ox + (x + 4) * m, oy + (y + 4) * m, m + 0.5f, m + 0.5f);
        }
    }

    /// <summary>Pix: doação (qualquer pessoa) ou pagamento do Pro.</summary>
    public sealed class JanelaPix : Form
    {
        readonly QrImagem qr = new QrImagem();
        readonly Campo codigo = new Campo();
        readonly Label valorRot = Rotulo("", Subtitulo);
        string codigoAtual = "";

        public static JanelaPix Doacao() => new JanelaPix(null);

        JanelaPix(object _)
        {
            Configurar(this, "Apoie o Backup Automático");
            var app = Conta.App;
            var g = Grade(1);
            g.Controls.Add(Cabecalho(G.Coracao, "Apoie o projeto", app.MensagemDoacao, P.Erro));
            if (!app.PixConfigurado)
            {
                g.Controls.Add(Rotulo("O Pix para doações ainda não foi configurado pelo administrador.", Base, "suave", S(460)));
            }
            else
            {
                var valores = Fluxo(false);
                valores.WrapContents = true;
                valores.MaximumSize = new Size(S(520), 0);
                foreach (var v in app.PixValores.Take(6))
                {
                    double val = v;
                    var b = new Botao(Textos.Dinheiro(v)) { Compacto = true, Margin = new Padding(0, 0, S(6), S(6)) };
                    b.Click += (s, e) => Atualizar(val);
                    valores.Controls.Add(b);
                }
                var outro = new Botao("Outro valor") { Compacto = true, Margin = new Padding(0, 0, S(6), S(6)) };
                outro.Click += (s, e) => Atualizar(0);
                valores.Controls.Add(outro);
                g.Controls.Add(Rotulo("Escolha um valor:", Base, "suave"));
                g.Controls.Add(valores);
                g.Controls.Add(PainelPix(qr, codigo, valorRot, () => codigoAtual, app));
                Atualizar(app.PixValores.Count > 1 ? app.PixValores[1] : 0);
            }
            var fechar = new Botao("Fechar") { DialogResult = DialogResult.Cancel, Margin = Padding.Empty };
            CancelButton = fechar;
            Finalizar(this, g, Fluxo(false, fechar), "janela-doacao");
        }

        void Atualizar(double valor)
        {
            var app = Conta.App;
            codigoAtual = Pix.Codigo(app.PixChave, app.PixNome, app.PixCidade, valor, "Apoio Backup Automatico", "APOIOBKP");
            qr.Conteudo = codigoAtual;
            codigo.Texto = codigoAtual;
            valorRot.Text = valor > 0 ? Textos.Dinheiro(valor) : "Valor livre (você digita no app do banco)";
        }

        // ---- partes reaproveitadas pelas outras janelas ----

        public static Control Cabecalho(string glifo, string titulo, string texto, Color cor)
        {
            string papel = cor == P.Erro ? "erro" : cor == P.Pro ? "pro" : "destaque";
            var icone = new Label { Text = Tema.TemIcones ? glifo : "", Font = Icones(18f), ForeColor = cor, Tag = papel, AutoSize = true, Margin = new Padding(0, S(2), S(10), 0), UseMnemonic = false };
            var t = Rotulo(titulo, Titulo);
            t.Margin = new Padding(0, 0, 0, 0);
            var s = Rotulo(texto, Base, "suave", S(520));
            return Fluxo(false, icone, Fluxo(true, t, s));
        }

        public static Control PainelPix(QrImagem qr, Campo codigo, Label valor, Func<string> atual, ConfigApp app)
        {
            codigo.Width = S(290);
            codigo.Caixa.ReadOnly = true;
            var copiar = new Botao("Copiar código Pix", EstiloBotao.Primario, G.Copiar) { Margin = new Padding(0, S(6), 0, 0) };
            var copiado = Rotulo("", Pequena, "ok");
            copiar.Click += (s, e) =>
            {
                try { Clipboard.SetText(atual()); copiado.Text = "Copiado! Cole no app do seu banco (Pix copia e cola)."; }
                catch { copiado.Text = "Não foi possível copiar. Selecione o código e copie."; }
            };
            var passos = Rotulo("1. Abra o app do seu banco e escolha Pix.\n2. Aponte a câmera para o QR Code\n    ou use \"Pix copia e cola\".\n3. Confira o nome: " + Textos.SemAcentos(app.PixNome).ToUpperInvariant(), Base, "suave", S(300));
            var lado = Fluxo(true, valor, passos, Rotulo("Pix copia e cola:", Pequena, "suave"), codigo, copiar, copiado);
            return Fluxo(false, qr, lado);
        }

        public static void Configurar(Form f, string titulo)
        {
            f.Text = titulo;
            f.Tag = "superficie";
            f.Font = Base;
            f.AutoScaleMode = AutoScaleMode.None;
            f.FormBorderStyle = FormBorderStyle.FixedDialog;
            f.MaximizeBox = f.MinimizeBox = false;
            f.ShowInTaskbar = false;
            f.StartPosition = FormStartPosition.CenterParent;
            f.Icon = Tema.Icone("app.ico", 32);
            f.HandleCreated += (s, e) => Nativo.TituloEscuro(f.Handle, P.Escuro);
        }

        public static void Finalizar(Form f, Control conteudo, Control botoes, string nomeCaptura)
        {
            f.Controls.Add(conteudo);
            f.Controls.Add(botoes);
            f.Load += (s, e) => { Tema.Aplicar(f); Encaixar(f, conteudo, botoes, S(24)); };
            f.Shown += (s, e) => { if (Programa.ModoCaptura) Programa.Capturar(f, nomeCaptura); };
        }
    }

    /// <summary>Entrar, criar conta, recuperar senha e sair.</summary>
    public sealed class JanelaConta : Form
    {
        readonly Campo email = new Campo("seu@email.com"), senha = new Campo("", true), senha2 = new Campo("", true);
        readonly Opcao entrar = new Opcao("Já tenho conta"), criar = new Opcao("Criar conta");
        readonly Botao acao = new Botao("Entrar", EstiloBotao.Primario, G.Pessoa) { Margin = new Padding(0, S(10), S(8), 0) };
        readonly Botao esqueci = new Botao("Esqueci minha senha", EstiloBotao.Fantasma) { Compacto = true, Margin = new Padding(0, S(10), 0, 0) };
        readonly Label status = Rotulo("", Base, "suave", S(440));
        readonly Label rotSenha2 = Rotulo("Repita a senha", Base, "suave");

        public JanelaConta()
        {
            JanelaPix.Configurar(this, "Sua conta");
            var g = Grade(1);
            if (Conta.Logado) MontarLogado(g);
            else MontarLogin(g);
            var fechar = new Botao("Fechar") { DialogResult = DialogResult.Cancel, Margin = Padding.Empty };
            CancelButton = fechar;
            JanelaPix.Finalizar(this, g, Fluxo(false, fechar), Conta.Logado ? "janela-conta" : "janela-entrar");
        }

        void MontarLogin(TableLayoutPanel g)
        {
            g.Controls.Add(JanelaPix.Cabecalho(G.Pessoa, "Entrar", "A conta é necessária só para o plano Pro. A versão grátis funciona sem conta.", P.Destaque));
            if (!Conta.Nuvem.Configurada)
                g.Controls.Add(Rotulo("As contas ainda não estão disponíveis: o administrador precisa configurar o Firebase no painel do site.", Base, "aviso", S(440)));
            g.Controls.Add(Fluxo(false, entrar, criar));
            email.Width = senha.Width = senha2.Width = S(440);
            g.Controls.Add(Rotulo("E-mail", Base, "suave"));
            g.Controls.Add(email);
            g.Controls.Add(Rotulo("Senha", Base, "suave"));
            g.Controls.Add(senha);
            g.Controls.Add(rotSenha2);
            g.Controls.Add(senha2);
            g.Controls.Add(Fluxo(false, acao, esqueci));
            g.Controls.Add(status);
            entrar.Checked = true;
            void Modo()
            {
                bool c = criar.Checked;
                rotSenha2.Visible = senha2.Visible = c;
                esqueci.Visible = !c;
                acao.Text = c ? "Criar conta" : "Entrar";
                acao.PerformLayout();
            }
            entrar.CheckedChanged += (s, e) => Modo();
            Modo();
            AcceptButton = acao;
            acao.Click += async (s, e) => await Executar(async () =>
            {
                if (criar.Checked)
                {
                    if (senha.Texto != senha2.Texto) throw new ErroNuvem("", "As senhas não são iguais.");
                    await Conta.CriarConta(email.Texto, senha.Texto);
                    MessageBox.Show(this, "Conta criada! Enviamos um e-mail para confirmar o endereço.", "Backup Automático", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
                else await Conta.Entrar(email.Texto, senha.Texto);
                DialogResult = DialogResult.OK;
                Close();
            });
            esqueci.Click += async (s, e) => await Executar(async () =>
            {
                if (email.Texto.Trim() == "") throw new ErroNuvem("", "Digite seu e-mail acima e clique de novo.");
                await Conta.Nuvem.RecuperarSenha(email.Texto);
                status.Text = "Pronto! Se existir uma conta com esse e-mail, chega uma mensagem para criar uma senha nova.";
                status.ForeColor = P.Ok;
            });
        }

        void MontarLogado(TableLayoutPanel g)
        {
            var s = Conta.Sessao;
            g.Controls.Add(JanelaPix.Cabecalho(G.Pessoa, "Sua conta", s.Email, P.Destaque));
            string plano = "Plano: " + Conta.NomePlano(Conta.Plano);
            if (Conta.Plano == Plano.Pro && Conta.Licenca != null)
                plano += Conta.Licenca.ValidoAte == null ? " (sem vencimento)" : " (até " + Textos.Data(Conta.Licenca.ValidoAte.Value) + ")";
            g.Controls.Add(Rotulo(plano, Subtitulo, Conta.Plano == Plano.Gratis ? null : "pro"));
            if (!s.EmailVerificado)
            {
                g.Controls.Add(Rotulo("Seu e-mail ainda não foi confirmado. Procure a mensagem na sua caixa de entrada (e no spam).", Base, "aviso", S(440)));
                var reenviar = new Botao("Reenviar e-mail de confirmação", EstiloBotao.Secundario, G.Email) { Margin = new Padding(0, S(6), 0, 0) };
                reenviar.Click += async (o, e) => await Executar(async () =>
                {
                    await Conta.Nuvem.Renovar(s);
                    await Conta.Nuvem.EnviarVerificacao(s);
                    status.Text = "E-mail enviado.";
                });
                g.Controls.Add(reenviar);
            }
            var atualizar = new Botao("Atualizar plano", EstiloBotao.Secundario, G.Atualizar) { Margin = new Padding(0, S(10), S(8), 0) };
            atualizar.Click += async (o, e) => await Executar(async () =>
            {
                await Conta.Nuvem.Renovar(s, true);
                await Conta.AtualizarLicenca();
                status.Text = "Plano atual: " + Conta.NomePlano(Conta.Plano) + ".";
            });
            var sair = new Botao("Sair da conta", EstiloBotao.Perigo, G.Sair) { Margin = new Padding(0, S(10), 0, 0) };
            sair.Click += (o, e) => { Conta.Sair(); DialogResult = DialogResult.OK; Close(); };
            g.Controls.Add(Fluxo(false, atualizar, sair));
            g.Controls.Add(status);
        }

        async Task Executar(Func<Task> acao2)
        {
            Cursor = Cursors.WaitCursor;
            foreach (Control c in new Control[] { acao, esqueci }) c.Enabled = false;
            status.Text = "Aguarde...";
            status.ForeColor = P.TextoSuave;
            try { await acao2(); }
            catch (Exception ex)
            {
                status.Text = ex is ErroNuvem ? ex.Message : "Erro: " + Motor.Mensagem(ex);
                status.ForeColor = P.Erro;
            }
            finally
            {
                Cursor = Cursors.Default;
                foreach (Control c in new Control[] { acao, esqueci }) c.Enabled = true;
            }
        }
    }

    /// <summary>Assinar o Pro: escolher o plano, pagar com Pix e avisar.</summary>
    public sealed class JanelaPro : Form
    {
        readonly QrImagem qr = new QrImagem();
        readonly Campo codigo = new Campo();
        readonly Label valorRot = Rotulo("", Subtitulo), status = Rotulo("", Base, "suave", S(560));
        readonly FlowLayoutPanel pedidos = Fluxo(true);
        OfertaPlano escolhido;
        string pedido = Nuvem.NovoCodigoPedido(), codigoAtual = "";

        public JanelaPro()
        {
            JanelaPix.Configurar(this, "Backup Automático Pro");
            var app = Conta.App;
            var g = Grade(1);
            g.Controls.Add(JanelaPix.Cabecalho(G.Estrela, "Backup Automático Pro", "Tudo da versão grátis, mais:", P.Pro));
            foreach (var r in Recursos.ListaPro) g.Controls.Add(Rotulo((Tema.TemIcones ? "✓  " : "- ") + r, Base));

            if (Conta.Plano != Plano.Gratis)
            {
                string val = Conta.Plano == Plano.Admin ? "Você é o administrador: tem acesso a tudo." :
                    Conta.Licenca?.ValidoAte == null ? "Seu Pro não tem vencimento. Obrigado pelo apoio!" : "Seu Pro vale até " + Textos.Data(Conta.Licenca.ValidoAte.Value) + ". Obrigado pelo apoio!";
                g.Controls.Add(Rotulo(val, Subtitulo, "pro", S(560)));
                if (Conta.Plano == Plano.Pro) g.Controls.Add(Rotulo("Para renovar ou estender, escolha um plano abaixo.", Base, "suave"));
            }
            if (Conta.Plano != Plano.Admin)
            {
                var opcoes = Fluxo(true);
                foreach (var p in app.Planos)
                {
                    var plano = p;
                    var o = new Opcao(p.Nome + "  -  " + Textos.Dinheiro(p.Valor) + "  (" + p.Descricao + ")");
                    o.CheckedChanged += (s, e) => { if (o.Checked) Escolher(plano); };
                    opcoes.Controls.Add(o);
                }
                var t1 = Rotulo("1. Escolha o plano", Subtitulo);
                t1.Margin = new Padding(0, S(14), 0, S(2));
                g.Controls.Add(t1);
                g.Controls.Add(opcoes);
                var t2 = Rotulo("2. Pague com Pix", Subtitulo);
                t2.Margin = new Padding(0, S(14), 0, S(2));
                g.Controls.Add(t2);
                if (!app.PixConfigurado) g.Controls.Add(Rotulo("O Pix ainda não foi configurado pelo administrador.", Base, "aviso"));
                else g.Controls.Add(JanelaPix.PainelPix(qr, codigo, valorRot, () => codigoAtual, app));
                var t3 = Rotulo("3. Avise que pagou", Subtitulo);
                t3.Margin = new Padding(0, S(14), 0, S(2));
                g.Controls.Add(t3);
                g.Controls.Add(Rotulo("O código do seu pedido (" + pedido + ") já vai junto no Pix. Depois de pagar, clique abaixo. Assim que o pagamento for confirmado, o Pro é liberado na sua conta (" + Conta.Email + ").", Base, "suave", S(560)));
                var paguei = new Botao("Já paguei - enviar pedido", EstiloBotao.Pro, G.Enviar) { Margin = new Padding(0, S(8), S(8), 0) };
                var atualizar = new Botao("Ver se já foi liberado", EstiloBotao.Secundario, G.Atualizar) { Margin = new Padding(0, S(8), 0, 0) };
                g.Controls.Add(Fluxo(false, paguei, atualizar));
                g.Controls.Add(status);
                g.Controls.Add(pedidos);
                paguei.Click += async (s, e) => await Executar(async () =>
                {
                    if (escolhido == null) throw new ErroNuvem("", "Escolha um plano.");
                    await Conta.Nuvem.CriarPedido(new Pedido { Plano = escolhido.Nome, Valor = escolhido.Valor, Meses = escolhido.Meses, Codigo = pedido }, Conta.Sessao);
                    status.Text = "Pedido " + pedido + " enviado! Você recebe o Pro assim que o pagamento for confirmado.";
                    status.ForeColor = P.Ok;
                    pedido = Nuvem.NovoCodigoPedido();
                    Escolher(escolhido);
                    await CarregarPedidos();
                });
                atualizar.Click += async (s, e) => await Executar(async () =>
                {
                    await Conta.AtualizarLicenca();
                    status.Text = Conta.Plano == Plano.Gratis ? "Ainda não foi liberado. Assim que o pagamento for confirmado, aparece aqui." : "Pro liberado! Obrigado.";
                    status.ForeColor = Conta.Plano == Plano.Gratis ? P.TextoSuave : P.Ok;
                    await CarregarPedidos();
                });
                if (opcoes.Controls.Count > 0) ((Opcao)opcoes.Controls[Math.Min(1, opcoes.Controls.Count - 1)]).Checked = true;
                Shown += async (s, e) => { if (!Programa.ModoCaptura) await Executar(CarregarPedidos); };
            }
            var fechar = new Botao("Fechar") { DialogResult = DialogResult.Cancel, Margin = Padding.Empty };
            CancelButton = fechar;
            JanelaPix.Finalizar(this, g, Fluxo(false, fechar), "janela-pro");
        }

        void Escolher(OfertaPlano p)
        {
            escolhido = p;
            var app = Conta.App;
            if (!app.PixConfigurado) return;
            codigoAtual = Pix.Codigo(app.PixChave, app.PixNome, app.PixCidade, p.Valor, "Backup Automatico " + pedido, pedido);
            qr.Conteudo = codigoAtual;
            codigo.Texto = codigoAtual;
            valorRot.Text = Textos.Dinheiro(p.Valor) + "  ·  " + p.Nome;
        }

        async Task CarregarPedidos()
        {
            var lista = await Conta.Nuvem.ListarPedidos(Conta.Sessao, false);
            pedidos.Controls.Clear();
            if (lista.Count > 0) pedidos.Controls.Add(Rotulo("Seus pedidos:", Negrito));
            foreach (var p in lista.Take(5))
            {
                string st = p.Status == "pago" ? "liberado" : p.Status == "recusado" ? "recusado" : "aguardando confirmação";
                pedidos.Controls.Add(Rotulo(p.Codigo + "  ·  " + p.Plano + "  ·  " + Textos.Dinheiro(p.Valor) + "  ·  " + (p.CriadoEm.HasValue ? Textos.Data(p.CriadoEm.Value) : "") + "  ·  " + st,
                    Base, p.Status == "pago" ? "ok" : p.Status == "recusado" ? "erro" : "suave"));
            }
            Tema.Aplicar(pedidos);
        }

        async Task Executar(Func<Task> a)
        {
            Cursor = Cursors.WaitCursor;
            try { await a(); }
            catch (Exception ex) { status.Text = ex is ErroNuvem ? ex.Message : "Erro: " + Motor.Mensagem(ex); status.ForeColor = P.Erro; }
            finally { Cursor = Cursors.Default; }
        }
    }

    /// <summary>
    /// Painel do administrador: Pix, preços, limites, pedidos e licenças.
    /// Só a conta de administrador consegue salvar: quem garante isso são as
    /// regras do Firestore no servidor, não este programa.
    /// </summary>
    public sealed class JanelaAdmin : Form
    {
        readonly Panel corpo = new Panel { AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink };
        readonly Label status = Rotulo("", Base, "suave", S(720));
        readonly Botao abaPix = new Botao("Pix e preços", EstiloBotao.Primario, G.Dinheiro) { Compacto = true },
            abaPedidos = new Botao("Pedidos", EstiloBotao.Secundario, G.Enviar) { Compacto = true },
            abaLicencas = new Botao("Licenças", EstiloBotao.Secundario, G.Estrela) { Compacto = true };
        ConfigApp cfg;
        Control raiz, rodape;
        public static List<Pedido> DemoPedidos;
        public static List<Licenca> DemoLicencas;

        public JanelaAdmin(int aba = 0)
        {
            JanelaPix.Configurar(this, "Painel do administrador");
            cfg = Clonar(Conta.App);
            var g = Grade(1);
            g.Controls.Add(JanelaPix.Cabecalho(G.Escudo, "Painel do administrador", "Conectado como " + (Conta.Email == "" ? "administrador" : Conta.Email) +
                ". Só esta conta consegue salvar alterações: o servidor (regras do Firestore) recusa qualquer outra.", P.Destaque));
            g.Controls.Add(Fluxo(false, abaPix, abaPedidos, abaLicencas));
            g.Controls.Add(corpo);
            g.Controls.Add(status);
            abaPix.Click += (s, e) => Aba(0);
            abaPedidos.Click += (s, e) => Aba(1);
            abaLicencas.Click += (s, e) => Aba(2);
            var fechar = new Botao("Fechar") { DialogResult = DialogResult.Cancel, Margin = Padding.Empty };
            CancelButton = fechar;
            raiz = g;
            rodape = Fluxo(false, fechar);
            Aba(aba);
            JanelaPix.Finalizar(this, g, rodape, "janela-admin");
        }

        static ConfigApp Clonar(ConfigApp c) => ConfigApp.DeDicionario(Nuvem.DeDocumento(Json.Ler(Json.Escrever(Nuvem.ParaDocumento(c.ParaFirestore()))) as Dictionary<string, object>));

        void Aba(int n)
        {
            abaPix.Estilo = n == 0 ? EstiloBotao.Primario : EstiloBotao.Secundario;
            abaPedidos.Estilo = n == 1 ? EstiloBotao.Primario : EstiloBotao.Secundario;
            abaLicencas.Estilo = n == 2 ? EstiloBotao.Primario : EstiloBotao.Secundario;
            foreach (var b in new[] { abaPix, abaPedidos, abaLicencas }) { b.Font = b.Estilo == EstiloBotao.Primario ? Negrito : Base; b.Invalidate(); }
            corpo.SuspendLayout();
            foreach (Control c in corpo.Controls.Cast<Control>().ToList()) c.Dispose();
            corpo.Controls.Clear();
            Control conteudo = n == 0 ? MontarPix() : n == 1 ? MontarLista(true) : MontarLista(false);
            conteudo.Location = new Point(0, S(8));
            corpo.Controls.Add(conteudo);
            corpo.ResumeLayout();
            Tema.Aplicar(corpo);
            if (IsHandleCreated) Encaixar(this, raiz, rodape, S(24));
        }

        Control MontarPix()
        {
            var g = Grade(2);
            int larg = S(380);
            Campo C(string texto) { var c = new Campo { Width = larg }; c.Texto = texto; return c; }
            void L(string r, Control c) { var l = Rotulo(r, Base, "suave"); l.Anchor = AnchorStyles.Left; g.Controls.Add(l); g.Controls.Add(c); }
            var chave = C(cfg.PixChave); var nome = C(cfg.PixNome); var cidade = C(cfg.PixCidade);
            var valores = C(string.Join("; ", cfg.PixValores.Select(v => v.ToString("0.##", CultureInfo.InvariantCulture).Replace('.', ','))));
            var mensagem = C(cfg.MensagemDoacao);
            var limite = new Numero { Minimo = 1, Maximo = 100, Width = S(140) };
            limite.Valor = cfg.LimiteGratis;
            var whats = C(cfg.ContatoWhatsapp); var mail = C(cfg.ContatoEmail);
            L("Chave Pix", chave); L("Nome do recebedor", nome); L("Cidade", cidade);
            L("Valores de doação (R$)", valores); L("Mensagem de doação", mensagem);
            L("Pastas na versão grátis", limite);
            var planos = new List<Tuple<Campo, Campo, Numero>>();
            for (int i = 0; i < 3; i++)
            {
                var p = i < cfg.Planos.Count ? cfg.Planos[i] : new OfertaPlano();
                var n = new Campo("Nome (vazio = não vender)") { Width = S(180) }; n.Texto = p.Nome;
                var v = new Campo("Valor") { Width = S(90) }; v.Texto = p.Valor > 0 ? p.Valor.ToString("0.00", CultureInfo.InvariantCulture).Replace('.', ',') : "";
                var m = new Numero { Minimo = 0, Maximo = 120, Width = S(120) }; m.Valor = p.Meses;
                planos.Add(Tuple.Create(n, v, m));
                L("Plano " + (i + 1) + "  (meses: 0 = vitalício)", Fluxo(false, n, v, m));
            }
            L("WhatsApp de contato", whats); L("E-mail de contato", mail);
            var qr = new QrImagem { Size = new Size(S(150), S(150)) };
            void Previa()
            {
                try { qr.Conteudo = Pix.Codigo(chave.Texto, nome.Texto, cidade.Texto, 10, "Teste", "TESTE"); }
                catch { qr.Conteudo = null; }
            }
            chave.TextChanged += (s, e) => Previa(); nome.TextChanged += (s, e) => Previa(); cidade.TextChanged += (s, e) => Previa();
            Previa();
            var salvar = new Botao("Salvar e publicar", EstiloBotao.Primario, G.Certo) { Margin = new Padding(0, S(10), 0, 0) };
            salvar.Click += async (s, e) => await Executar(async () =>
            {
                cfg.PixChave = Pix.NormalizarChave(chave.Texto); cfg.PixNome = nome.Texto.Trim(); cfg.PixCidade = cidade.Texto.Trim();
                cfg.PixValores = valores.Texto.Split(new[] { ';', ' ' }, StringSplitOptions.RemoveEmptyEntries)
                    .Select(x => double.TryParse(x.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out var d) ? d : 0).Where(d => d > 0).ToList();
                cfg.MensagemDoacao = mensagem.Texto.Trim();
                cfg.LimiteGratis = limite.Valor;
                cfg.Planos = planos.Where(p => p.Item1.Texto.Trim() != "")
                    .Select(p => new OfertaPlano
                    {
                        Nome = p.Item1.Texto.Trim(),
                        Valor = double.TryParse(p.Item2.Texto.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out var d) ? d : 0,
                        Meses = p.Item3.Valor,
                    }).Where(p => p.Valor > 0).ToList();
                cfg.ContatoWhatsapp = whats.Texto.Trim(); cfg.ContatoEmail = mail.Texto.Trim();
                if (cfg.PixChave != "") Pix.Codigo(cfg.PixChave, cfg.PixNome, cfg.PixCidade);   // valida
                await Conta.Nuvem.SalvarConfigApp(cfg, Conta.Sessao);
                Conta.App = Clonar(cfg);
                await Conta.AtualizarConfigApp();
                Conta.Avisar();
                Ok("Salvo! Todos os programas passam a usar o novo Pix e os novos preços.");
            });
            var lado = Fluxo(true, Rotulo("Prévia do QR (R$ 10)", Pequena, "suave"), qr);
            return Fluxo(false, Fluxo(true, g, salvar), lado);
        }

        Control MontarLista(bool ehPedidos)
        {
            var f = Fluxo(true);
            var atualizar = new Botao("Atualizar", EstiloBotao.Secundario, G.Atualizar) { Compacto = true, Margin = new Padding(0, 0, 0, S(8)) };
            f.Controls.Add(atualizar);
            var linhas = Fluxo(true);
            f.Controls.Add(linhas);
            async Task Carregar()
            {
                linhas.Controls.Clear();
                if (ehPedidos)
                {
                    var lista = DemoPedidos ?? await Conta.Nuvem.ListarPedidos(Conta.Sessao, true);
                    if (lista.Count == 0) linhas.Controls.Add(Rotulo("Nenhum pedido ainda.", Base, "suave"));
                    foreach (var p in lista.Take(60)) linhas.Controls.Add(LinhaPedido(p, Carregar));
                }
                else
                {
                    var lista = DemoLicencas ?? await Conta.Nuvem.ListarLicencas(Conta.Sessao);
                    if (lista.Count == 0) linhas.Controls.Add(Rotulo("Nenhuma licença ainda. Elas aparecem quando você libera um pedido.", Base, "suave"));
                    foreach (var l in lista.Take(100)) linhas.Controls.Add(LinhaLicenca(l, Carregar));
                }
                Tema.Aplicar(linhas);
                if (IsHandleCreated) Encaixar(this, raiz, rodape, S(24));
            }
            atualizar.Click += async (s, e) => await Executar(Carregar);
            Shown2(async () => await Executar(Carregar));
            return f;
        }

        void Shown2(Action a)
        {
            if (DemoPedidos != null) a();               // modo de teste: dados de exemplo, sem internet
            else if (IsHandleCreated) BeginInvoke(a);
            else Shown += (s, e) => a();
        }

        Control LinhaPedido(Pedido p, Func<Task> recarregar)
        {
            var c = new Cartao { Width = S(720), Height = S(64), Faixa = p.Status == "pago" ? P.Ok : p.Status == "recusado" ? P.Erro : P.Aviso, Margin = new Padding(0, 0, 0, S(8)) };
            var t1 = Rotulo(p.Email + "   ·   " + p.Plano + "   ·   " + Textos.Dinheiro(p.Valor), Negrito);
            t1.Location = new Point(S(16), S(10));
            var t2 = Rotulo("Código " + p.Codigo + "  ·  " + (p.CriadoEm.HasValue ? Textos.DataAmigavel(p.CriadoEm) : "") + "  ·  " +
                (p.Status == "pago" ? "liberado" : p.Status == "recusado" ? "recusado" : "aguardando confirmação"), Pequena, "suave");
            t2.Location = new Point(S(16), S(34));
            c.Controls.Add(t1); c.Controls.Add(t2);
            if (p.Status == "aguardando")
            {
                var liberar = new Botao("Liberar Pro", EstiloBotao.Pro, G.Certo) { Compacto = true, AutoSize = false };
                var recusar = new Botao("Recusar", EstiloBotao.Perigo) { Compacto = true, AutoSize = false };
                liberar.Size = liberar.GetPreferredSize(Size.Empty); recusar.Size = recusar.GetPreferredSize(Size.Empty);
                recusar.Location = new Point(c.Width - recusar.Width - S(14), S(17));
                liberar.Location = new Point(recusar.Left - liberar.Width - S(8), S(17));
                c.Controls.Add(liberar); c.Controls.Add(recusar);
                liberar.Click += async (s, e) => await Executar(async () =>
                {
                    if (MessageBox.Show(this, "Você conferiu no app do banco que o Pix de " + Textos.Dinheiro(p.Valor) + " (código " + p.Codigo + ") caiu?\n\nLiberar o Pro para " + p.Email + "?",
                        "Liberar Pro", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
                    var atuais = await Conta.Nuvem.ListarLicencas(Conta.Sessao);
                    var lic = atuais.FirstOrDefault(x => x.Uid == p.Uid) ?? new Licenca { Uid = p.Uid, Email = p.Email };
                    lic.Plano = "pro";
                    lic.Email = p.Email;
                    if (p.Meses == 0) lic.ValidoAte = null;
                    else if (lic.ValidoAte != null || !lic.Valida(DateTime.Now))
                    {
                        var baseData = lic.Valida(DateTime.Now) && lic.ValidoAte != null ? lic.ValidoAte.Value : DateTime.Now;
                        lic.ValidoAte = baseData.AddMonths(p.Meses);
                    }
                    lic.Observacao = "Pedido " + p.Codigo;
                    await Conta.Nuvem.SalvarLicenca(lic, Conta.Sessao);
                    await Conta.Nuvem.MudarStatusPedido(p, "pago", Conta.Sessao);
                    Ok("Pro liberado para " + p.Email + (lic.ValidoAte == null ? " (sem vencimento)." : " até " + Textos.Data(lic.ValidoAte.Value) + "."));
                    await recarregar();
                });
                recusar.Click += async (s, e) => await Executar(async () =>
                {
                    if (MessageBox.Show(this, "Recusar o pedido " + p.Codigo + "?", "Recusar", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
                    await Conta.Nuvem.MudarStatusPedido(p, "recusado", Conta.Sessao);
                    await recarregar();
                });
            }
            return c;
        }

        Control LinhaLicenca(Licenca l, Func<Task> recarregar)
        {
            bool valida = l.Valida(DateTime.Now);
            var c = new Cartao { Width = S(720), Height = S(64), Faixa = valida ? P.Pro : P.Pausado, Margin = new Padding(0, 0, 0, S(8)) };
            var t1 = Rotulo(l.Email == "" ? l.Uid : l.Email, Negrito);
            t1.Location = new Point(S(16), S(10));
            string val = l.Plano != "pro" ? "revogada" : l.ValidoAte == null ? "Pro sem vencimento" : (valida ? "Pro até " : "venceu em ") + Textos.Data(l.ValidoAte.Value);
            var t2 = Rotulo(val + (l.Observacao != "" ? "  ·  " + l.Observacao : ""), Pequena, valida ? "pro" : "suave");
            t2.Location = new Point(S(16), S(34));
            c.Controls.Add(t1); c.Controls.Add(t2);
            int x = c.Width - S(14);
            void Acao(string texto, EstiloBotao estilo, Action<Licenca> mudar)
            {
                var b = new Botao(texto, estilo) { Compacto = true, AutoSize = false };
                b.Size = b.GetPreferredSize(Size.Empty);
                x -= b.Width;
                b.Location = new Point(x, S(17));
                x -= S(6);
                c.Controls.Add(b);
                b.Click += async (s, e) => await Executar(async () =>
                {
                    mudar(l);
                    await Conta.Nuvem.SalvarLicenca(l, Conta.Sessao);
                    Ok("Licença de " + l.Email + " atualizada.");
                    await recarregar();
                });
            }
            Acao("Revogar", EstiloBotao.Perigo, x2 => x2.Plano = "revogado");
            Acao("Vitalícia", EstiloBotao.Secundario, x2 => { x2.Plano = "pro"; x2.ValidoAte = null; });
            Acao("+1 ano", EstiloBotao.Secundario, x2 => { x2.Plano = "pro"; x2.ValidoAte = (x2.Valida(DateTime.Now) && x2.ValidoAte != null ? x2.ValidoAte.Value : DateTime.Now).AddYears(1); });
            Acao("+1 mês", EstiloBotao.Secundario, x2 => { x2.Plano = "pro"; x2.ValidoAte = (x2.Valida(DateTime.Now) && x2.ValidoAte != null ? x2.ValidoAte.Value : DateTime.Now).AddMonths(1); });
            return c;
        }

        void Ok(string texto) { status.Text = texto; status.ForeColor = P.Ok; }

        async Task Executar(Func<Task> a)
        {
            if (Programa.ModoCaptura && DemoPedidos == null) return;
            Cursor = Cursors.WaitCursor;
            status.Text = "Aguarde...";
            status.ForeColor = P.TextoSuave;
            try { await a(); if (status.Text == "Aguarde...") status.Text = ""; }
            catch (Exception ex) { status.Text = ex is ErroNuvem ? ex.Message : "Erro: " + Motor.Mensagem(ex); status.ForeColor = P.Erro; }
            finally { Cursor = Cursors.Default; }
        }
    }
}
