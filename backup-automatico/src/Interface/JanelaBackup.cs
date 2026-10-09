using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Windows.Forms;
using BackupAutomatico.Nucleo;
using static BackupAutomatico.Interface.Tema;
using static BackupAutomatico.Interface.Montar;

namespace BackupAutomatico.Interface
{
    /// <summary>Criar ou editar um backup.</summary>
    public sealed class JanelaBackup : Form
    {
        public Trabalho Resultado;
        public bool FazerAgora;

        readonly Trabalho original;
        readonly bool novo;
        readonly Campo nome = new Campo(), origem = new Campo("Arraste uma pasta para cá"), destino = new Campo("Arraste uma pasta para cá"), exclusoes = new Campo("ex.: *.tmp; Cache; node_modules");
        readonly Interruptor subpasta = new Interruptor("Criar uma subpasta com o nome da origem"), ligado = new Interruptor("Backup ligado"), primeiroAgora = new Interruptor("Fazer o primeiro backup assim que salvar");
        readonly Numero valor = new Numero();
        readonly Seletor unidade, diaSemana, hora, minuto, mes;
        readonly Numero diaMes = new Numero { Minimo = 1, Maximo = 31, Width = S(130) };
        readonly Opcao novos = new Opcao("Só arquivos novos (os que ainda não estão no backup)"), alterados = new Opcao("Arquivos novos e também os modificados");
        readonly Opcao copiarTudo = new Opcao("Copiar também (o primeiro backup leva o que já existe)"), ignorar = new Opcao("Ignorar: copiar só o que for adicionado daqui pra frente");
        readonly Label final = Rotulo("", Pequena, "suave"), previa = Rotulo("", Negrito, "destaque"), dicaQuando = Rotulo("", Pequena, "suave");
        readonly FlowLayoutPanel linhaDia, sugestoes;
        readonly Label rotDia;
        bool nomeEditado;
        readonly Plano plano = Conta.Plano;

