using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Linq;
using System.Windows.Forms;
using BackupAutomatico.Nucleo;
using static BackupAutomatico.Interface.Tema;

namespace BackupAutomatico.Interface
{
    public sealed class JanelaPrincipal : Form
    {
        public readonly Configuracao Cfg;
        public readonly Agendador Ag;
        readonly Panel cabecalho = new Panel { Dock = DockStyle.Top };
        readonly FlowLayoutPanel acoes = new FlowLayoutPanel { Dock = DockStyle.Right, FlowDirection = FlowDirection.RightToLeft, WrapContents = false, AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink };
        readonly Panel lista = new Panel { Dock = DockStyle.Fill, AutoScroll = true, Tag = "fundo" };
        readonly Panel rodape = new Panel { Dock = DockStyle.Bottom };
        readonly ZonaVazia vazia;
        readonly Botao btnAdicionar, btnTema, btnConfig, btnConta, btnApoiar, btnPro, btnAdmin;
        readonly ToolTip dicas = new ToolTip();
        readonly List<CartaoBackup> cartoes = new List<CartaoBackup>();
        readonly NotifyIcon bandeja = new NotifyIcon();
        readonly ContextMenuStrip menuBandeja;
        readonly ToolStripMenuItem miPausarTodos;
        readonly Timer relogio = new Timer { Interval = 1000 };
        readonly Timer animacao = new Timer { Interval = 140 };
        readonly Icon[] quadros;
        readonly Icon iconeNormal, iconeErro, iconeAviso, iconePausa;
        int quadro, tiques;
        string textoStatus = "";
        Color corStatus;
        bool saindo, avisoBandeja;
        public bool ModoCaptura;

        public JanelaPrincipal(Configuracao cfg)
        {
            Cfg = cfg;
            Text = "Backup Automático";
            Font = Base;
            AutoScaleMode = AutoScaleMode.None;
            Icon = Tema.Icone("app.ico", 32);
            StartPosition = FormStartPosition.CenterScreen;
            var area = Screen.PrimaryScreen.WorkingArea;
            Size = new Size(Math.Min(S(1080), (int)(area.Width * 0.95)), Math.Min(S(700), (int)(area.Height * 0.92)));
            MinimumSize = new Size(Math.Min(S(840), area.Width), Math.Min(S(520), area.Height));
            Ag = new Agendador(cfg, this);

            // Cabeçalho
            cabecalho.Height = S(84);
            cabecalho.Paint += PintarCabecalho;
            acoes.Padding = new Padding(0, S(24), S(20), 0);
            btnAdicionar = new Botao("Adicionar pasta", EstiloBotao.Primario, G.Adicionar) { Margin = new Padding(S(8), 0, 0, 0) };
            btnConfig = new Botao("", EstiloBotao.Fantasma, G.Config) { SoIcone = true, Margin = new Padding(S(4), 0, 0, 0) };
            btnTema = new Botao("", EstiloBotao.Fantasma, G.Lua) { SoIcone = true, Margin = new Padding(S(4), 0, 0, 0) };
            btnAdmin = new Botao("Administrador", EstiloBotao.Secundario, G.Escudo) { Margin = new Padding(S(8), 0, 0, 0) };
            btnPro = new Botao("Seja Pro", EstiloBotao.Pro, G.Estrela) { Margin = new Padding(S(8), 0, 0, 0) };
            btnApoiar = new Botao("Apoiar", EstiloBotao.Fantasma, G.Coracao) { Margin = new Padding(S(4), 0, 0, 0) };
            btnConta = new Botao("Entrar", EstiloBotao.Fantasma, G.Pessoa) { Margin = new Padding(S(4), 0, 0, 0) };
            acoes.Controls.AddRange(new Control[] { btnAdicionar, btnConfig, btnTema, btnAdmin, btnPro, btnApoiar, btnConta });
            cabecalho.Controls.Add(acoes);
            dicas.SetToolTip(btnConfig, "Configurações");
            dicas.SetToolTip(btnTema, "Alternar tema claro/escuro");
            dicas.SetToolTip(btnApoiar, "Apoie o projeto com um Pix");

            // Rodapé
            rodape.Height = S(40);
            rodape.Paint += PintarRodape;
            rodape.Cursor = Cursors.Default;
            rodape.MouseClick += (s, e) => { if (e.X > rodape.Width / 2 && Conta.Plano == Plano.Gratis) AbrirPro(); };

            vazia = new ZonaVazia { Dock = DockStyle.Fill };
            vazia.Adicionar.Click += (s, e) => EscolherEAdicionar();
            lista.Padding = new Padding(S(20), S(4), S(20), S(12));
            lista.Resize += (s, e) => PosicionarCartoes();

            Controls.Add(lista);
            Controls.Add(vazia);
            Controls.Add(rodape);
            Controls.Add(cabecalho);

            btnAdicionar.Click += (s, e) => EscolherEAdicionar();
            btnTema.Click += (s, e) => { Cfg.Tema = P.Escuro ? "claro" : "escuro"; Salvar(); Tema.Definir(Cfg.Tema); };
            btnConfig.Click += (s, e) => Protegido(() => new JanelaConfiguracoes(this).ShowDialog(this));
            btnConta.Click += (s, e) => Protegido(() => new JanelaConta().ShowDialog(this));
            btnApoiar.Click += (s, e) => Protegido(() => JanelaPix.Doacao().ShowDialog(this));
            btnPro.Click += (s, e) => AbrirPro();
            btnAdmin.Click += (s, e) => Protegido(() => new JanelaAdmin().ShowDialog(this));

            // Ícone perto do relógio
            iconeNormal = Tema.Icone("bandeja.ico", SystemInformation.SmallIconSize.Width);
            iconeErro = Tema.Icone("bandeja-erro.ico", SystemInformation.SmallIconSize.Width);
            iconeAviso = Tema.Icone("bandeja-aviso.ico", SystemInformation.SmallIconSize.Width);
            iconePausa = Tema.Icone("bandeja-pausa.ico", SystemInformation.SmallIconSize.Width);
            quadros = Enumerable.Range(0, 8).Select(i => Tema.Icone("bandeja-copiando-" + i + ".ico", SystemInformation.SmallIconSize.Width)).ToArray();
            bandeja.Icon = iconeNormal;
            bandeja.Text = "Backup Automático";
            menuBandeja = MenuTema.Criar();
            var abrir = MenuTema.Item(menuBandeja, "Abrir o Backup Automático", MostrarJanela);
            abrir.Font = Negrito;
            MenuTema.Item(menuBandeja, "Fazer backup de tudo agora", () => Ag.PedirTodos());
            miPausarTodos = MenuTema.Item(menuBandeja, "Pausar todos os backups", () => { Cfg.PausaGeral = !Cfg.PausaGeral; Salvar(); Atualizar(); });
            menuBandeja.Items.Add(new ToolStripSeparator());
            MenuTema.Item(menuBandeja, "Sair", Sair);
            bandeja.ContextMenuStrip = menuBandeja;
            bandeja.MouseClick += (s, e) => { if (e.Button == MouseButtons.Left) MostrarJanela(); };
            bandeja.BalloonTipClicked += (s, e) => MostrarJanela();

            animacao.Tick += (s, e) => { quadro = (quadro + 1) % quadros.Length; bandeja.Icon = quadros[quadro]; };
            relogio.Tick += (s, e) => Protegido(Ciclo, false);
            Ag.Mudou += Atualizar;
            Ag.Concluiu += Notificar;
            Conta.Mudou += () => { if (IsHandleCreated) BeginInvoke(new Action(Atualizar)); };
            Tema.Mudou += () => { MenuTema.Atualizar(menuBandeja); Atualizar(); };

            HabilitarSoltar(this);
            Tema.Aplicar(this);
            Atualizar();
        }

