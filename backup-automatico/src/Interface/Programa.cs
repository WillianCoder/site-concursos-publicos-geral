using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Management;
using System.Net;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using BackupAutomatico.Nucleo;
using Microsoft.Win32;

namespace BackupAutomatico.Interface
{
    public static class Programa
    {
        public static bool ModoCaptura;
        static string pastaCaptura;
        static int capturas;
        const string NomeMutex = @"Local\BackupAutomatico.v2";

        [STAThread]
        public static int Main(string[] args)
        {
            try { ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12; } catch { }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
            Application.ThreadException += (s, e) => Caminhos.LogErro("Erro na tela: " + e.Exception);
            AppDomain.CurrentDomain.UnhandledException += (s, e) => Caminhos.LogErro("Erro: " + e.ExceptionObject);

            bool bandeja = false, desinstalar = false, aposInstalar = false;
            string capturar = null;
            var pastas = new List<string>();
            for (int i = 0; i < args.Length; i++)
            {
                string a = args[i];
                if (a == "--bandeja") bandeja = true;
                else if (a == "--desinstalar") desinstalar = true;
                else if (a == "--apos-instalar") aposInstalar = true;
                else if (a == "--capturar-telas" && i + 1 < args.Length) capturar = args[++i];
                else if (!a.StartsWith("--")) pastas.Add(a);
            }

            var cfg = Configuracao.Ler();
            Tema.Iniciar(cfg.Tema);

            if (capturar != null) return ModoTeste(capturar, cfg);
            if (desinstalar)
            {
                if (MessageBox.Show("Desinstalar o Backup Automático?\n\nOs arquivos que já estão nos backups NÃO são apagados.", "Backup Automático",
                        MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return 0;
                Ipc.Enviar("SAIR");
                Thread.Sleep(1500);
                bool dados = MessageBox.Show("Apagar também as configurações e o histórico deste computador?", "Backup Automático",
                    MessageBoxButtons.YesNo, MessageBoxIcon.Question) == DialogResult.Yes;
                Instalacao.Desinstalar(dados);
                return 0;
            }

            var mutex = new Mutex(true, NomeMutex, out bool primeiro);
            if (!primeiro && aposInstalar)
            {
                // Acabou de ser instalado: espera a cópia antiga (que fez a instalação) fechar.
                try { primeiro = mutex.WaitOne(TimeSpan.FromSeconds(15)); } catch (AbandonedMutexException) { primeiro = true; }
            }
            if (!primeiro)
            {
                // Já está aberto. Se esta cópia for uma versão mais nova baixada, oferece atualizar.
                string versao = Ipc.Enviar("VERSAO");
                if (!Instalacao.EstaInstalado && versao != null && Comparar(Versao.Atual, versao) > 0 && !bandeja &&
                    MessageBox.Show("Você está abrindo a versão " + Versao.Atual + " e a versão " + versao + " está em uso.\n\nAtualizar agora?",
                        "Backup Automático", MessageBoxButtons.YesNo, MessageBoxIcon.Question) == DialogResult.Yes)
                {
                    Ipc.Enviar("SAIR");
                    try { primeiro = mutex.WaitOne(TimeSpan.FromSeconds(15)); } catch (AbandonedMutexException) { primeiro = true; }
                    if (!primeiro) return 1;
                    Thread.Sleep(500);
                    if (Instalacao.Instalar(cfg.IniciarComWindows)) { Instalacao.AbrirInstalado(pastas); return 0; }
                }
                else
                {
                    try { Nativo.AllowSetForegroundWindow(-1); } catch { }
                    if (pastas.Count == 0) Ipc.Enviar("MOSTRAR");
                    foreach (var p in pastas) Ipc.Enviar("PASTA\t" + p);
                    return 0;
                }
            }

            EncerrarVersaoAntiga();

            if (!Instalacao.EstaInstalado && !bandeja)
            {
                if (File.Exists(Instalacao.Exe))
                {
                    if (MessageBox.Show("O Backup Automático já está instalado neste computador.\n\nAtualizar a versão instalada com esta (" + Versao.Atual + ")?",
                            "Backup Automático", MessageBoxButtons.YesNo, MessageBoxIcon.Question) == DialogResult.Yes &&
                        Instalacao.Instalar(cfg.IniciarComWindows))
                    {
                        mutex.ReleaseMutex();
                        Instalacao.AbrirInstalado(pastas);
                        return 0;
                    }
                }
                else if (!cfg.InstalacaoPerguntada)
                {
                    var bv = new JanelaBoasVindas();
                    bv.ShowDialog();
                    cfg.InstalacaoPerguntada = true;
                    try { cfg.Salvar(); } catch { }
                    if (bv.Instalar && Instalacao.Instalar(cfg.IniciarComWindows))
                    {
                        mutex.ReleaseMutex();
                        Instalacao.AbrirInstalado(pastas);
                        return 0;
                    }
                }
            }
            if (cfg.Trabalhos.Count == 0 && !File.Exists(Caminhos.ArquivoConfig)) try { cfg.Salvar(); } catch { }
            Instalacao.AtualizarInicio(cfg.IniciarComWindows);

            var j = new JanelaPrincipal(cfg);
            var h = j.Handle;   // cria a janela (mesmo escondida) para receber mensagens
            Ipc.Servidor(j, msg =>
            {
                if (msg == "VERSAO") return Versao.Atual;
                if (msg == "MOSTRAR") j.MostrarJanela();
                else if (msg == "SAIR") j.Encerrar();
                else if (msg.StartsWith("PASTA\t")) { string p = msg.Substring(6); j.BeginInvoke(new Action(() => j.Protegido(() => j.AdicionarPasta(p)))); }
                return "OK";
            });
            var ctx = new ApplicationContext();
            if (!bandeja) j.Show();
            j.Iniciar(bandeja);
            foreach (var p in pastas) j.BeginInvoke(new Action(() => j.Protegido(() => j.AdicionarPasta(p))));
            j.BeginInvoke(new Action(async () => { await Conta.Iniciar(); j.Atualizar(); }));
            SystemEvents.SessionEnding += (s, e) => j.Ag.Cancelar();
            Application.Run(ctx);
            try { mutex.ReleaseMutex(); } catch { }
            return 0;
        }

        static int Comparar(string a, string b)
        {
            Version.TryParse(a, out var va);
            Version.TryParse(b, out var vb);
            return (va ?? new Version(0, 0)).CompareTo(vb ?? new Version(0, 0));
        }

        /// <summary>Fecha a versão antiga (scripts PowerShell), se estiver aberta: as duas fariam os mesmos backups.</summary>
        static void EncerrarVersaoAntiga()
        {
            try
            {
                if (!Mutex.TryOpenExisting(@"Local\BackupAutomatico_Painel", out var m)) return;
                m.Dispose();
                using (var busca = new ManagementObjectSearcher("SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name = 'powershell.exe'"))
                    foreach (ManagementObject o in busca.Get())
                    {
                        string linha = o["CommandLine"] as string;
                        if (linha != null && linha.IndexOf("Painel.ps1", StringComparison.OrdinalIgnoreCase) >= 0)
                            try { Process.GetProcessById(Convert.ToInt32(o["ProcessId"])).Kill(); } catch { }
                    }
            }
            catch (Exception ex) { Caminhos.LogErro("Versão antiga: " + ex.Message); }
        }

        // ---------------- Modo de teste (gera imagens das telas) ----------------

        static void Esperar(int ms)
        {
            var fim = DateTime.Now.AddMilliseconds(ms);
            while (DateTime.Now < fim) { Application.DoEvents(); Thread.Sleep(30); }
        }

        public static void Capturar(Form f, string nome)
        {
            if (!ModoCaptura) return;
            Esperar(400);
            string arquivo = Path.Combine(pastaCaptura, (++capturas).ToString("00") + "-" + nome + (Tema.P.Escuro ? "-escuro" : "-claro") + ".png");
            using (var bmp = new Bitmap(f.Width, f.Height))
            {
                try { using (var g = Graphics.FromImage(bmp)) g.CopyFromScreen(f.Location, Point.Empty, f.Size); }
                catch { f.DrawToBitmap(bmp, new Rectangle(Point.Empty, f.Size)); }
                bmp.Save(arquivo, ImageFormat.Png);
            }
            Console.WriteLine("Imagem salva: " + arquivo);
            if (f.Modal) f.Close();
        }

        static int ModoTeste(string pasta, Configuracao cfg)
        {
            ModoCaptura = true;
            pastaCaptura = pasta;
            Directory.CreateDirectory(pasta);
            int codigo = 0;
            try
            {
                Conta.App = new ConfigApp { PixChave = "contato@exemplo.com.br", PixNome = "Willian Salles", PixCidade = "São Paulo" };
                JanelaAdmin.DemoPedidos = new List<Pedido>
                {
                    new Pedido { Id = "1", Email = "maria@exemplo.com", Plano = "Pro anual", Valor = 59.9, Meses = 12, Codigo = "BKP7F3K2Q", Status = "aguardando", CriadoEm = DateTime.Now.AddHours(-2) },
                    new Pedido { Id = "2", Email = "joao@exemplo.com", Plano = "Pro mensal", Valor = 9.9, Meses = 1, Codigo = "BKPX8M2PL", Status = "pago", CriadoEm = DateTime.Now.AddDays(-3) },
                };
                JanelaAdmin.DemoLicencas = new List<Licenca>
                {
                    new Licenca { Uid = "a", Email = "joao@exemplo.com", ValidoAte = DateTime.Now.AddDays(27), Observacao = "Pedido BKPX8M2PL" },
                    new Licenca { Uid = "b", Email = "ana@exemplo.com", ValidoAte = null },
                };

                Tema.Definir("claro");
                var j = new JanelaPrincipal(cfg) { ModoCaptura = true };
                j.Show();
                j.Iniciar(false);
                Esperar(800);
                Capturar(j, "principal");
                if (cfg.Trabalhos.Count > 0)
                {
                    var t = cfg.Trabalhos[0];
                    j.Ag.PedirAgora(t);
                    var limite = DateTime.Now.AddSeconds(60);
                    while (j.Ag.Atual != null && DateTime.Now < limite) Esperar(200);
                    if (j.Ag.Atual != null) throw new Exception("O backup de teste não terminou em 60 segundos.");
                    j.Atualizar();
                    Esperar(300);
                    Capturar(j, "principal-depois-do-backup");
                    Console.WriteLine("Resultado do backup de teste: [" + t.UltimoStatus + "] " + t.UltimoResumo);
                    if (t.UltimoStatus != "ok") codigo = 1;
                    new JanelaHistorico(t).ShowDialog(j);
                    new JanelaBackup(t, null).ShowDialog(j);
                }
                new JanelaBackup(null, Path.GetTempPath()).ShowDialog(j);
                new JanelaConta().ShowDialog(j);
                Conta.Sessao = new Sessao { Email = "cliente@exemplo.com", EmailVerificado = true, Uid = "x" };
                new JanelaPro().ShowDialog(j);
                JanelaPix.Doacao().ShowDialog(j);

                Tema.Definir("escuro");
                Conta.Sessao = new Sessao { Email = "admin@exemplo.com", EmailVerificado = true, Uid = "adm" };
                Conta.Plano = Plano.Admin;
                j.Atualizar();
                Esperar(500);
                Capturar(j, "principal-admin");
                new JanelaAdmin(0).ShowDialog(j);
                new JanelaAdmin(1).ShowDialog(j);
                new JanelaAdmin(2).ShowDialog(j);
                new JanelaConfiguracoes(j).ShowDialog(j);
                if (cfg.Trabalhos.Count > 0) new JanelaBackup(cfg.Trabalhos[0], null).ShowDialog(j);
                JanelaPix.Doacao().ShowDialog(j);
                new JanelaBoasVindas().ShowDialog(j);

                cfg.Trabalhos.Clear();
                Conta.Plano = Plano.Gratis;
                Conta.Sessao = null;
                j.Atualizar();
                Esperar(500);
                Capturar(j, "principal-vazio");
                j.Encerrar();
                Console.WriteLine("Telas geradas com sucesso.");
            }
            catch (Exception ex)
            {
                Console.WriteLine("ERRO: " + ex);
                codigo = 1;
            }
            return codigo;
        }
    }

    /// <summary>Comunicação entre a cópia já aberta e uma nova (para não abrir duas).</summary>
    public static class Ipc
    {
        static string Nome
        {
            get
            {
                string u = new string(Environment.UserName.Where(char.IsLetterOrDigit).ToArray());
                return "BackupAutomatico-" + u + "-" + Process.GetCurrentProcess().SessionId;
            }
        }

        public static void Servidor(Control ui, Func<string, string> tratar)
        {
            var t = new Thread(() =>
            {
                while (true)
                {
                    try
                    {
                        using (var pipe = new NamedPipeServerStream(Nome, PipeDirection.InOut, 1, PipeTransmissionMode.Byte))
                        {
                            pipe.WaitForConnection();
                            var leitor = new StreamReader(pipe, Encoding.UTF8);
                            string msg = leitor.ReadLine() ?? "";
                            string resposta = "OK";
                            try { resposta = (string)ui.Invoke(new Func<string>(() => tratar(msg))); } catch { }
                            var escritor = new StreamWriter(pipe, new UTF8Encoding(false)) { AutoFlush = true };
                            escritor.WriteLine(resposta);
                            try { pipe.WaitForPipeDrain(); } catch { }
                        }
                    }
                    catch (Exception ex)
                    {
                        Caminhos.LogErro("IPC: " + ex.Message);
                        Thread.Sleep(1000);
                    }
                }
            }) { IsBackground = true, Name = "IPC" };
            t.Start();
        }

        public static string Enviar(string msg, int timeout = 3000)
        {
            try
            {
                using (var pipe = new NamedPipeClientStream(".", Nome, PipeDirection.InOut))
                {
                    pipe.Connect(timeout);
                    var escritor = new StreamWriter(pipe, new UTF8Encoding(false)) { AutoFlush = true };
                    escritor.WriteLine(msg);
                    var leitor = new StreamReader(pipe, Encoding.UTF8);
                    return leitor.ReadLine();
                }
            }
            catch { return null; }
        }
    }
}
