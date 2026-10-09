using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace BackupAutomatico.Nucleo
{
    public sealed class OpcoesBackup
    {
        public string Origem = "";
        public string Destino = "";
        public string Modo = "novos";
        public string ArquivoBase = "";
        public bool RegistrarBase;
        public string ArquivoHistorico = "";
        public string Nome = "Backup";
        public List<string> Exclusoes = new List<string>();
    }

    /// <summary>Progresso compartilhado entre o motor (outra thread) e a tela.</summary>
    public sealed class Progresso
    {
        volatile bool cancelar;
        volatile string fase = "Preparando";
        volatile string atual = "";
        long lidos, total, feitos, bytesTotal, bytesFeitos;

        public bool Cancelar { get => cancelar; set => cancelar = value; }
        public string Fase { get => fase; set => fase = value; }
        public string Atual { get => atual; set => atual = value; }
        public long Lidos { get => Interlocked.Read(ref lidos); set => Interlocked.Exchange(ref lidos, value); }
        public long Total { get => Interlocked.Read(ref total); set => Interlocked.Exchange(ref total, value); }
        public long Feitos { get => Interlocked.Read(ref feitos); set => Interlocked.Exchange(ref feitos, value); }
        public long BytesTotal { get => Interlocked.Read(ref bytesTotal); set => Interlocked.Exchange(ref bytesTotal, value); }
        public long BytesFeitos { get => Interlocked.Read(ref bytesFeitos); set => Interlocked.Exchange(ref bytesFeitos, value); }

        /// <summary>0 a 1, pelo volume de bytes (ou pela quantidade de arquivos).</summary>
        public double Fracao
        {
            get
            {
                long bt = BytesTotal;
                if (bt > 0) return Math.Min(1, BytesFeitos / (double)bt);
                long t = Total;
                return t > 0 ? Math.Min(1, Feitos / (double)t) : 0;
            }
        }
    }

    public sealed class Resultado
    {
        public string Status = "ok";     // ok | parcial | erro | indisponivel | cancelado | base
        public string Mensagem = "";
        public int Copiados, Novos, Alterados, Falhas, Ignorados;
        public long Analisados, Bytes;
        public DateTime Inicio = DateTime.Now, Fim;
        public List<string> Erros = new List<string>();
    }

    /// <summary>
    /// Copia para o destino os arquivos da origem que ainda não estão lá (modo
    /// "novos") ou que são novos/modificados (modo "alterados"). Nunca apaga nada
    /// do destino. Cada arquivo é copiado com um nome provisório e só recebe o
    /// nome final quando termina, para nunca deixar arquivo pela metade.
    /// </summary>
    public static class Motor
    {
        public const string SufixoParcial = ".bkpauto-parcial";
        static readonly string[] ArquivosIgnorados = { "desktop.ini", "Thumbs.db", "~$*", "*.tmp", ".~lock.*#", "*" + SufixoParcial };
        static readonly string[] PastasIgnoradas = { ".tmp.drivedownload", ".tmp.driveupload", "$RECYCLE.BIN", "System Volume Information" };

        struct Entrada
        {
            public string Relativo;
            public string Completo;
            public long Tamanho;
            public long ModificadoUtc;   // ticks
        }

        public static Resultado Executar(OpcoesBackup op, Progresso p = null)
        {
            p = p ?? new Progresso();
            var res = new Resultado();
            var copiados = new List<string>();
            var erros = new List<string>();
            var avisos = new List<string>();
            string origem = Caminhos.Normalizar(op.Origem);
            string destino = Caminhos.Normalizar(op.Destino);

            try
            {
                if (origem == "" || !Directory.Exists(origem))
                {
                    res.Status = "indisponivel";
                    res.Mensagem = "A pasta de origem não está acessível agora (" + origem + ").";
                    return Finalizar(res, p);
                }
                if (!op.RegistrarBase)
                {
                    if (destino == "") throw new InvalidOperationException("Pasta de destino não definida.");
                    if (!Caminhos.RaizDisponivel(destino))
                    {
                        res.Status = "indisponivel";
                        res.Mensagem = "O destino (" + SafeRaiz(destino) + ") não está disponível agora. O disco está conectado?";
                        return Finalizar(res, p);
                    }
                    if (Caminhos.Dentro(destino, origem) || Caminhos.Dentro(origem, destino))
                        throw new InvalidOperationException("A pasta de destino não pode ficar dentro da origem (nem o contrário).");
                    try { Directory.CreateDirectory(Caminhos.Longo(destino)); }
                    catch (Exception ex) { throw new InvalidOperationException("Não foi possível criar a pasta de destino (" + destino + "): " + Mensagem(ex)); }
                }
                string origemL = Caminhos.Longo(origem);
                string destinoL = Caminhos.Longo(destino);
                var ignorar = new Filtro(op.Exclusoes);

                // 1) Lê a origem.
                p.Fase = "Lendo a pasta de origem";
                var arquivosOrigem = Listar(origemL, p, avisos, false, ignorar);
                res.Analisados = arquivosOrigem.Count;
                if (p.Cancelar) throw new OperationCanceledException();

                if (op.RegistrarBase)
                {
                    var linhas = new List<string>(arquivosOrigem.Count);
                    foreach (var e in arquivosOrigem) linhas.Add(ChaveBase(e));
                    File.WriteAllLines(op.ArquivoBase, linhas, new UTF8Encoding(false));
                    res.Status = "base";
                    res.Ignorados = linhas.Count;
                    res.Mensagem = "Ponto de partida registrado: " +
                        Textos.Plural(linhas.Count, "arquivo que já existia será ignorado", "arquivos que já existiam serão ignorados") + ".";
                    return Finalizar(res, p);
                }

                // 2) Lê o que já está no backup.
                p.Fase = "Comparando com o backup";
                var noBackup = new Dictionary<string, Entrada>(StringComparer.OrdinalIgnoreCase);
                foreach (var e in Listar(destinoL, p, avisos, true, null)) noBackup[e.Relativo] = e;
                if (p.Cancelar) throw new OperationCanceledException();

                HashSet<string> baseExistente = null;
                if (!string.IsNullOrEmpty(op.ArquivoBase))
                {
                    if (!File.Exists(op.ArquivoBase))
                        throw new InvalidOperationException("O ponto de partida deste backup não foi encontrado. Edite o backup e salve de novo.");
                    baseExistente = new HashSet<string>(File.ReadAllLines(op.ArquivoBase, Encoding.UTF8), StringComparer.OrdinalIgnoreCase);
                }

                // 3) Decide o que copiar.
                var paraCopiar = new List<KeyValuePair<Entrada, bool>>();
                long bytesTotal = 0;
                foreach (var e in arquivosOrigem)
                {
                    if (noBackup.TryGetValue(e.Relativo, out var existente))
                    {
                        if (op.Modo == "alterados")
                        {
                            double dif = Math.Abs(TimeSpan.FromTicks(e.ModificadoUtc - existente.ModificadoUtc).TotalSeconds);
                            if (existente.Tamanho != e.Tamanho || dif > 2)
                            {
                                paraCopiar.Add(new KeyValuePair<Entrada, bool>(e, false));
                                bytesTotal += e.Tamanho;
                            }
                        }
                    }
                    else if (baseExistente != null && baseExistente.Contains(ChaveBase(e)))
                    {
                        res.Ignorados++;
                    }
                    else
                    {
                        paraCopiar.Add(new KeyValuePair<Entrada, bool>(e, true));
                        bytesTotal += e.Tamanho;
                    }
                }
                noBackup = null;

                // 4) Copia.
                p.Fase = "Copiando";
                p.Total = paraCopiar.Count;
                p.BytesTotal = bytesTotal;
                long bytesAntes = 0;
                int falhasSeguidas = 0;
                foreach (var item in paraCopiar)
                {
                    if (p.Cancelar) throw new OperationCanceledException();
                    var e = item.Key;
                    p.Atual = e.Relativo;
                    bool ok = false;
                    string msg = "";
                    for (int tentativa = 1; tentativa <= 2 && !ok; tentativa++)
                    {
                        try
                        {
                            CopiarSeguro(e, Path.Combine(destinoL, e.Relativo), p, bytesAntes);
                            ok = true;
                        }
                        catch (OperationCanceledException) { throw; }
                        catch (Exception ex)
                        {
                            msg = Mensagem(ex);
                            if (tentativa < 2) Esperar(p, 2000);
                        }
                    }
                    bytesAntes += e.Tamanho;
                    p.BytesFeitos = bytesAntes;
                    if (ok)
                    {
                        res.Copiados++;
                        res.Bytes += e.Tamanho;
                        if (item.Value) { res.Novos++; copiados.Add("+ " + e.Relativo); }
                        else { res.Alterados++; copiados.Add("~ " + e.Relativo); }
                        falhasSeguidas = 0;
                    }
                    else
                    {
                        res.Falhas++;
                        erros.Add(e.Relativo + " - " + msg);
                        if (++falhasSeguidas >= 25)
                        {
                            erros.Add("Muitas falhas seguidas; o backup foi interrompido e será tentado de novo depois.");
                            break;
                        }
                    }
                    p.Feitos = res.Copiados + res.Falhas;
                }

                // 5) Resumo.
                if (res.Copiados == 0 && res.Falhas == 0)
                {
                    res.Mensagem = op.Modo == "alterados" ? "Nada novo ou modificado para copiar." : "Nenhum arquivo novo.";
                }
                else
                {
                    var partes = new List<string>();
                    if (res.Novos > 0) partes.Add(Textos.Plural(res.Novos, "arquivo novo", "arquivos novos"));
                    if (res.Alterados > 0) partes.Add(Textos.Plural(res.Alterados, "modificado", "modificados"));
                    if (partes.Count > 0)
                        res.Mensagem = string.Join(" e ", partes) + " copiado" + (res.Copiados > 1 ? "s" : "") + " (" + Textos.Tamanho(res.Bytes) + ")";
                    if (res.Falhas > 0)
                    {
                        string f = Textos.Plural(res.Falhas, "arquivo não pôde ser copiado", "arquivos não puderam ser copiados");
                        res.Mensagem = res.Mensagem != "" ? res.Mensagem + "; " + f : f;
                        res.Status = res.Copiados > 0 ? "parcial" : "erro";
                    }
                    res.Mensagem += ".";
                }
            }
            catch (OperationCanceledException)
            {
                res.Status = "cancelado";
                res.Mensagem = res.Copiados > 0 ? "Cancelado depois de copiar " + Textos.Plural(res.Copiados, "arquivo", "arquivos") + "." : "Cancelado.";
            }
            catch (Exception ex)
            {
                res.Status = "erro";
                res.Mensagem = Mensagem(ex);
            }

            res.Fim = DateTime.Now;
            if (res.Copiados > 0 || res.Falhas > 0)
                res.Mensagem = res.Mensagem.TrimEnd('.') + " em " + Textos.Duracao(res.Fim - res.Inicio) + ".";
            res.Erros = erros;
            Historico.Gravar(op.ArquivoHistorico, op.Nome, origem, destino, res, copiados, erros, avisos);
            return Finalizar(res, p);
        }

        static Resultado Finalizar(Resultado r, Progresso p)
        {
            if (r.Fim == default(DateTime)) r.Fim = DateTime.Now;
            p.Fase = "Concluído";
            return r;
        }

        static string SafeRaiz(string c)
        {
            try { return Path.GetPathRoot(c); } catch { return c; }
        }

        static void Esperar(Progresso p, int ms)
        {
            for (int i = 0; i < ms / 100 && !p.Cancelar; i++) Thread.Sleep(100);
        }

        static string ChaveBase(Entrada e) => e.Relativo + "|" + e.Tamanho + "|" + e.ModificadoUtc;

        public static string Mensagem(Exception ex)
        {
            while ((ex is System.Reflection.TargetInvocationException || ex is AggregateException) && ex.InnerException != null)
                ex = ex.InnerException;
            return Caminhos.SemPrefixo(ex.Message).Trim();
        }

        // ------------------------------------------------------------------
        //  Listagem de arquivos
        // ------------------------------------------------------------------

        sealed class Filtro
        {
            readonly List<string> extras;
            public Filtro(List<string> padroes) { extras = padroes ?? new List<string>(); }
            public bool Ignorar(string nome, bool pasta)
            {
                foreach (var pd in pasta ? PastasIgnoradas : ArquivosIgnorados) if (Coincide(nome, pd)) return true;
                foreach (var pd in extras) if (Coincide(nome, pd)) return true;
                return false;
            }
        }

        /// <summary>Compara um nome com um padrão com * e ? (sem diferenciar maiúsculas).</summary>
        public static bool Coincide(string nome, string padrao)
        {
            int n = 0, p = 0, estrela = -1, marca = 0;
            while (n < nome.Length)
            {
                if (p < padrao.Length && (padrao[p] == '?' || char.ToUpperInvariant(padrao[p]) == char.ToUpperInvariant(nome[n]))) { n++; p++; }
                else if (p < padrao.Length && padrao[p] == '*') { estrela = p++; marca = n; }
                else if (estrela >= 0) { p = estrela + 1; n = ++marca; }
                else return false;
            }
            while (p < padrao.Length && padrao[p] == '*') p++;
            return p == padrao.Length;
        }

        static List<Entrada> Listar(string raiz, Progresso p, List<string> avisos, bool limparParciais, Filtro filtro)
        {
            var lista = new List<Entrada>();
            var pilha = new Stack<KeyValuePair<string, string>>();   // (caminho completo, relativo)
            pilha.Push(new KeyValuePair<string, string>(raiz, ""));
            filtro = filtro ?? new Filtro(null);
            while (pilha.Count > 0)
            {
                if (p.Cancelar) return lista;
                var atual = pilha.Pop();
                if (Caminhos.Windows) ListarWin32(atual.Key, atual.Value, lista, pilha, avisos, limparParciais, filtro);
                else ListarGerenciado(atual.Key, atual.Value, lista, pilha, avisos, limparParciais, filtro);
                p.Lidos = lista.Count;
            }
            return lista;
        }

        static string Juntar(string rel, string nome) => rel == "" ? nome : rel + Path.DirectorySeparatorChar + nome;

        static void ListarWin32(string pasta, string rel, List<Entrada> lista, Stack<KeyValuePair<string, string>> pilha,
            List<string> avisos, bool limparParciais, Filtro filtro)
        {
            string busca = pasta.TrimEnd('\\') + "\\*";
            IntPtr h = Win32.FindFirstFileExW(busca, Win32.FindExInfoBasic, out var d, Win32.FindExSearchNameMatch, IntPtr.Zero, Win32.FIND_FIRST_EX_LARGE_FETCH);
            if (h == Win32.INVALID_HANDLE_VALUE)
            {
                int erro = Marshal.GetLastWin32Error();
                if (erro != Win32.ERROR_FILE_NOT_FOUND && erro != Win32.ERROR_NO_MORE_FILES)
                    avisos.Add("Pasta não pôde ser lida: " + Caminhos.SemPrefixo(pasta) + " (" + new Win32Exception(erro).Message + ")");
                return;
            }
            try
            {
                do
                {
                    string nome = d.cFileName;
                    if (nome == "." || nome == "..") continue;
                    string completo = pasta.TrimEnd('\\') + "\\" + nome;
                    if ((d.dwFileAttributes & Win32.FILE_ATTRIBUTE_DIRECTORY) != 0)
                    {
                        if (filtro.Ignorar(nome, true)) continue;
                        if ((d.dwFileAttributes & Win32.FILE_ATTRIBUTE_REPARSE_POINT) != 0 &&
                            (d.dwReserved0 == Win32.IO_REPARSE_TAG_MOUNT_POINT || d.dwReserved0 == Win32.IO_REPARSE_TAG_SYMLINK))
                        {
                            avisos.Add("Atalho de pasta ignorado: " + Caminhos.SemPrefixo(completo));
                            continue;
                        }
                        pilha.Push(new KeyValuePair<string, string>(completo, Juntar(rel, nome)));
                    }
                    else
                    {
                        if (limparParciais && nome.EndsWith(SufixoParcial, StringComparison.OrdinalIgnoreCase))
                        {
                            Win32.SetFileAttributesW(completo, 0x80);
                            Win32.DeleteFileW(completo);
                            continue;
                        }
                        if (filtro.Ignorar(nome, false)) continue;
                        long mod;
                        try { mod = DateTime.FromFileTimeUtc(d.ftLastWriteTime.Ticks).Ticks; } catch { mod = 0; }
                        lista.Add(new Entrada
                        {
                            Relativo = Juntar(rel, nome),
                            Completo = completo,
                            Tamanho = ((long)d.nFileSizeHigh << 32) | d.nFileSizeLow,
                            ModificadoUtc = mod,
                        });
                    }
                } while (Win32.FindNextFileW(h, out d));
            }
            finally { Win32.FindClose(h); }
        }

        static void ListarGerenciado(string pasta, string rel, List<Entrada> lista, Stack<KeyValuePair<string, string>> pilha,
            List<string> avisos, bool limparParciais, Filtro filtro)
        {
            FileSystemInfo[] itens;
            try { itens = new DirectoryInfo(pasta).GetFileSystemInfos(); }
            catch (Exception ex)
            {
                avisos.Add("Pasta não pôde ser lida: " + pasta + " (" + Mensagem(ex) + ")");
                return;
            }
            foreach (var i in itens)
            {
                if (i is DirectoryInfo)
                {
                    if (filtro.Ignorar(i.Name, true)) continue;
                    if ((i.Attributes & FileAttributes.ReparsePoint) != 0) { avisos.Add("Atalho de pasta ignorado: " + i.FullName); continue; }
                    pilha.Push(new KeyValuePair<string, string>(i.FullName, Juntar(rel, i.Name)));
                }
                else if (i is FileInfo f)
                {
                    if (limparParciais && f.Name.EndsWith(SufixoParcial, StringComparison.OrdinalIgnoreCase))
                    {
                        try { f.Attributes = FileAttributes.Normal; f.Delete(); } catch { }
                        continue;
                    }
                    if (filtro.Ignorar(f.Name, false)) continue;
                    lista.Add(new Entrada { Relativo = Juntar(rel, f.Name), Completo = f.FullName, Tamanho = f.Length, ModificadoUtc = f.LastWriteTimeUtc.Ticks });
                }
            }
        }

        // ------------------------------------------------------------------
        //  Cópia
        // ------------------------------------------------------------------

        static void CopiarSeguro(Entrada e, string destino, Progresso p, long bytesAntes)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(destino));
            string temp = destino + SufixoParcial;
            if (File.Exists(temp)) { File.SetAttributes(temp, FileAttributes.Normal); File.Delete(temp); }
            if (Caminhos.Windows) CopiarWin32(e.Completo, temp, p, bytesAntes);
            else CopiarStream(e.Completo, temp, p, bytesAntes);
            try { File.SetLastWriteTimeUtc(temp, new DateTime(e.ModificadoUtc, DateTimeKind.Utc)); } catch { }
            if (File.Exists(destino)) File.SetAttributes(destino, FileAttributes.Normal);
            if (Caminhos.Windows)
            {
                if (!Win32.MoveFileExW(temp, destino, Win32.MOVEFILE_REPLACE_EXISTING | Win32.MOVEFILE_COPY_ALLOWED))
                    throw new Win32Exception(Marshal.GetLastWin32Error());
            }
            else
            {
                if (File.Exists(destino)) File.Delete(destino);
                File.Move(temp, destino);
            }
        }

        static void CopiarWin32(string origem, string destino, Progresso p, long bytesAntes)
        {
            int cancelar = 0;
            Win32.CopyProgressRoutine rotina = (total, feito, a, b, c, d, e, f, g) =>
            {
                p.BytesFeitos = bytesAntes + feito;
                return p.Cancelar ? Win32.PROGRESS_CANCEL : Win32.PROGRESS_CONTINUE;
            };
            bool ok = Win32.CopyFileExW(origem, destino, rotina, IntPtr.Zero, ref cancelar, Win32.COPY_FILE_ALLOW_DECRYPTED_DESTINATION);
            int erro = Marshal.GetLastWin32Error();
            GC.KeepAlive(rotina);
            if (!ok)
            {
                if (erro == Win32.ERROR_REQUEST_ABORTED || p.Cancelar) throw new OperationCanceledException();
                throw new Win32Exception(erro);
            }
        }

        static void CopiarStream(string origem, string destino, Progresso p, long bytesAntes)
        {
            var buffer = new byte[1024 * 1024];
            using (var de = new FileStream(origem, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
            using (var para = new FileStream(destino, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                long feito = 0;
                int n;
                while ((n = de.Read(buffer, 0, buffer.Length)) > 0)
                {
                    if (p.Cancelar) { para.Dispose(); try { File.Delete(destino); } catch { } throw new OperationCanceledException(); }
                    para.Write(buffer, 0, n);
                    feito += n;
                    p.BytesFeitos = bytesAntes + feito;
                }
            }
        }
    }

    /// <summary>Histórico legível de cada backup (um arquivo .txt por backup).</summary>
    public static class Historico
    {
        public static void Gravar(string arquivo, string nome, string origem, string destino, Resultado r,
            List<string> copiados, List<string> erros, List<string> avisos)
        {
            if (string.IsNullOrWhiteSpace(arquivo) || r.Status == "indisponivel" || r.Status == "base") return;
            try
            {
                string nl = Environment.NewLine;
                var sb = new StringBuilder();
                string quando = r.Inicio.ToString("dd/MM/yyyy HH:mm");
                if (r.Status == "ok" && r.Copiados == 0)
                {
                    sb.Append(quando + "  " + nome + " - " + r.Mensagem + nl);
                }
                else
                {
                    sb.Append(nl + "===== " + quando + "  " + nome + " =====" + nl);
                    sb.Append("Origem : " + origem + nl);
                    sb.Append("Destino: " + destino + nl);
                    sb.Append("Resultado: " + r.Mensagem + nl);
                    const int limite = 3000;
                    for (int i = 0; i < Math.Min(limite, copiados.Count); i++) sb.Append("  " + copiados[i] + nl);
                    if (copiados.Count > limite) sb.Append("  ... e mais " + Textos.Numero(copiados.Count - limite) + " arquivo(s)" + nl);
                    if (erros.Count > 0)
                    {
                        sb.Append("Problemas:" + nl);
                        for (int i = 0; i < Math.Min(500, erros.Count); i++) sb.Append("  ! " + erros[i] + nl);
                    }
                    if (avisos.Count > 0)
                    {
                        sb.Append("Avisos:" + nl);
                        for (int i = 0; i < Math.Min(100, avisos.Count); i++) sb.Append("  - " + avisos[i] + nl);
                    }
                }
                if (File.Exists(arquivo) && new FileInfo(arquivo).Length > 3 * 1024 * 1024)
                {
                    string texto = File.ReadAllText(arquivo, Encoding.UTF8);
                    int corte = texto.IndexOf('\n', texto.Length / 2);
                    if (corte > 0) File.WriteAllText(arquivo, "(registros mais antigos foram apagados)" + nl + texto.Substring(corte + 1), new UTF8Encoding(true));
                }
                File.AppendAllText(arquivo, sb.ToString(), new UTF8Encoding(true));
            }
            catch (Exception ex)
            {
                Caminhos.LogErro("Falha ao gravar histórico: " + ex.Message);
            }
        }

        public static string Ler(string arquivo, int maxCaracteres = 400000)
        {
            if (!File.Exists(arquivo)) return "";
            string t = File.ReadAllText(arquivo, Encoding.UTF8);
            if (t.Length > maxCaracteres) t = "(mostrando só a parte mais recente)\r\n" + t.Substring(t.Length - maxCaracteres);
            return t;
        }
    }
}