        // ---------------- Ciclo e estado ----------------

        public void Iniciar(bool escondido)
        {
            bandeja.Visible = !ModoCaptura;
            relogio.Start();
            if (escondido) Ag.LiberadoEm = DateTime.Now.AddSeconds(90);   // dá tempo de discos e nuvens conectarem
        }

        void Ciclo()
        {
            tiques++;
            if (Ag.Atual != null && Visible)
            {
                foreach (var c in cartoes) if (Ag.Executando(c.Trabalho)) c.Atualizar();
                AtualizarStatus();
            }
            if (tiques % 5 == 0) Ag.Verificar();
            if (tiques % 30 == 0 && Visible) Atualizar();
            if (tiques % (60 * 60 * 6) == 0) _ = Conta.AtualizarLicenca();
        }

        public void Salvar()
        {
            try { Cfg.Salvar(); }
            catch (Exception ex) { Caminhos.LogErro("Salvar: " + ex.Message); Mensagem("Não consegui salvar as configurações:\n\n" + ex.Message, MessageBoxIcon.Error); }
        }

        public void Atualizar()
        {
            if (IsDisposed) return;
            // Cabeçalho conforme o plano
            btnTema.Icone = P.Escuro ? G.Sol : G.Lua;
            btnConta.Text = Conta.Logado ? Abreviar(Conta.Email, 26) : "Entrar";
            btnPro.Visible = Conta.Plano == Plano.Gratis;
            btnAdmin.Visible = Conta.Plano == Plano.Admin;
            acoes.PerformLayout();
            cabecalho.Invalidate();
            miPausarTodos.Checked = Cfg.PausaGeral;

            // Cartões
            lista.SuspendLayout();
            var ids = Cfg.Trabalhos.Select(t => t.Id).ToList();
            foreach (var c in cartoes.Where(c => !ids.Contains(c.Trabalho.Id)).ToList()) { cartoes.Remove(c); lista.Controls.Remove(c); c.Dispose(); }
            foreach (var t in Cfg.Trabalhos)
            {
                var c = cartoes.FirstOrDefault(x => x.Trabalho.Id == t.Id);
                if (c == null)
                {
                    c = new CartaoBackup(t, this);
                    cartoes.Add(c);
                    lista.Controls.Add(c);
                }
                c.Trabalho = t;
                c.Atualizar();
            }
            cartoes.Sort((a, b) => Cfg.Trabalhos.IndexOf(a.Trabalho).CompareTo(Cfg.Trabalhos.IndexOf(b.Trabalho)));
            PosicionarCartoes();
            lista.ResumeLayout();
            bool vazio = Cfg.Trabalhos.Count == 0;
            vazia.Visible = vazio;
            lista.Visible = !vazio;
            AtualizarStatus();
            AtualizarBandeja();
        }

