using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using BackupAutomatico.Nucleo;

namespace BackupAutomatico.Interface
{
    /// <summary>
    /// Estado da conta e do plano (Grátis, Pro ou Administrador).
    /// A sessão fica salva criptografada pelo Windows (DPAPI) só para este usuário.
    /// </summary>
    public static class Conta
    {
        public static Nuvem Nuvem = new Nuvem();
        public static Sessao Sessao;
        public static Licenca Licenca;
        public static ConfigApp App = new ConfigApp();
        public static Plano Plano = Plano.Gratis;
        public static bool Online;
        public static event Action Mudou;

        static readonly byte[] Entropia = Encoding.UTF8.GetBytes("BackupAutomatico.Conta.v2");
        const int DiasSemInternet = 15;

        public static bool Logado => Sessao != null;
        public static string Email => Sessao?.Email ?? "";

        static string ArquivoConfigApp => Path.Combine(Caminhos.PastaDados, "app-config.json");

        /// <summary>Carrega tudo: configuração online, sessão salva e licença.</summary>
        public static async Task Iniciar()
        {
            CarregarCacheConfigApp();
            CarregarSessaoSalva(out var cache);
            AplicarCache(cache);
            Mudou?.Invoke();
            try
            {
                Nuvem = await Nuvem.Carregar();
                await AtualizarConfigApp();
                if (Sessao != null) await AtualizarLicenca();
                Online = true;
            }
            catch (Exception ex)
            {
                Online = false;
                Caminhos.LogErro("Conta: " + ex.Message);
            }
            Mudou?.Invoke();
        }

        public static async Task AtualizarConfigApp()
        {
            if (!Nuvem.Configurada) return;
            try
            {
                App = await Nuvem.LerConfigApp();
                File.WriteAllText(ArquivoConfigApp, Json.Escrever(App.ParaFirestore()), new UTF8Encoding(false));
            }
            catch (Exception ex) { Caminhos.LogErro("Config do app: " + ex.Message); }
        }

        static void CarregarCacheConfigApp()
        {
            try
            {
                if (File.Exists(ArquivoConfigApp))
                    App = ConfigApp.DeDicionario(Json.Ler(File.ReadAllText(ArquivoConfigApp, Encoding.UTF8)) as IDictionary<string, object>);
            }
            catch { }
        }

        /// <summary>Confere a licença no servidor (e se a conta é a do administrador).</summary>
        public static async Task AtualizarLicenca()
        {
            if (Sessao == null) { Plano = Plano.Gratis; Licenca = null; Mudou?.Invoke(); return; }
            try
            {
                await Nuvem.Renovar(Sessao);
                if (Nuvem.EhAdmin(Sessao)) { Plano = Plano.Admin; Licenca = null; }
                else
                {
                    Licenca = await Nuvem.LerLicenca(Sessao);
                    Plano = Licenca != null && Licenca.Valida(DateTime.Now) ? Plano.Pro : Plano.Gratis;
                }
                Online = true;
                Salvar(DateTime.Now);
            }
            catch (ErroNuvem e) when (e.Codigo == "rede")
            {
                Online = false;   // sem internet: continua com o que estava salvo
            }
            catch (ErroNuvem e) when (e.Message.StartsWith("Sua sessão expirou"))
            {
                Sair();
            }
            Mudou?.Invoke();
        }

        public static async Task Entrar(string email, string senha)
        {
            Sessao = await Nuvem.Entrar(email, senha);
            Salvar(null);
            await AtualizarLicenca();
        }

        public static async Task CriarConta(string email, string senha)
        {
            Sessao = await Nuvem.CriarConta(email, senha);
            Salvar(null);
            await AtualizarLicenca();
        }

        public static void Sair()
        {
            Sessao = null;
            Licenca = null;
            Plano = Plano.Gratis;
            try { File.Delete(Caminhos.ArquivoConta); } catch { }
            Mudou?.Invoke();
        }

        public static void Avisar() => Mudou?.Invoke();

        // ---------------- Arquivo protegido ----------------

        sealed class Cache
        {
            public Plano Plano;
            public DateTime? ValidoAte;
            public DateTime? VerificadoEm;
        }

        static void Salvar(DateTime? verificadoEm)
        {
            if (Sessao == null) return;
            try
            {
                var o = new Dictionary<string, object>
                {
                    ["uid"] = Sessao.Uid,
                    ["email"] = Sessao.Email,
                    ["emailVerificado"] = Sessao.EmailVerificado,
                    ["refreshToken"] = Sessao.RefreshToken,
                    ["plano"] = Plano.ToString(),
                    ["validoAte"] = Trabalho.Data(Licenca?.ValidoAte),
                    ["verificadoEm"] = Trabalho.Data(verificadoEm),
                };
                byte[] dados = ProtectedData.Protect(Encoding.UTF8.GetBytes(Json.Escrever(o)), Entropia, DataProtectionScope.CurrentUser);
                File.WriteAllBytes(Caminhos.ArquivoConta, dados);
            }
            catch (Exception ex) { Caminhos.LogErro("Salvar conta: " + ex.Message); }
        }

        static void CarregarSessaoSalva(out Cache cache)
        {
            cache = null;
            try
            {
                if (!File.Exists(Caminhos.ArquivoConta)) return;
                byte[] dados = ProtectedData.Unprotect(File.ReadAllBytes(Caminhos.ArquivoConta), Entropia, DataProtectionScope.CurrentUser);
                var o = Json.Ler(Encoding.UTF8.GetString(dados)) as IDictionary<string, object>;
                if (o == null) return;
                Sessao = new Sessao
                {
                    Uid = Trabalho.Texto(o, "uid", ""),
                    Email = Trabalho.Texto(o, "email", ""),
                    EmailVerificado = Trabalho.Logico(o, "emailVerificado", false),
                    RefreshToken = Trabalho.Texto(o, "refreshToken", ""),
                };
                Enum.TryParse(Trabalho.Texto(o, "plano", "Gratis"), out Plano p);
                cache = new Cache
                {
                    Plano = p,
                    ValidoAte = Trabalho.LerData(o.TryGetValue("validoAte", out var v) ? v : null),
                    VerificadoEm = Trabalho.LerData(o.TryGetValue("verificadoEm", out var ve) ? ve : null),
                };
            }
            catch (Exception ex)
            {
                Caminhos.LogErro("Ler conta: " + ex.Message);
                Sessao = null;
            }
        }

        static void AplicarCache(Cache c)
        {
            Plano = Plano.Gratis;
            if (Sessao == null || c?.VerificadoEm == null) return;
            if ((DateTime.Now - c.VerificadoEm.Value).TotalDays > DiasSemInternet) return;
            if (c.Plano == Plano.Admin) Plano = Plano.Admin;
            else if (c.Plano == Plano.Pro && (c.ValidoAte == null || c.ValidoAte > DateTime.Now))
            {
                Plano = Plano.Pro;
                Licenca = new Licenca { Uid = Sessao.Uid, Email = Sessao.Email, ValidoAte = c.ValidoAte };
            }
        }

        public static string NomePlano(Plano p) => p == Plano.Admin ? "Administrador" : p == Plano.Pro ? "Pro" : "Grátis";
    }
}
