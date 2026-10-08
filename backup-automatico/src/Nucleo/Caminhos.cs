using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

namespace BackupAutomatico.Nucleo
{
    /// <summary>Caminhos do programa e utilidades para lidar com pastas.</summary>
    public static class Caminhos
    {
        public static bool Windows => Path.DirectorySeparatorChar == '\\';

        /// <summary>%LOCALAPPDATA%\BackupAutomatico (ou BACKUPAUTO_DADOS, nos testes).</summary>
        public static string PastaDados
        {
            get
            {
                string p = Environment.GetEnvironmentVariable("BACKUPAUTO_DADOS");
                if (string.IsNullOrEmpty(p))
                    p = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BackupAutomatico");
                Directory.CreateDirectory(p);
                return p;
            }
        }

        static string Sub(string pasta, string arquivo)
        {
            string p = Path.Combine(PastaDados, pasta);
            Directory.CreateDirectory(p);
            return Path.Combine(p, arquivo);
        }

        public static string ArquivoConfig => Path.Combine(PastaDados, "config.json");
        public static string ArquivoHistorico(string id) => Sub("historico", id + ".txt");
        public static string ArquivoBase(string id) => Sub("ponto-de-partida", id + ".txt");
        public static string ArquivoConta => Path.Combine(PastaDados, "conta.dat");
        public static string ArquivoNuvemCache => Path.Combine(PastaDados, "nuvem.json");

        public static void LogErro(string texto)
        {
            try
            {
                string arq = Path.Combine(PastaDados, "erros.log");
                if (File.Exists(arq) && new FileInfo(arq).Length > 1024 * 1024) File.Delete(arq);
                File.AppendAllText(arq, DateTime.Now.ToString("dd/MM/yyyy HH:mm:ss") + "  " + texto + Environment.NewLine, new UTF8Encoding(true));
            }
            catch { }
        }

        /// <summary>Caminho completo, sem aspas e sem barra no final (exceto na raiz).</summary>
        public static string Normalizar(string caminho)
        {
            if (string.IsNullOrWhiteSpace(caminho)) return "";
            string c = caminho.Trim().Trim('"').Trim();
            if (c == "") return "";
            try { c = Path.GetFullPath(c); } catch { }
            string raiz = "";
            try { raiz = Path.GetPathRoot(c) ?? ""; } catch { }
            if (c.Length > raiz.Length) c = c.TrimEnd('\\', '/');
            return c;
        }

        /// <summary>Verdadeiro se <paramref name="filho"/> é igual a <paramref name="pai"/> ou fica dentro dele.</summary>
        public static bool Dentro(string filho, string pai)
        {
            string sep = Path.DirectorySeparatorChar.ToString();
            string f = Normalizar(filho).TrimEnd('\\', '/') + sep;
            string p = Normalizar(pai).TrimEnd('\\', '/') + sep;
            if (f == sep || p == sep) return false;
            return f.StartsWith(p, StringComparison.OrdinalIgnoreCase);
        }

        public static string NomePasta(string caminho)
        {
            string c = Normalizar(caminho);
            string nome = Path.GetFileName(c);
            if (string.IsNullOrWhiteSpace(nome))
            {
                string letra = c.TrimEnd('\\', '/', ':');
                if (letra == "") return "Backup";
                nome = "Disco " + letra;
            }
            foreach (char ch in Path.GetInvalidFileNameChars()) nome = nome.Replace(ch, '_');
            return nome;
        }

        public static string DestinoFinal(Trabalho t)
        {
            string b = Normalizar(t.DestinoBase);
            if (b == "") return "";
            return t.CriarSubpasta ? Path.Combine(b, NomePasta(t.Origem)) : b;
        }

        static bool? prefixoLongo;