        void PosicionarCartoes()
        {
            int y = lista.Padding.Top - lista.VerticalScroll.Value;
            int largura = lista.ClientSize.Width - lista.Padding.Horizontal;
            foreach (var c in cartoes)
            {
                c.SetBounds(lista.Padding.Left, y, Math.Max(S(400), largura), c.AlturaIdeal);
                y += c.Height + S(12);
            }
        }

        void AtualizarStatus()
        {
            string texto;
            Color cor = P.Ok;
            if (Ag.Atual != null)
            {
                texto = "Fazendo backup de \"" + Ag.Atual.Nome + "\": " + CartaoBackup.TextoProgresso(Ag.Atual);
                cor = P.Destaque;
            }
            else if (Cfg.Trabalhos.Count == 0) { texto = "Nenhuma pasta vinculada ainda."; cor = P.TextoFraco; }
            else if (Cfg.PausaGeral) { texto = "Todos os backups automáticos estão pausados (menu do ícone perto do relógio)."; cor = P.Pausado; }
            else
            {
                var erro = Cfg.Trabalhos.FirstOrDefault(t => t.Ativo && t.UltimoStatus == "erro");
                var esperando = Cfg.Trabalhos.FirstOrDefault(t => t.Ativo && t.UltimoStatus == "indisponivel");
                var ativos = Cfg.Trabalhos.Where(t => t.Ativo && Ag.Permitido(t)).ToList();
                if (erro != null) { texto = "Atenção: o backup \"" + erro.Nome + "\" teve um problema."; cor = P.Erro; }
                else if (esperando != null) { texto = "\"" + esperando.Nome + "\" está esperando a pasta ou o disco ficar disponível."; cor = P.Aviso; }
                else if (ativos.Count == 0) { texto = "Todos os backups estão pausados."; cor = P.Pausado; }
                else
                {
                    var prox = ativos.OrderBy(Agenda.Proxima).First();
                    texto = "Tudo certo. Próximo backup: \"" + prox.Nome + "\", " + CartaoBackup.TextoProximo(prox, Ag).ToLowerInvariant() + ".";
                }
            }
            if (texto != textoStatus || cor != corStatus) { textoStatus = texto; corStatus = cor; rodape.Invalidate(); }
        }

        void AtualizarBandeja()
        {
            string dica;
            if (Ag.Atual != null)
            {
                if (!animacao.Enabled) animacao.Start();
                dica = "Copiando \"" + Ag.Atual.Nome + "\"";
            }
            else
            {
                animacao.Stop();
                if (Cfg.Trabalhos.Any(t => t.Ativo && t.UltimoStatus == "erro")) { bandeja.Icon = iconeErro; dica = "Atenção: um backup teve problema"; }
                else if (Cfg.Trabalhos.Any(t => t.Ativo && (t.UltimoStatus == "indisponivel" || t.UltimoStatus == "parcial"))) { bandeja.Icon = iconeAviso; dica = "Um backup está aguardando"; }
                else if (Cfg.PausaGeral || (Cfg.Trabalhos.Count > 0 && Cfg.Trabalhos.All(t => !t.Ativo))) { bandeja.Icon = iconePausa; dica = "Backups pausados"; }
                else { bandeja.Icon = iconeNormal; dica = "Tudo certo"; }
            }
            string t2 = "Backup Automático - " + dica;
            bandeja.Text = t2.Length > 63 ? t2.Substring(0, 60) + "..." : t2;
        }

        void Notificar(Trabalho t, Resultado r, Agendador.Execucao e, string anterior)
        {
            if (!Cfg.Notificacoes) return;
            string titulo = "\"" + t.Nome + "\"";
            switch (r.Status)
            {
                case "erro": if (anterior != "erro" || e.Manual) Balao("Problema no backup " + titulo, r.Mensagem, ToolTipIcon.Error); break;
                case "parcial": Balao("Backup " + titulo + " com avisos", r.Mensagem, ToolTipIcon.Warning); break;
                case "indisponivel": if (e.Manual || anterior != "indisponivel") Balao("Backup " + titulo + " adiado", r.Mensagem, ToolTipIcon.Warning); break;
                case "ok": if (r.Copiados > 0 || e.Manual) Balao("Backup " + titulo + " concluído", r.Mensagem, ToolTipIcon.Info); break;
            }
        }

        public void Balao(string titulo, string texto, ToolTipIcon tipo = ToolTipIcon.Info)
        {
            if (ModoCaptura) return;
            if (texto.Length > 250) texto = texto.Substring(0, 247) + "...";
            if (titulo.Length > 60) titulo = titulo.Substring(0, 57) + "...";
            try { bandeja.ShowBalloonTip(8000, titulo, texto, tipo); } catch { }
        }