        public JanelaBackup(Trabalho t, string origemInicial)
        {
            novo = t == null;
            original = t ?? new Trabalho { Origem = origemInicial ?? "", Nome = string.IsNullOrEmpty(origemInicial) ? "" : Caminhos.NomePasta(origemInicial) };
            nomeEditado = !novo;
            var d = Dialogo(novo ? "Novo backup" : "Editar backup");
            // Copia as propriedades do formulário-modelo.
            Text = d.Text; Tag = d.Tag; Font = d.Font; AutoScaleMode = d.AutoScaleMode; FormBorderStyle = d.FormBorderStyle;
            MaximizeBox = false; MinimizeBox = false; ShowInTaskbar = false; StartPosition = FormStartPosition.CenterParent; Icon = d.Icon;
            d.Dispose();
            AcceptButton = null;

            bool pro = plano != Plano.Gratis;
            var unidades = pro ? Trabalho.Unidades.ToList() : Trabalho.Unidades.Where(u => u != "minutos").ToList();
            unidade = new Seletor(unidades.ToArray()) { Width = S(140) };
            diaSemana = new Seletor(Textos.DiasLongos) { Width = S(170) };
            hora = new Seletor(Enumerable.Range(0, 24).Select(h => h.ToString("00")).ToArray()) { Width = S(80) };
            var minutos = Enumerable.Range(0, 12).Select(m => (m * 5).ToString("00")).ToList();
            if (original.Inicio.Minute % 5 != 0) { minutos.Add(original.Inicio.Minute.ToString("00")); minutos.Sort(); }
            minuto = new Seletor(minutos.ToArray()) { Width = S(80) };
            mes = new Seletor(Textos.Meses.Select(m => char.ToUpper(m[0]) + m.Substring(1)).ToArray()) { Width = S(150) };
            int larg = S(470);
            nome.Width = origem.Width = destino.Width = exclusoes.Width = larg;
            valor.Width = S(130);

            var g = Grade(3);
            g.Tag = "superficie";
            g.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            g.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            g.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            int linha = 0;
            void Titulo(string texto, string sub = null)
            {
                var l = Rotulo(texto, Subtitulo);
                l.Margin = new Padding(0, linha == 0 ? 0 : S(16), 0, S(2));
                g.Controls.Add(l, 0, linha);
                g.SetColumnSpan(l, 3);
                linha++;
                if (sub != null)
                {
                    var s = Rotulo(sub, Pequena, "suave", S(640));
                    g.Controls.Add(s, 0, linha);
                    g.SetColumnSpan(s, 3);
                    linha++;
                }
            }
            void Linha(string rotulo, Control c, Control extra = null)
            {
                var l = Rotulo(rotulo, Base, "suave");
                l.Anchor = AnchorStyles.Left;
                l.Margin = new Padding(0, S(4), S(14), S(4));
                g.Controls.Add(l, 0, linha);
                g.Controls.Add(c, 1, linha);
                if (extra != null) g.Controls.Add(extra, 2, linha);
                else g.SetColumnSpan(c, 2);
                linha++;
            }
            void Inteira(Control c, int col = 1)
            {
                g.Controls.Add(c, col, linha);
                g.SetColumnSpan(c, 3 - col);
                linha++;
            }

            // Pastas
            Titulo("Pastas");
            Linha("Nome do backup", nome);
            var btnOrigem = new Botao("Escolher...", EstiloBotao.Secundario, G.Pasta) { Compacto = true, Margin = new Padding(0, S(6), 0, 0) };
            Linha("Copiar a pasta", origem, btnOrigem);
            var btnDestino = new Botao("Escolher...", EstiloBotao.Secundario, G.Pasta) { Compacto = true, Margin = new Padding(0, S(6), 0, 0) };
            Linha("Para a pasta", destino, btnDestino);
            sugestoes = Fluxo(false);
            sugestoes.WrapContents = true;
            sugestoes.MaximumSize = new Size(S(620), 0);
            foreach (var sg in Caminhos.SugestoesDeDestino().Take(5))
            {
                var b = new Botao(sg.Nome, EstiloBotao.Fantasma, sg.Icone == "nuvem" ? G.Nuvem : G.Disco) { Compacto = true, Margin = new Padding(0, 0, S(4), S(2)) };
                string cam = sg.Caminho;
                b.Click += (s, e) => { destino.Texto = Path.Combine(cam, "Backup Automático"); subpasta.Checked = true; };
                sugestoes.Controls.Add(b);
            }
            if (sugestoes.Controls.Count > 0)
            {
                var rs = Rotulo("Atalhos:", Pequena, "suave");
                rs.Margin = new Padding(0, S(8), S(4), 0);
                sugestoes.Controls.Add(rs);
                sugestoes.Controls.SetChildIndex(rs, 0);
                Inteira(sugestoes);
            }
            Inteira(subpasta);
            final.MaximumSize = new Size(S(620), 0);
            Inteira(final);

            // Quando
            Titulo("Quando fazer o backup");
            Linha("Frequência", Fluxo(false, Meio("A cada"), valor, unidade));
            rotDia = Rotulo("Dia e horário", Base, "suave");
            rotDia.Anchor = AnchorStyles.Left;
            rotDia.Margin = new Padding(0, S(4), S(14), S(4));
            linhaDia = Fluxo(false);
            g.Controls.Add(rotDia, 0, linha);
            g.Controls.Add(linhaDia, 1, linha);
            g.SetColumnSpan(linhaDia, 2);
            linha++;
            dicaQuando.MaximumSize = new Size(S(620), 0);
            Inteira(dicaQuando);
            if (novo) { primeiroAgora.Checked = true; Inteira(primeiroAgora); }

            // Como
            Titulo("O que copiar");
            Inteira(Fluxo(true, novos, alterados), 0);
            Titulo("Arquivos que já existem na pasta hoje");
            Inteira(Fluxo(true, copiarTudo, ignorar), 0);
            Titulo("Ignorar também (opcional)", "Nomes de arquivos ou pastas que não devem ir para o backup. Use * como curinga. Separe com ponto e vírgula.");
            Inteira(exclusoes, 0);
            if (!pro)
            {
                alterados.Text += "  (Pro)";
                ignorar.Text += "  (Pro)";
                var aviso = Rotulo("Com o Pro você também pode copiar arquivos modificados, ignorar o que já existe e escolher o que não copiar.", Pequena, "pro", S(620));
                Inteira(aviso, 0);
            }
            Titulo("Situação");
            Inteira(ligado, 0);
            previa.MaximumSize = new Size(S(640), 0);
            previa.Margin = new Padding(0, S(12), 0, 0);
            Inteira(previa, 0);

            // Botões
            var salvar = new Botao("Salvar", EstiloBotao.Primario, G.Certo) { Margin = new Padding(S(8), 0, 0, 0) };
            var cancelar = new Botao("Cancelar") { Margin = Padding.Empty, DialogResult = DialogResult.Cancel };
            var botoes = Fluxo(false, cancelar, salvar);
            CancelButton = cancelar;
            Controls.Add(g);
            Controls.Add(botoes);

            // Valores iniciais
            nome.Texto = original.Nome;
            origem.Texto = original.Origem;
            destino.Texto = original.DestinoBase;
            subpasta.Checked = original.CriarSubpasta;
            ligado.Checked = original.Ativo;
            valor.Valor = original.IntervaloValor;
            unidade.Indice = Math.Max(0, unidades.IndexOf(original.IntervaloUnidade));
            diaSemana.Indice = (int)original.Inicio.DayOfWeek;
            hora.Indice = original.Inicio.Hour;
            minuto.Indice = minuto.Itens.IndexOf(original.Inicio.Minute.ToString("00"));
            diaMes.Valor = original.Inicio.Day;
            mes.Indice = original.Inicio.Month - 1;
            if (novo) { hora.Indice = 18; minuto.Indice = 0; diaSemana.Indice = (int)DayOfWeek.Friday; }
            (original.Modo == "alterados" ? alterados : novos).Checked = true;
            (original.IgnorarExistentes ? ignorar : copiarTudo).Checked = true;
            exclusoes.Texto = original.Exclusoes;
            if (!pro)
            {
                alterados.Enabled = original.Modo == "alterados";
                ignorar.Enabled = original.IgnorarExistentes;
                exclusoes.Enabled = original.Exclusoes != "";
            }
            if (novo && string.IsNullOrEmpty(original.DestinoBase))
            {
                var sg = Caminhos.SugestoesDeDestino().FirstOrDefault();
                if (sg != null) destino.Texto = Path.Combine(sg.Caminho, "Backup Automático");
            }

            // Eventos
            nome.Caixa.KeyPress += (s, e) => nomeEditado = true;
            origem.TextChanged += (s, e) =>
            {
                if (!nomeEditado) { string o = Caminhos.Normalizar(origem.Texto); if (o != "") nome.Texto = Caminhos.NomePasta(o); }
                Previa();
            };
            origem.Soltou += p => origem.Texto = Directory.Exists(p) ? p : Path.GetDirectoryName(p);
            destino.Soltou += p => destino.Texto = Directory.Exists(p) ? p : Path.GetDirectoryName(p);
            destino.TextChanged += (s, e) => Previa();
            subpasta.CheckedChanged += (s, e) => Previa();
            ligado.CheckedChanged += (s, e) => Previa();
            primeiroAgora.CheckedChanged += (s, e) => Previa();
            ignorar.CheckedChanged += (s, e) => Previa();
            valor.Mudou += Previa;
            unidade.Mudou += () => { MontarLinhaDia(); Previa(); };
            foreach (var sel in new[] { diaSemana, hora, minuto, mes }) sel.Mudou += Previa;
            diaMes.Mudou += Previa;
            btnOrigem.Click += (s, e) => { var p = Escolher("Escolha a pasta que você quer proteger:", origem.Texto); if (p != null) origem.Texto = p; };
            btnDestino.Click += (s, e) => { var p = Escolher("Escolha para onde os arquivos serão copiados:", destino.Texto); if (p != null) destino.Texto = p; };
            salvar.Click += (s, e) => Salvar();

            MontarLinhaDia();
            Previa();
            Load += (s, e) => { Tema.Aplicar(this); Encaixar(this, g, botoes, S(24)); };
            HandleCreated += (s, e) => Nativo.TituloEscuro(Handle, P.Escuro);
            Shown += (s, e) => { if (Programa.ModoCaptura) Programa.Capturar(this, novo ? "janela-novo-backup" : "janela-editar-backup"); };
        }