        /// <summary>No Windows, o prefixo \\?\ libera caminhos com mais de 260 caracteres.</summary>
        public static string Longo(string caminho)
        {
            if (!Windows) return caminho;
            if (prefixoLongo == null)
            {
                try { prefixoLongo = Directory.Exists(@"\\?\" + Environment.GetFolderPath(Environment.SpecialFolder.Windows)); }
                catch { prefixoLongo = false; }
            }
            if (prefixoLongo != true) return caminho;
            if (caminho.StartsWith(@"\\?\")) return caminho;
            if (caminho.StartsWith(@"\\")) return @"\\?\UNC\" + caminho.Substring(2);
            return @"\\?\" + caminho;
        }

        public static string SemPrefixo(string texto)
        {
            if (texto == null) return "";
            return texto.Replace(@"\\?\UNC\", @"\\").Replace(@"\\?\", "");
        }

        public static bool RaizDisponivel(string caminho)
        {
            try
            {
                string raiz = Path.GetPathRoot(Normalizar(caminho));
                return !string.IsNullOrEmpty(raiz) && Directory.Exists(raiz);
            }
            catch { return false; }
        }

        /// <summary>Um destino sugerido (nome para mostrar e caminho).</summary>
        public sealed class Sugestao
        {
            public string Nome;
            public string Caminho;
            public string Icone;
        }

        /// <summary>
        /// Lugares comuns para guardar backups: pastas de nuvem (Google Drive, OneDrive,
        /// Dropbox) e discos externos/pendrives conectados.
        /// </summary>
        public static List<Sugestao> SugestoesDeDestino()
        {
            var lista = new List<Sugestao>();
            var vistos = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            void Add(string nome, string caminho, string icone)
            {
                try
                {
                    if (string.IsNullOrEmpty(caminho) || !Directory.Exists(caminho) || !vistos.Add(caminho)) return;
                    lista.Add(new Sugestao { Nome = nome, Caminho = caminho, Icone = icone });
                }
                catch { }
            }

            string perfil = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            string[] nomesDrive = { "Meu Drive", "My Drive", "Mi unidad", "Mon Drive", "Il mio Drive", "Meine Ablage" };
            var raizes = new List<DriveInfo>();
            try { raizes.AddRange(DriveInfo.GetDrives()); } catch { }
            foreach (var d in raizes)
            {
                try
                {
                    if (!d.IsReady) continue;
                    foreach (string n in nomesDrive) Add("Google Drive", Path.Combine(d.RootDirectory.FullName, n), "nuvem");
                }
                catch { }
            }
            if (!string.IsNullOrEmpty(perfil))
            {
                foreach (string n in nomesDrive) Add("Google Drive", Path.Combine(perfil, n), "nuvem");
                Add("Google Drive", Path.Combine(perfil, "Google Drive"), "nuvem");
            }
            Add("OneDrive", Environment.GetEnvironmentVariable("OneDrive"), "nuvem");
            Add("OneDrive", Environment.GetEnvironmentVariable("OneDriveConsumer"), "nuvem");
            if (!string.IsNullOrEmpty(perfil)) Add("Dropbox", Path.Combine(perfil, "Dropbox"), "nuvem");
            foreach (var d in raizes)
            {
                try
                {
                    if (!d.IsReady || d.DriveType != DriveType.Removable && !(d.DriveType == DriveType.Fixed && !string.Equals(d.Name, Path.GetPathRoot(Environment.SystemDirectory ?? "C:\\"), StringComparison.OrdinalIgnoreCase))) continue;
                    if (!Windows) continue;
                    string rotulo = string.IsNullOrWhiteSpace(d.VolumeLabel) ? "Disco" : d.VolumeLabel;
                    if (rotulo.IndexOf("Google Drive", StringComparison.OrdinalIgnoreCase) >= 0) continue;
                    string tipo = d.DriveType == DriveType.Removable ? "Pendrive/disco externo" : "Disco";
                    Add(tipo + " " + d.Name.TrimEnd('\\') + " (" + rotulo + ")", d.RootDirectory.FullName, "disco");
                }
                catch { }
            }
            return lista;
        }
    }
}