        // ---------------- Desenho do cabeçalho e rodapé ----------------

        void PintarCabecalho(object s, PaintEventArgs e)
        {
            var g = e.Graphics;
            g.Clear(P.Fundo);
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            int x = S(22), tam = S(44);
            g.DrawImage(Tema.Logo, new Rectangle(x, (cabecalho.Height - tam) / 2, tam, tam));
            x += tam + S(14);
            var tt = TextRenderer.MeasureText("Backup Automático", Titulo);
            Tema.Texto(g, "Backup Automático", Titulo, new Rectangle(x, S(14), tt.Width + 4, S(32)), P.Texto);
            string plano = Conta.NomePlano(Conta.Plano);
            Color cor = Conta.Plano == Plano.Admin ? P.Destaque : Conta.Plano == Plano.Pro ? P.Pro : P.TextoSuave;
            Color fundo = Conta.Plano == Plano.Admin ? P.DestaqueSuave : Conta.Plano == Plano.Pro ? P.ProSuave : P.Hover;
            Pilula.Desenhar(g, plano, Pequena, new Point(x + tt.Width + S(6), S(20)), cor, fundo, false);
            Tema.Texto(g, "Arraste uma pasta para esta janela e ela passa a ter backup automático.", Base, new Rectangle(x, S(46), S(600), S(22)), P.TextoSuave, TextFormatFlags.EndEllipsis);
        }

        void PintarRodape(object s, PaintEventArgs e)
        {
            var g = e.Graphics;
            g.Clear(P.Fundo);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            using (var pen = new Pen(P.Borda)) g.DrawLine(pen, 0, 0, rodape.Width, 0);
            using (var b = new SolidBrush(corStatus)) g.FillEllipse(b, S(22), rodape.Height / 2 - S(4), S(8), S(8));
            string direita;
            int limite = Recursos.LimitePastas(Conta.Plano, Conta.App);
            if (Conta.Plano == Plano.Gratis)
                direita = "Plano grátis: " + Cfg.Trabalhos.Count + " de " + limite + " pasta" + (limite == 1 ? "" : "s") + "  ·  Conheça o Pro";
            else direita = "Plano " + Conta.NomePlano(Conta.Plano) + (Conta.Licenca?.ValidoAte != null ? " até " + Textos.Data(Conta.Licenca.ValidoAte.Value) : "") + (Conta.Online ? "" : "  ·  sem internet");
            var td = TextRenderer.MeasureText(direita, Pequena);
            Tema.Texto(g, direita, Pequena, new Rectangle(rodape.Width - td.Width - S(22), 0, td.Width + 4, rodape.Height),
                Conta.Plano == Plano.Gratis ? P.Pro : P.TextoSuave);
            Tema.Texto(g, textoStatus, Base, new Rectangle(S(38), 0, rodape.Width - td.Width - S(80), rodape.Height), P.TextoSuave, TextFormatFlags.EndEllipsis);
        }

        static string Abreviar(string s, int max) => s.Length <= max ? s : s.Substring(0, max - 1) + "…";

        // ---------------- Ações ----------------

        public void AbrirPro()
        {
            Protegido(() =>
            {
                if (!Conta.Logado)
                {
                    Mensagem("Para assinar o Pro, entre com sua conta (ou crie uma). Leva menos de um minuto.");
                    new JanelaConta().ShowDialog(this);
                    if (!Conta.Logado) return;
                }
                new JanelaPro().ShowDialog(this);
            });
        }

        void EscolherEAdicionar()
        {
            Protegido(() =>
            {
                using (var fb = new FolderBrowserDialog { Description = "Escolha a pasta que você quer proteger com backup:", ShowNewFolderButton = true })
                    if (fb.ShowDialog(this) == DialogResult.OK) AdicionarPasta(fb.SelectedPath);
            });
        }

        public void AdicionarPasta(string caminho)
        {
            string c = Caminhos.Normalizar(caminho);
            if (c == "") return;
            MostrarJanela();
            if (!Directory.Exists(c))
            {
                if (File.Exists(c)) Mensagem("\"" + Path.GetFileName(c) + "\" é um arquivo.\n\nArraste uma PASTA: o programa faz backup de tudo o que estiver dentro dela.", MessageBoxIcon.Warning);
                else Mensagem("Não encontrei a pasta:\n\n" + c, MessageBoxIcon.Warning);
                return;
            }
            var existente = Cfg.Trabalhos.FirstOrDefault(t => string.Equals(Caminhos.Normalizar(t.Origem), c, StringComparison.OrdinalIgnoreCase));
            if (existente != null)
            {
                if (Pergunta("Esta pasta já tem backup (\"" + existente.Nome + "\").\n\nQuer abrir as configurações dele?")) Editar(existente);
                return;
            }
            int limite = Recursos.LimitePastas(Conta.Plano, Conta.App);
            if (Cfg.Trabalhos.Count >= limite)
            {
                if (Pergunta("O plano grátis permite " + limite + " pasta" + (limite == 1 ? "" : "s") + " com backup automático.\n\nQuer conhecer o Pro (pastas ilimitadas)?")) AbrirPro();
                return;
            }
            var janela = new JanelaBackup(null, c);
            if (janela.ShowDialog(this) != DialogResult.OK) return;
            var novo = janela.Resultado;
            Cfg.Trabalhos.Add(novo);
            Salvar();
            if (janela.FazerAgora) Ag.PedirAgora(novo);
            Atualizar();
        }