        static Label Meio(string texto)
        {
            var l = Rotulo(texto, Base);
            l.Margin = new Padding(0, S(12), S(6), 0);
            return l;
        }

        string Escolher(string descricao, string inicial)
        {
            using (var fb = new FolderBrowserDialog { Description = descricao, ShowNewFolderButton = true })
            {
                if (Directory.Exists(inicial)) fb.SelectedPath = inicial;
                return fb.ShowDialog(this) == DialogResult.OK ? fb.SelectedPath : null;
            }
        }

        void MontarLinhaDia()
        {
            linhaDia.SuspendLayout();
            linhaDia.Controls.Clear();
            string u = unidade.Selecionado;
            var hm = new Control[] { Meio("às"), hora, Meio(":"), minuto };
            switch (u)
            {
                case "dias": linhaDia.Controls.AddRange(hm); break;
                case "semanas": linhaDia.Controls.Add(diaSemana); linhaDia.Controls.AddRange(hm); break;
                case "meses": linhaDia.Controls.Add(Meio("No dia")); linhaDia.Controls.Add(diaMes); linhaDia.Controls.AddRange(hm); break;
                case "anos": linhaDia.Controls.Add(Meio("Em")); linhaDia.Controls.Add(diaMes); linhaDia.Controls.Add(Meio("de")); linhaDia.Controls.Add(mes); linhaDia.Controls.AddRange(hm); break;
            }
            bool visivel = u != "minutos" && u != "horas";
            linhaDia.Visible = rotDia.Visible = visivel;
            linhaDia.ResumeLayout();
            Tema.Aplicar(linhaDia);
        }

