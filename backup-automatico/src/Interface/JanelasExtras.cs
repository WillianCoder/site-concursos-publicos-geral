using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using BackupAutomatico.Nucleo;
using static BackupAutomatico.Interface.Tema;
using static BackupAutomatico.Interface.Montar;

namespace BackupAutomatico.Interface
{
    public sealed class JanelaConfiguracoes : Form
    {
        public JanelaConfiguracoes(JanelaPrincipal j)
        {
            JanelaPix.Configurar(this, "Configurações");
            var cfg = j.Cfg;
            var g = Grade(1);
            Label T(string texto) { var l = Rotulo(texto, Subtitulo); l.Margin = new Padding(0, S(14), 0, S(4)); return l; }

            var t0 = T("Aparência");
            t0.Margin = new Padding(0, 0, 0, S(4));
            g.Controls.Add(t0);
            var auto = new Opcao("Automático (igual ao Windows)") { Checked = cfg.Tema == "auto" };
            var claro = new Opcao("Claro") { Checked = cfg.Tema == "claro" };
            var escuro = new Opcao("Escuro") { Checked = cfg.Tema == "escuro" };
            void MudarTema(string modo) { cfg.Tema = modo; j.Salvar(); Tema.Definir(modo); }
            auto.CheckedChanged += (s, e) => { if (auto.Checked) MudarTema("auto"); };
            claro.CheckedChanged += (s, e) => { if (claro.Checked) MudarTema("claro"); };
            escuro.CheckedChanged += (s, e) => { if (escuro.Checked) MudarTema("escuro"); };
            g.Controls.Add(Fluxo(false, auto, claro, escuro));

            g.Controls.Add(T("Funcionamento"));
            var iniciar = new Interruptor("Iniciar junto com o Windows (recomendado)") { Checked = cfg.IniciarComWindows };
            var avisos = new Interruptor("Mostrar notificações quando um backup terminar") { Checked = cfg.Notificacoes };
            var bateria = new Interruptor("Não fazer backups automáticos quando o notebook estiver na bateria") { Checked = cfg.NaoUsarBateria };
            var pausa = new Interruptor("Pausar todos os backups automáticos") { Checked = cfg.PausaGeral };
            iniciar.CheckedChanged += (s, e) => { cfg.IniciarComWindows = iniciar.Checked; j.Salvar(); Instalacao.AtualizarInicio(cfg.IniciarComWindows); };
            avisos.CheckedChanged += (s, e) => { cfg.Notificacoes = avisos.Checked; j.Salvar(); };
            bateria.CheckedChanged += (s, e) => { cfg.NaoUsarBateria = bateria.Checked; j.Salvar(); };
            pausa.CheckedChanged += (s, e) => { cfg.PausaGeral = pausa.Checked; j.Salvar(); j.Atualizar(); };
            g.Controls.AddRange(new Control[] { iniciar, avisos, bateria, pausa });

            g.Controls.Add(T("Instalação"));
            bool instalado = Instalacao.EstaInstalado;
            g.Controls.Add(Rotulo(instalado ? "Instalado em " + Instalacao.Pasta : "Rodando de " + Path.GetDirectoryName(Application.ExecutablePath) + " (sem instalar).", Base, "suave", S(560)));
            var instalar = new Botao(instalado ? "Criar atalhos de novo" : "Instalar neste computador", EstiloBotao.Secundario, G.Disco) { Margin = new Padding(0, S(6), S(8), 0) };
            var desinstalar = new Botao("Desinstalar", EstiloBotao.Perigo, G.Lixeira) { Margin = new Padding(0, S(6), 0, 0), Visible = instalado };
            instalar.Click += (s, e) => j.Protegido(() =>
            {
                if (Instalacao.EstaInstalado) { Instalacao.CriarAtalhos(); j.Mensagem("Atalhos criados no Menu Iniciar e na Área de Trabalho."); return; }
                if (Instalacao.Instalar(cfg.IniciarComWindows)) { Instalacao.AbrirInstalado(null); j.Encerrar(); }
            });
            desinstalar.Click += (s, e) => j.Protegido(() =>
            {
                if (!j.Pergunta("Desinstalar o Backup Automático?\n\nOs backups automáticos param. Os arquivos que já estão nos backups NÃO são apagados.")) return;
                bool apagarDados = j.Pergunta("Apagar também as configurações e o histórico deste computador?\n\n(Escolha \"Não\" se pretende instalar de novo depois.)");
                Instalacao.Desinstalar(apagarDados);
                j.Encerrar();
            });
            g.Controls.Add(Fluxo(false, instalar, desinstalar));

            g.Controls.Add(T("Dados do programa"));
            g.Controls.Add(Rotulo("Configurações, histórico e registro de erros ficam em " + Caminhos.PastaDados, Base, "suave", S(560)));
            var abrirDados = new Botao("Abrir a pasta", EstiloBotao.Secundario, G.Pasta) { Margin = new Padding(0, S(6), 0, 0) };
            abrirDados.Click += (s, e) => Process.Start("explorer.exe", "\"" + Caminhos.PastaDados + "\"");
            g.Controls.Add(abrirDados);

            g.Controls.Add(T("Sobre"));
            g.Controls.Add(Rotulo("Backup Automático " + Versao.Atual + "  ·  Plano: " + Conta.NomePlano(Conta.Plano) + (Conta.Logado ? " (" + Conta.Email + ")" : ""), Base, "suave"));

            var fechar = new Botao("Fechar", EstiloBotao.Primario) { DialogResult = DialogResult.Cancel, Margin = Padding.Empty };
            CancelButton = fechar;
            JanelaPix.Finalizar(this, g, Fluxo(false, fechar), "janela-configuracoes");
        }
    }