        public void Editar(Trabalho t)
        {
            var janela = new JanelaBackup(t, null);
            if (janela.ShowDialog(this) != DialogResult.OK) return;
            var r = janela.Resultado;
            bool origemMudou = !string.Equals(Caminhos.Normalizar(t.Origem), Caminhos.Normalizar(r.Origem), StringComparison.OrdinalIgnoreCase);
            t.Nome = r.Nome; t.Origem = r.Origem; t.DestinoBase = r.DestinoBase; t.CriarSubpasta = r.CriarSubpasta; t.Modo = r.Modo;
            t.IntervaloValor = r.IntervaloValor; t.IntervaloUnidade = r.IntervaloUnidade; t.Inicio = r.Inicio; t.Ativo = r.Ativo;
            t.IgnorarExistentes = r.IgnorarExistentes; t.Exclusoes = r.Exclusoes;
            if (origemMudou || !t.IgnorarExistentes)
            {
                t.BaseRegistradaEm = null;
                try { File.Delete(Caminhos.ArquivoBase(t.Id)); } catch { }
            }
            t.AguardarAte = null;
            if (t.UltimoStatus == "indisponivel" || t.UltimoStatus == "erro") { t.UltimoStatus = null; t.UltimoResumo = ""; }
            Salvar();
            Ag.LiberadoEm = DateTime.Now;
            Atualizar();
        }

        public void Remover(Trabalho t)
        {
            if (!Pergunta("Remover o backup \"" + t.Nome + "\"?\n\nO programa deixa de copiar esta pasta. Nada é apagado: os arquivos que já estão no backup continuam lá.")) return;
            if (Ag.Executando(t)) Ag.Cancelar();
            Ag.Fila.Remove(t.Id);
            Cfg.Trabalhos.Remove(t);
            foreach (string a in new[] { Caminhos.ArquivoBase(t.Id), Caminhos.ArquivoHistorico(t.Id) }) try { File.Delete(a); } catch { }
            Salvar();
            Atualizar();
        }

        public void FazerAgora(Trabalho t)
        {
            if (Ag.Executando(t))
            {
                if (Pergunta("Cancelar o backup de \"" + t.Nome + "\" que está em andamento?\n\nO que já foi copiado fica no backup; o resto será copiado mais tarde.")) Ag.Cancelar();
                return;
            }
            if (!Ag.Permitido(t))
            {
                if (Pergunta("Este backup passou do limite do plano grátis.\n\nQuer conhecer o Pro (pastas ilimitadas)?")) AbrirPro();
                return;
            }
            Ag.PedirAgora(t);
        }

        public void AlternarPausa(Trabalho t)
        {
            t.Ativo = !t.Ativo;
            Salvar();
            Ag.LiberadoEm = DateTime.Now;
            Atualizar();
        }

        public void AbrirPasta(string caminho)
        {
            if (!string.IsNullOrEmpty(caminho) && Directory.Exists(caminho)) Process.Start("explorer.exe", "\"" + caminho + "\"");
            else Mensagem("Esta pasta não existe ou não está acessível agora:\n\n" + caminho + "\n\n(Ela é criada no primeiro backup.)", MessageBoxIcon.Warning);
        }

        public void VerHistorico(Trabalho t) => new JanelaHistorico(t).ShowDialog(this);

        // ---------------- Janela, bandeja, arrastar e soltar ----------------

        public void MostrarJanela()
        {
            if (!Visible) Show();
            if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
            TopMost = true; TopMost = false;
            Activate();
            try { Nativo.SetForegroundWindow(Handle); } catch { }
            Atualizar();
        }

        void HabilitarSoltar(Control c)
        {
            if (!(c is TextBox))
            {
                c.AllowDrop = true;
                c.DragEnter += (s, e) => { if (e.Data.GetDataPresent(DataFormats.FileDrop)) { e.Effect = DragDropEffects.Copy; vazia.Destacar(true); } };
                c.DragLeave += (s, e) => vazia.Destacar(false);
                c.DragDrop += (s, e) =>
                {
                    vazia.Destacar(false);
                    if (e.Data.GetData(DataFormats.FileDrop) is string[] itens)
                        // Abre a configuração só depois que o Windows terminar de "soltar"
                        // (senão o Explorador de Arquivos fica travado esperando).
                        BeginInvoke(new Action(() => { foreach (var p in itens) Protegido(() => AdicionarPasta(p)); }));
                };
            }
            foreach (Control f in c.Controls) HabilitarSoltar(f);
            c.ControlAdded += (s, e) => HabilitarSoltar(e.Control);
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            Nativo.TituloEscuro(Handle, P.Escuro);
            Nativo.TemaRolagem(lista.Handle, P.Escuro);
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (!saindo && e.CloseReason == CloseReason.UserClosing && !ModoCaptura)
            {
                // Fechar no X só esconde: o programa continua cuidando dos backups.
                e.Cancel = true;
                Hide();
                if (!avisoBandeja)
                {
                    avisoBandeja = true;
                    try { bandeja.ShowBalloonTip(6000, "O Backup Automático continua ligado", "Ele fica aqui, perto do relógio, e faz os backups na hora certa. Clique no ícone para abrir.", ToolTipIcon.Info); } catch { }
                }
                return;
            }
            base.OnFormClosing(e);
        }