        DateTime CalcularInicio()
        {
            string u = unidade.Selecionado;
            int h = hora.Indice < 0 ? 0 : hora.Indice;
            int m = int.Parse(minuto.Selecionado == "" ? "0" : minuto.Selecionado);
            var agora = DateTime.Now;
            if (!novo && u == original.IntervaloUnidade && valor.Valor == original.IntervaloValor)
            {
                var o = original.Inicio;
                bool igual = u == "minutos" || u == "horas" ||
                    (o.Hour == h && o.Minute == m &&
                     (u == "dias" || (u == "semanas" && (int)o.DayOfWeek == diaSemana.Indice) ||
                      (u == "meses" && o.Day == diaMes.Valor) || (u == "anos" && o.Day == diaMes.Valor && o.Month == mes.Indice + 1)));
                if (igual) return o;
            }
            return Agenda.PrimeiraOcorrencia(u, h, m, (DayOfWeek)Math.Max(0, diaSemana.Indice), diaMes.Valor, mes.Indice + 1, agora);
        }

        Trabalho Montar()
        {
            var t = original.Clonar();
            t.Nome = nome.Texto.Trim();
            t.Origem = Caminhos.Normalizar(origem.Texto);
            t.DestinoBase = Caminhos.Normalizar(destino.Texto);
            t.CriarSubpasta = subpasta.Checked;
            t.Modo = alterados.Checked ? "alterados" : "novos";
            t.IntervaloValor = valor.Valor;
            t.IntervaloUnidade = unidade.Selecionado;
            t.Inicio = CalcularInicio();
            t.Ativo = ligado.Checked;
            t.IgnorarExistentes = ignorar.Checked;
            t.Exclusoes = exclusoes.Texto.Trim();
            return t;
        }

