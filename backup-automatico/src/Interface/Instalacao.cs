using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Windows.Forms;
using BackupAutomatico.Nucleo;
using Microsoft.Win32;

namespace BackupAutomatico.Interface
{
    /// <summary>
    /// Instalação por usuário (sem pedir senha de administrador):
    /// %LOCALAPPDATA%\Programs\Backup Automatico, atalhos, início com o Windows e
    /// entrada em "Aplicativos instalados" para desinstalar.
    /// </summary>
    public static class Instalacao
    {
        const string ChaveRun = @"Software\Microsoft\Windows\CurrentVersion\Run";
        const string ChaveDesinstalar = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\BackupAutomatico";
        const string NomeValor = "BackupAutomatico";

        public static string Pasta
        {
            get
            {
                string p = Environment.GetEnvironmentVariable("BACKUPAUTO_PROGRAMAS");
                if (!string.IsNullOrEmpty(p)) return p;
                return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Backup Automatico");
            }
        }

        public static string Exe => Path.Combine(Pasta, "BackupAutomatico.exe");

        public static bool EstaInstalado =>
            string.Equals(Path.GetFullPath(Application.ExecutablePath), Path.GetFullPath(Exe), StringComparison.OrdinalIgnoreCase);

        static string ExeAtual => EstaInstalado ? Exe : Application.ExecutablePath;

        public static bool Instalar(bool iniciarComWindows)
        {
            try
            {
                Directory.CreateDirectory(Pasta);
                if (!EstaInstalado)
                {
                    for (int i = 0; ; i++)
                    {
                        try { File.Copy(Application.ExecutablePath, Exe, true); break; }
                        catch (IOException) when (i < 10) { System.Threading.Thread.Sleep(500); }
                    }
                }
                CriarAtalhos();
                using (var k = Registry.CurrentUser.CreateSubKey(ChaveDesinstalar))
                {
                    k.SetValue("DisplayName", "Backup Automático");
                    k.SetValue("DisplayVersion", Versao.Atual);
                    k.SetValue("Publisher", "Backup Automático");
                    k.SetValue("DisplayIcon", Exe);
                    k.SetValue("InstallLocation", Pasta);
                    k.SetValue("UninstallString", "\"" + Exe + "\" --desinstalar");
                    k.SetValue("NoModify", 1, RegistryValueKind.DWord);
                    k.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                    k.SetValue("EstimatedSize", (int)(new FileInfo(Exe).Length / 1024), RegistryValueKind.DWord);
                }
                if (iniciarComWindows) DefinirInicio(Exe);
                return true;
            }
            catch (Exception ex)
            {
                Caminhos.LogErro("Instalar: " + ex);
                MessageBox.Show("Não foi possível instalar:\n\n" + ex.Message + "\n\nO programa continua funcionando a partir desta pasta.", "Backup Automático", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return false;
            }
        }

        static IEnumerable<string> Atalhos()
        {
            yield return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "Backup Automático.lnk");
            yield return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Backup Automático.lnk");
        }

        public static void CriarAtalhos()
        {
            foreach (var a in Atalhos())
            {
                try { Nativo.CriarAtalho(a, Exe, "", "Backups automáticos de pastas"); }
                catch (Exception ex) { Caminhos.LogErro("Atalho: " + ex.Message); }
            }
        }

        public static void AbrirInstalado(List<string> pastas)
        {
            // --apos-instalar: a cópia instalada espera esta fechar antes de abrir.
            string args = "--apos-instalar " + string.Join(" ", (pastas ?? new List<string>()).Select(p => "\"" + p.TrimEnd('\\') + "\""));
            Process.Start(new ProcessStartInfo(Exe, args) { UseShellExecute = false, WorkingDirectory = Pasta });
        }

        public static void AtualizarInicio(bool ligar)
        {
            try
            {
                if (ligar) DefinirInicio(ExeAtual);
                else using (var k = Registry.CurrentUser.OpenSubKey(ChaveRun, true)) k?.DeleteValue(NomeValor, false);
            }
            catch (Exception ex) { Caminhos.LogErro("Iniciar com o Windows: " + ex.Message); }
        }

        static void DefinirInicio(string exe)
        {
            using (var k = Registry.CurrentUser.CreateSubKey(ChaveRun))
                k.SetValue(NomeValor, "\"" + exe + "\" --bandeja");
        }

        public static void Desinstalar(bool apagarDados)
        {
            try { using (var k = Registry.CurrentUser.OpenSubKey(ChaveRun, true)) k?.DeleteValue(NomeValor, false); } catch { }
            try { Registry.CurrentUser.DeleteSubKeyTree(ChaveDesinstalar, false); } catch { }
            foreach (var a in Atalhos()) try { File.Delete(a); } catch { }
            if (apagarDados) try { Directory.Delete(Caminhos.PastaDados, true); } catch { }
            if (Directory.Exists(Pasta))
            {
                // Apaga a pasta do programa depois que ele fechar.
                var psi = new ProcessStartInfo("cmd.exe", "/c ping -n 4 127.0.0.1 >nul & rmdir /s /q \"" + Pasta + "\"")
                { CreateNoWindow = true, UseShellExecute = false, WindowStyle = ProcessWindowStyle.Hidden };
                try { Process.Start(psi); } catch { }
            }
        }
    }
}