        public void Sair()
        {
            string msg = Ag.Atual != null
                ? "Há um backup em andamento (\"" + Ag.Atual.Nome + "\").\n\nSe sair agora ele é interrompido e continua numa próxima vez. Sair mesmo assim?"
                : "Se sair, os backups automáticos ficam parados até você abrir o programa de novo" + (Cfg.IniciarComWindows ? " (ou ligar o computador)" : "") + ".\n\nSair mesmo assim?";
            if (!Pergunta(msg)) return;
            Encerrar();
        }

        public void Encerrar()
        {
            saindo = true;
            relogio.Stop();
            animacao.Stop();
            Ag.Cancelar();
            bandeja.Visible = false;
            bandeja.Dispose();
            Close();
            Application.ExitThread();
        }

        // ---------------- Mensagens ----------------

        public void Mensagem(string texto, MessageBoxIcon icone = MessageBoxIcon.Information)
        {
            if (ModoCaptura) { Console.WriteLine("[mensagem] " + texto); return; }
            if (Visible) MessageBox.Show(this, texto, "Backup Automático", MessageBoxButtons.OK, icone);
            else MessageBox.Show(texto, "Backup Automático", MessageBoxButtons.OK, icone);
        }

        public bool Pergunta(string texto, MessageBoxIcon icone = MessageBoxIcon.Question)
        {
            if (ModoCaptura) return true;
            var r = Visible ? MessageBox.Show(this, texto, "Backup Automático", MessageBoxButtons.YesNo, icone)
                            : MessageBox.Show(texto, "Backup Automático", MessageBoxButtons.YesNo, icone);
            return r == DialogResult.Yes;
        }

        public void Protegido(Action acao, bool mostrar = true)
        {
            try { acao(); }
            catch (Exception ex)
            {
                Caminhos.LogErro("Ação: " + ex);
                if (mostrar) Mensagem("Algo deu errado:\n\n" + Motor.Mensagem(ex), MessageBoxIcon.Error);
            }
        }
    }

    /// <summary>Cartão de um backup na lista.</summary>
    public sealed class CartaoBackup : Control, ITemavel
    {
        public Trabalho Trabalho;
        readonly JanelaPrincipal j;
        readonly Botao agora, pausar, editar, mais;
        readonly ToolTip dicas = new ToolTip();
        string sit = "", linha2 = "", linha3 = "", linha4 = "";
        Color corSit, fundoSit, corLinha4;
        bool rodando;
        double fracao;

        public int AlturaIdeal => S(138);

        public CartaoBackup(Trabalho t, JanelaPrincipal janela)
        {
            Trabalho = t;
            j = janela;
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            agora = new Botao("Fazer backup agora", EstiloBotao.Secundario, G.Play) { Compacto = true, Margin = Padding.Empty };
            pausar = new Botao("", EstiloBotao.Fantasma, G.Pausa) { SoIcone = true, Compacto = true, Margin = Padding.Empty };
            editar = new Botao("", EstiloBotao.Fantasma, G.Editar) { SoIcone = true, Compacto = true, Margin = Padding.Empty };
            mais = new Botao("", EstiloBotao.Fantasma, G.Mais) { SoIcone = true, Compacto = true, Margin = Padding.Empty };
            Controls.AddRange(new Control[] { agora, pausar, editar, mais });
            dicas.SetToolTip(editar, "Editar");
            dicas.SetToolTip(mais, "Mais opções");
            agora.Click += (s, e) => j.Protegido(() => j.FazerAgora(Trabalho));
            pausar.Click += (s, e) => j.Protegido(() => j.AlternarPausa(Trabalho));
            editar.Click += (s, e) => j.Protegido(() => j.Editar(Trabalho));
            mais.Click += (s, e) => MostrarMenu();
            DoubleClick += (s, e) => j.Protegido(() => j.Editar(Trabalho));
        }

        void MostrarMenu()
        {
            var m = MenuTema.Criar();
            MenuTema.Item(m, "Abrir a pasta de origem", () => j.AbrirPasta(Trabalho.Origem));
            MenuTema.Item(m, "Abrir a pasta de backup", () => j.AbrirPasta(Trabalho.DestinoFinal));
            MenuTema.Item(m, "Ver histórico", () => j.VerHistorico(Trabalho));
            m.Items.Add(new ToolStripSeparator());
            MenuTema.Item(m, "Remover (desvincular)", () => j.Protegido(() => j.Remover(Trabalho)), true);
            m.Show(mais, new Point(mais.Width - m.PreferredSize.Width, mais.Height + S(2)));
        }