        void Previa()
        {
            var t = Montar();
            string nomeOrigem = t.Origem != "" ? Caminhos.NomePasta(t.Origem) : "da origem";
            subpasta.Text = "Criar a subpasta \"" + nomeOrigem + "\" dentro dela";
            subpasta.Invalidate();
            string fin = t.DestinoFinal;
            if (fin == "") { final.Text = "Escolha para onde os arquivos serão copiados: outro disco, pendrive, HD externo, rede ou uma pasta de nuvem."; final.Tag = "suave"; }
            else if (Caminhos.RaizDisponivel(fin)) { final.Text = "Os arquivos ficarão em:  " + fin; final.Tag = "ok"; }
            else { final.Text = "Os arquivos ficarão em:  " + fin + "\n(esse local não está acessível agora)"; final.Tag = "aviso"; }
            final.ForeColor = final.Tag as string == "ok" ? P.Ok : final.Tag as string == "aviso" ? P.Aviso : P.TextoSuave;

            string u = t.IntervaloUnidade;
            dicaQuando.Text = u == "minutos" || u == "horas"
                ? "Começa a contar a partir de agora e repete a cada " + t.IntervaloValor + " " + u + "."
                : (u == "meses" && t.Inicio.Day > 28 ? "Nos meses mais curtos, o backup acontece no último dia do mês. " : "") +
                  "Se o computador estiver desligado nessa hora, o backup acontece assim que ele for ligado.";

            if (!t.Ativo) { previa.Text = "Backup pausado: nada será copiado até você ligá-lo de novo."; return; }
            if (!novo) t.UltimaExecucao = original.UltimaExecucao;
            t.AguardarAte = null;
            var prox = Agenda.Proxima(t);
            string texto = Textos.Agendamento(t.IntervaloValor, t.IntervaloUnidade, t.Inicio) + ".  Próximo: " +
                           (prox <= DateTime.Now ? "logo depois de salvar" : Textos.DataAmigavel(prox)) + ".";
            if (novo && primeiroAgora.Checked) texto += "\nO primeiro backup começa assim que você salvar.";
            if (t.IgnorarExistentes) texto += "\nAntes, o programa anota os arquivos que já existem para ignorá-los.";
            previa.Text = texto;
        }

        void Salvar()
        {
            var t = Montar();
            var problemas = Agenda.Validar(t);
            if (problemas.Count > 0) { MessageBox.Show(this, string.Join("\n\n", problemas), "Backup Automático", MessageBoxButtons.OK, MessageBoxIcon.Warning); return; }
            if (!Caminhos.RaizDisponivel(t.DestinoFinal) && !Programa.ModoCaptura &&
                MessageBox.Show(this, "O destino não está acessível agora (disco desconectado?).\n\nO backup vai esperar o destino voltar. Salvar mesmo assim?",
                    "Backup Automático", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes) return;
            var cfg = (Owner as JanelaPrincipal)?.Cfg;
            if (cfg != null)
                foreach (var outro in cfg.Trabalhos)
                    if (outro.Id != t.Id && string.Equals(outro.DestinoFinal, t.DestinoFinal, StringComparison.OrdinalIgnoreCase) &&
                        !string.Equals(Caminhos.Normalizar(outro.Origem), t.Origem, StringComparison.OrdinalIgnoreCase) &&
                        MessageBox.Show(this, "O backup \"" + outro.Nome + "\" já copia outra pasta para este mesmo destino:\n\n" + t.DestinoFinal +
                            "\n\nOs arquivos das duas pastas vão se misturar. Continuar mesmo assim?", "Backup Automático", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes)
                        return;
            Resultado = t;
            FazerAgora = novo && primeiroAgora.Checked && t.Ativo;
            DialogResult = DialogResult.OK;
            Close();
        }
    }
}