    public sealed class JanelaHistorico : Form
    {
        public JanelaHistorico(Trabalho t)
        {
            JanelaPix.Configurar(this, "Histórico: " + t.Nome);
            FormBorderStyle = FormBorderStyle.Sizable;
            MinimizeBox = true;
            MaximizeBox = true;
            Size = new Size(S(860), S(600));
            MinimumSize = new Size(S(500), S(320));
            string arq = Caminhos.ArquivoHistorico(t.Id);
            var texto = new TextBox
            {
                Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Both, WordWrap = false, Dock = DockStyle.Fill,
                BorderStyle = BorderStyle.None, Font = new Font("Consolas", 10f),
                Text = File.Exists(arq) ? Historico.Ler(arq).Replace("\r\n", "\n").Replace("\n", "\r\n") : "Ainda não há histórico. Ele aparece depois do primeiro backup.",
            };
            var borda = new Panel { Dock = DockStyle.Fill, Padding = new Padding(S(16), S(16), S(16), 0), Tag = "superficie" };
            borda.Controls.Add(texto);
            var notepad = new Botao("Abrir no Bloco de Notas", EstiloBotao.Secundario, G.Editar) { Margin = new Padding(0, 0, S(8), 0) };
            var fechar = new Botao("Fechar", EstiloBotao.Primario) { DialogResult = DialogResult.Cancel, Margin = Padding.Empty };
            notepad.Click += (s, e) => { if (File.Exists(arq)) Process.Start("notepad.exe", "\"" + arq + "\""); };
            CancelButton = fechar;
            var rodape = new FlowLayoutPanel { Dock = DockStyle.Bottom, FlowDirection = FlowDirection.RightToLeft, Height = S(64), Padding = new Padding(S(16), S(14), S(16), 0), Tag = "superficie" };
            rodape.Controls.Add(fechar);
            rodape.Controls.Add(notepad);
            Controls.Add(borda);
            Controls.Add(rodape);
            Load += (s, e) => { Tema.Aplicar(this); texto.SelectionStart = texto.TextLength; texto.ScrollToCaret(); Nativo.TemaRolagem(texto.Handle, P.Escuro); };
            Shown += (s, e) => { if (Programa.ModoCaptura) Programa.Capturar(this, "janela-historico"); };
        }
    }

    /// <summary>Primeira vez: oferece instalar no computador.</summary>
    public sealed class JanelaBoasVindas : Form
    {
        public bool Instalar;

        public JanelaBoasVindas()
        {
            JanelaPix.Configurar(this, "Bem-vindo ao Backup Automático");
            StartPosition = FormStartPosition.CenterScreen;
            ShowInTaskbar = true;
            var g = Grade(1);
            var logo = new PictureBox { Image = Tema.Logo, SizeMode = PictureBoxSizeMode.Zoom, Size = new Size(S(64), S(64)), Margin = new Padding(0, 0, S(16), 0) };
            var titulo = Rotulo("Backup Automático", Titulo);
            var sub = Rotulo("Backups automáticos de qualquer pasta, para qualquer lugar.", Base, "suave", S(420));
            g.Controls.Add(Fluxo(false, logo, Fluxo(true, titulo, sub)));
            var texto = Rotulo("Recomendamos instalar: o programa vai para a sua pasta de programas, ganha atalhos no Menu Iniciar e na Área de Trabalho e passa a abrir sozinho quando o Windows liga (para os backups acontecerem na hora certa).\n\nNão precisa de senha de administrador e dá para desinstalar quando quiser.", Base, null, S(520));
            texto.Margin = new Padding(0, S(16), 0, 0);
            g.Controls.Add(texto);
            var instalar = new Botao("Instalar (recomendado)", EstiloBotao.Primario, G.Disco) { Margin = new Padding(S(8), 0, 0, 0) };
            var soUsar = new Botao("Só usar daqui") { Margin = Padding.Empty };
            instalar.Click += (s, e) => { Instalar = true; DialogResult = DialogResult.OK; Close(); };
            soUsar.Click += (s, e) => { Instalar = false; DialogResult = DialogResult.OK; Close(); };
            AcceptButton = instalar;
            JanelaPix.Finalizar(this, g, Fluxo(false, soUsar, instalar), "janela-boas-vindas");
        }
    }
}