        public void AplicarTema() { Atualizar(); }

        public static string TextoProgresso(Agendador.Execucao e)
        {
            var p = e.Progresso;
            if (e.Tipo == "base") return "Anotando os arquivos que já existem... " + Textos.Numero(p.Lidos);
            if (p.Cancelar) return "Cancelando...";
            switch (p.Fase)
            {
                case "Lendo a pasta de origem": return "Lendo a pasta... " + Textos.Plural(p.Lidos, "arquivo", "arquivos");
                case "Comparando com o backup": return "Comparando com o backup...";
                case "Copiando":
                    if (p.Total == 0) return "Conferindo...";
                    return "Copiando " + Textos.Numero(p.Feitos) + " de " + Textos.Numero(p.Total) + "  ·  " + (int)(p.Fracao * 100) + "%"
                        + (p.BytesTotal > 0 ? "  ·  " + Textos.Tamanho(p.BytesFeitos) + " de " + Textos.Tamanho(p.BytesTotal) : "");
            }
            return "Preparando...";
        }

        public static string TextoProximo(Trabalho t, Agendador ag)
        {
            if (!t.Ativo) return "Pausado";
            if (ag.Executando(t)) return "Agora";
            var p = Agenda.Proxima(t);
            return p <= DateTime.Now ? "Em instantes" : Textos.DataAmigavel(p);
        }

        public void Atualizar()
        {
            var t = Trabalho;
            var ag = j.Ag;
            BackColor = P.Superficie;
            rodando = ag.Executando(t);
            bool permitido = ag.Permitido(t);
            if (rodando) { sit = "Executando"; corSit = P.Destaque; fundoSit = P.DestaqueSuave; }
            else if (ag.NaFila(t)) { sit = "Na fila"; corSit = P.Destaque; fundoSit = P.DestaqueSuave; }
            else if (!permitido) { sit = "Precisa do Pro"; corSit = P.Pro; fundoSit = P.ProSuave; }
            else if (!t.Ativo) { sit = "Pausado"; corSit = P.Pausado; fundoSit = P.PausadoSuave; }
            else if (t.UltimoStatus == "erro") { sit = "Erro"; corSit = P.Erro; fundoSit = P.ErroSuave; }
            else if (t.UltimoStatus == "indisponivel") { sit = "Aguardando"; corSit = P.Aviso; fundoSit = P.AvisoSuave; }
            else if (t.UltimoStatus == "parcial") { sit = "Atenção"; corSit = P.Aviso; fundoSit = P.AvisoSuave; }
            else { sit = "Ativo"; corSit = P.Ok; fundoSit = P.OkSuave; }

            linha2 = t.Origem + "   →   " + t.DestinoFinal;
            linha3 = Textos.Agendamento(t.IntervaloValor, t.IntervaloUnidade, t.Inicio) + "     ·     Próximo: " + TextoProximo(t, ag);
            corLinha4 = P.TextoSuave;
            if (rodando)
            {
                linha4 = TextoProgresso(ag.Atual);
                fracao = ag.Atual.Progresso.Fracao;
            }
            else if (t.UltimoStatus == "erro" || t.UltimoStatus == "indisponivel" || t.UltimoStatus == "base" || t.UltimoStatus == "cancelado")
            {
                linha4 = t.UltimoResumo;
                corLinha4 = t.UltimoStatus == "erro" ? P.Erro : t.UltimoStatus == "indisponivel" ? P.Aviso : P.TextoSuave;
            }
            else if (t.UltimaExecucao == null) linha4 = Agenda.BaseNecessaria(t) ? "Preparando o ponto de partida..." : "Ainda não fez backup.";
            else linha4 = "Último backup: " + Textos.DataAmigavel(t.UltimaExecucao) + "  ·  " + t.UltimoResumo
                          + (t.TotalCopiados > 0 ? "  ·  Total: " + Textos.Plural(t.TotalCopiados, "arquivo", "arquivos") : "");

            agora.Text = rodando ? "Cancelar" : "Fazer backup agora";
            agora.Icone = rodando ? G.Parar : G.Play;
            pausar.Icone = t.Ativo ? G.Pausa : G.Play;
            dicas.SetToolTip(pausar, t.Ativo ? "Pausar este backup" : "Retomar este backup");
            PerformLayout();
            Invalidate(true);
        }

        protected override void OnLayout(LayoutEventArgs e)
        {
            base.OnLayout(e);
            int pad = S(18), y = pad - S(2), x = Width - pad;
            foreach (var b in new[] { mais, editar, pausar })
            {
                var t = b.GetPreferredSize(Size.Empty);
                x -= t.Width;
                b.SetBounds(x, y, t.Width, t.Height);
                x -= S(2);
            }
            var ta = agora.GetPreferredSize(Size.Empty);
            x -= ta.Width + S(6);
            agora.SetBounds(x, y, ta.Width, ta.Height);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.Clear(Parent?.BackColor ?? P.Fundo);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var r = new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f);
            Preencher(g, r, S(12), P.Superficie);
            Contornar(g, r, S(12), P.Borda);

            int pad = S(18);
            var tile = new RectangleF(pad, pad, S(44), S(44));
            Preencher(g, tile, S(10), fundoSit);
            Glifo(g, G.Pasta, 15f, Rectangle.Round(tile), corSit);

            int x = pad + S(44) + S(14);
            int direita = agora.Left - S(12);
            var tn = TextRenderer.MeasureText(Trabalho.Nome, CartaoTitulo);
            int largNome = Math.Min(tn.Width, Math.Max(S(80), direita - x - Pilula.Largura(sit, Pequena) - S(12)));
            Tema.Texto(g, Trabalho.Nome, CartaoTitulo, new Rectangle(x, pad - S(2), largNome + 2, S(28)), P.Texto, TextFormatFlags.EndEllipsis);
            Pilula.Desenhar(g, sit, Pequena, new Point(x + largNome + S(10), pad + S(1)), corSit, fundoSit);

            int largura = Width - x - pad;
            Tema.Texto(g, linha2, Base, new Rectangle(x, pad + S(28), Math.Min(largura, direita - x + S(140)), S(22)), P.TextoSuave, TextFormatFlags.PathEllipsis);
            Glifo(g, G.Relogio, 9f, new Rectangle(x - S(2), pad + S(52), S(18), S(22)), P.TextoFraco);
            Tema.Texto(g, linha3, Base, new Rectangle(x + S(20), pad + S(52), largura - S(20), S(22)), P.Texto, TextFormatFlags.EndEllipsis);

            if (rodando)
            {
                var barra = new RectangleF(x, pad + S(82), largura, S(6));
                Preencher(g, barra, S(3), P.Hover);
                if (fracao > 0) Preencher(g, new RectangleF(barra.X, barra.Y, Math.Max(S(6), (float)(barra.Width * fracao)), barra.Height), S(3), P.Destaque);
                Tema.Texto(g, linha4, Pequena, new Rectangle(x, pad + S(90), largura, S(22)), P.Destaque, TextFormatFlags.EndEllipsis);
            }
            else
            {
                Glifo(g, G.Historico, 9f, new Rectangle(x - S(2), pad + S(76), S(18), S(22)), P.TextoFraco);
                Tema.Texto(g, linha4, Base, new Rectangle(x + S(20), pad + S(76), largura - S(20), S(22)), corLinha4, TextFormatFlags.EndEllipsis);
            }
        }
    }

    /// <summary>Tela de quando ainda não há nenhuma pasta.</summary>
    public sealed class ZonaVazia : Control
    {
        public readonly Botao Adicionar = new Botao("Escolher uma pasta", EstiloBotao.Primario, G.Adicionar);
        bool destaque;

        public ZonaVazia()
        {
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            Controls.Add(Adicionar);
        }

        public void Destacar(bool d) { if (d != destaque) { destaque = d; Invalidate(); } }

        protected override void OnLayout(LayoutEventArgs e)
        {
            base.OnLayout(e);
            var t = Adicionar.GetPreferredSize(Size.Empty);
            Adicionar.SetBounds((Width - t.Width) / 2, Height / 2 + S(70), t.Width, t.Height);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.Clear(P.Fundo);
            BackColor = P.Fundo;
            Adicionar.FundoPai = destaque ? P.DestaqueSuave : P.Superficie;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            var r = new RectangleF(S(20), S(8), Width - S(40), Height - S(28));
            Preencher(g, r, S(16), destaque ? P.DestaqueSuave : P.Superficie);
            using (var pen = new Pen(destaque ? P.Destaque : P.BordaForte, S(2)) { DashStyle = DashStyle.Dash })
            using (var p = Arredondado(r, S(16))) g.DrawPath(pen, p);
            int tam = S(84);
            g.DrawImage(Tema.Logo, new Rectangle((Width - tam) / 2, Height / 2 - S(120), tam, tam));
            Tema.Texto(g, destaque ? "Solte a pasta para criar o backup dela" : "Arraste para cá a pasta que você quer proteger", Grande,
                new Rectangle(0, Height / 2 - S(26), Width, S(34)), P.Texto, TextFormatFlags.HorizontalCenter);
            Tema.Texto(g, "Ela pode ir para qualquer lugar: outro disco, pendrive, HD externo, pasta da rede ou nuvem (Google Drive, OneDrive...).",
                Base, new Rectangle(S(40), Height / 2 + S(10), Width - S(80), S(24)), P.TextoSuave, TextFormatFlags.HorizontalCenter | TextFormatFlags.EndEllipsis);
            Tema.Texto(g, "ou", Base, new Rectangle(0, Height / 2 + S(38), Width, S(24)), P.TextoFraco, TextFormatFlags.HorizontalCenter);
        }
    }
}
