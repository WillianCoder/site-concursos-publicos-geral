using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace BackupAutomatico.Nucleo
{
    public enum Plano { Gratis, Pro, Admin }

    /// <summary>Um plano pago à venda (definido pelo administrador).</summary>
    public sealed class OfertaPlano
    {
        public string Nome = "";
        public double Valor;
        public int Meses;   // 0 = vitalício

        public string Descricao => Meses == 0 ? "sem vencimento" : Meses == 1 ? "1 mês" : Meses + " meses";
    }

    /// <summary>Configuração pública do programa, editada só pelo administrador (Firestore: backupApp/config).</summary>
    public sealed class ConfigApp
    {
        public string PixChave = "", PixNome = "", PixCidade = "";
        public List<double> PixValores = new List<double> { 5, 10, 20, 50 };
        public string MensagemDoacao = "Gostou do Backup Automático? Ajude a manter o projeto com qualquer valor.";
        public int LimiteGratis = 2;
        public List<OfertaPlano> Planos = new List<OfertaPlano>
        {
            new OfertaPlano { Nome = "Pro mensal", Valor = 9.90, Meses = 1 },
            new OfertaPlano { Nome = "Pro anual", Valor = 59.90, Meses = 12 },
            new OfertaPlano { Nome = "Pro vitalício", Valor = 99.90, Meses = 0 },
        };
        public string ContatoWhatsapp = "", ContatoEmail = "";

        public bool PixConfigurado => !string.IsNullOrWhiteSpace(PixChave);

        public Dictionary<string, object> ParaFirestore()
        {
            var planos = new List<object>();
            foreach (var p in Planos) planos.Add(new Dictionary<string, object> { ["nome"] = p.Nome, ["valor"] = p.Valor, ["meses"] = (long)p.Meses });
            var valores = new List<object>();
            foreach (var v in PixValores) valores.Add(v);
            return new Dictionary<string, object>
            {
                ["pixChave"] = PixChave, ["pixNome"] = PixNome, ["pixCidade"] = PixCidade, ["pixValores"] = valores,
                ["mensagemDoacao"] = MensagemDoacao, ["limiteGratis"] = (long)LimiteGratis, ["planos"] = planos,
                ["contatoWhatsapp"] = ContatoWhatsapp, ["contatoEmail"] = ContatoEmail,
            };
        }

        public static ConfigApp DeDicionario(IDictionary<string, object> o)
        {
            var c = new ConfigApp();
            if (o == null) return c;
            c.PixChave = Trabalho.Texto(o, "pixChave", "");
            c.PixNome = Trabalho.Texto(o, "pixNome", "");
            c.PixCidade = Trabalho.Texto(o, "pixCidade", "");
            c.MensagemDoacao = Trabalho.Texto(o, "mensagemDoacao", c.MensagemDoacao);
            c.LimiteGratis = (int)Math.Max(0, Trabalho.Numero(o, "limiteGratis", 2));
            c.ContatoWhatsapp = Trabalho.Texto(o, "contatoWhatsapp", "");
            c.ContatoEmail = Trabalho.Texto(o, "contatoEmail", "");
            if (o.TryGetValue("pixValores", out var vs) && vs is List<object> lv)
            {
                c.PixValores = new List<double>();
                foreach (var v in lv) try { c.PixValores.Add(Convert.ToDouble(v, CultureInfo.InvariantCulture)); } catch { }
            }
            if (o.TryGetValue("planos", out var ps) && ps is List<object> lp)
            {
                c.Planos = new List<OfertaPlano>();
                foreach (var p in lp)
                    if (p is IDictionary<string, object> d)
                        c.Planos.Add(new OfertaPlano
                        {
                            Nome = Trabalho.Texto(d, "nome", "Pro"),
                            Valor = Convert.ToDouble(d.TryGetValue("valor", out var vv) && vv != null ? vv : 0, CultureInfo.InvariantCulture),
                            Meses = (int)Trabalho.Numero(d, "meses", 0),
                        });
            }
            return c;
        }
    }

    public sealed class Licenca
    {
        public string Uid = "", Email = "", Plano = "pro", Observacao = "";
        public DateTime? ValidoAte;          // null = sem vencimento
        public DateTime? AtualizadoEm;

        public bool Valida(DateTime agora) => Plano == "pro" && (ValidoAte == null || ValidoAte.Value > agora);
    }

    public sealed class Pedido
    {
        public string Id = "", Uid = "", Email = "", Plano = "", Codigo = "", Status = "aguardando";
        public double Valor;
        public int Meses;
        public DateTime? CriadoEm;
    }

    /// <summary>Sessão de uma conta (Firebase Authentication).</summary>
    public sealed class Sessao
    {
        public string Uid = "", Email = "", IdToken = "", RefreshToken = "";
        public bool EmailVerificado;
        public DateTime ExpiraEm;
    }

    public sealed class ErroNuvem : Exception
    {
        public readonly string Codigo;
        public ErroNuvem(string codigo, string mensagem) : base(mensagem) { Codigo = codigo; }
    }

    /// <summary>
    /// Conexão com o Firebase do site (contas, licenças, Pix e pedidos).
    /// As permissões são garantidas pelas regras do Firestore no servidor: este
    /// código só pede; quem decide o que cada conta pode ler ou alterar é o Firebase.
    /// </summary>
    public sealed class Nuvem
    {
        /// <summary>De onde vem a configuração do Firebase: o mesmo config.js do site.</summary>
        public const string UrlConfigSite = "https://raw.githubusercontent.com/WillianCoder/site-concursos-publicos-geral/main/assets/js/config.js";

        public string ApiKey = "", ProjectId = "", AdminEmail = "";
        public ConfigApp PixDoSite;   // Pix do site, usado se o administrador ainda não configurou o do programa
        public bool Configurada => ApiKey != "" && ProjectId != "";

        static readonly HttpClient http = CriarHttp();

        static HttpClient CriarHttp()
        {
            var h = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };
            h.DefaultRequestHeaders.UserAgent.ParseAdd("BackupAutomatico/" + Versao.Atual);
            return h;
        }

        // ------------------------------------------------------------------
        //  Configuração (config.js do site)
        // ------------------------------------------------------------------

        public static Nuvem DoTextoConfigSite(string js)
        {
            var n = new Nuvem();
            int ini = js.IndexOf('{', Math.Max(0, js.IndexOf("ATLAS_CONFIG", StringComparison.Ordinal)));
            int fim = js.LastIndexOf('}');
            if (ini < 0 || fim <= ini) throw new FormatException("config.js do site em formato inesperado.");
            var o = Json.Ler(js.Substring(ini, fim - ini + 1)) as IDictionary<string, object>;
            if (o == null) throw new FormatException("config.js do site em formato inesperado.");
            if (o.TryGetValue("firebase", out var fb) && fb is IDictionary<string, object> f)
            {
                n.ApiKey = Trabalho.Texto(f, "apiKey", "").Trim();
                n.ProjectId = Trabalho.Texto(f, "projectId", "").Trim();
            }
            n.AdminEmail = Trabalho.Texto(o, "adminEmail", "").Trim();
            if (o.TryGetValue("pix", out var px) && px is IDictionary<string, object> p)
            {
                var c = new ConfigApp
                {
                    PixChave = Trabalho.Texto(p, "chave", ""),
                    PixNome = Trabalho.Texto(p, "nome", ""),
                    PixCidade = Trabalho.Texto(p, "cidade", ""),
                };
                if (p.TryGetValue("valores", out var vs) && vs is List<object> lv)
                {
                    c.PixValores = new List<double>();
                    foreach (var v in lv) try { c.PixValores.Add(Convert.ToDouble(v, CultureInfo.InvariantCulture)); } catch { }
                }
                n.PixDoSite = c;
            }
            return n;
        }

        /// <summary>Baixa a configuração do site; sem internet, usa a última salva.</summary>
        public static async Task<Nuvem> Carregar()
        {
            string url = Environment.GetEnvironmentVariable("BACKUPAUTO_CONFIG_URL");
            if (string.IsNullOrEmpty(url)) url = UrlConfigSite;
            string cache = Caminhos.ArquivoNuvemCache;
            try
            {
                string js = url.StartsWith("http", StringComparison.OrdinalIgnoreCase)
                    ? await http.GetStringAsync(url).ConfigureAwait(false)
                    : File.ReadAllText(url, Encoding.UTF8);
                var n = DoTextoConfigSite(js);
                try { File.WriteAllText(cache, js, new UTF8Encoding(false)); } catch { }
                return n;
            }
            catch (Exception ex)
            {
                Caminhos.LogErro("Configuração online indisponível: " + ex.Message);
                try { if (File.Exists(cache)) return DoTextoConfigSite(File.ReadAllText(cache, Encoding.UTF8)); } catch { }
                return new Nuvem();
            }
        }

        public bool EhAdmin(Sessao s) =>
            s != null && s.EmailVerificado && AdminEmail != "" && string.Equals(s.Email, AdminEmail, StringComparison.OrdinalIgnoreCase);

        // ------------------------------------------------------------------
        //  Contas
        // ------------------------------------------------------------------

        async Task<IDictionary<string, object>> Postar(string url, object corpo, string token = null)
        {
            using (var req = new HttpRequestMessage(HttpMethod.Post, url))
            {
                req.Content = new StringContent(Json.Escrever(corpo), Encoding.UTF8, "application/json");
                if (token != null) req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
                return await Enviar(req).ConfigureAwait(false) as IDictionary<string, object>;
            }
        }

        static async Task<object> Enviar(HttpRequestMessage req)
        {
            HttpResponseMessage resp;
            try { resp = await http.SendAsync(req).ConfigureAwait(false); }
            catch (Exception ex) { throw new ErroNuvem("rede", "Sem conexão com a internet (ou o servidor não respondeu). " + Motor.Mensagem(ex)); }
            using (resp)
            {
                string texto = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                object o = null;
                try { if (!string.IsNullOrWhiteSpace(texto)) o = Json.Ler(texto); } catch { }
                if (resp.IsSuccessStatusCode) return o;
                string codigo = "";
                if (o is IDictionary<string, object> d && d.TryGetValue("error", out var e))
                {
                    if (e is IDictionary<string, object> ed) codigo = Trabalho.Texto(ed, "message", "") + "|" + Trabalho.Texto(ed, "status", "");
                    else codigo = Convert.ToString(e, CultureInfo.InvariantCulture);
                }
                if (codigo == "") codigo = ((int)resp.StatusCode).ToString(CultureInfo.InvariantCulture);
                throw new ErroNuvem(codigo, TraduzirErro(codigo, (int)resp.StatusCode));
            }
        }

        public static string TraduzirErro(string codigo, int status)
        {
            string c = (codigo ?? "").ToUpperInvariant();
            if (c.StartsWith("EMAIL_EXISTS")) return "Já existe uma conta com este e-mail. Use \"Entrar\".";
            if (c.StartsWith("INVALID_LOGIN_CREDENTIALS") || c.StartsWith("INVALID_PASSWORD") || c.StartsWith("EMAIL_NOT_FOUND"))
                return "E-mail ou senha incorretos.";
            if (c.StartsWith("WEAK_PASSWORD")) return "A senha precisa ter pelo menos 6 caracteres.";
            if (c.StartsWith("INVALID_EMAIL")) return "E-mail inválido.";
            if (c.StartsWith("TOO_MANY_ATTEMPTS")) return "Muitas tentativas. Espere alguns minutos e tente de novo.";
            if (c.StartsWith("USER_DISABLED")) return "Esta conta foi desativada.";
            if (c.Contains("TOKEN_EXPIRED") || c.Contains("INVALID_REFRESH_TOKEN") || c.Contains("INVALID_ID_TOKEN") || c.Contains("USER_NOT_FOUND"))
                return "Sua sessão expirou. Entre de novo.";
            if (c.Contains("PERMISSION_DENIED") || status == 403)
                return "Sem permissão. (Se você é o administrador: confirme o e-mail e publique as regras do Firestore pelo painel do site.)";
            if (c.Contains("NOT_FOUND") || status == 404) return "Não encontrado.";
            return "Erro do servidor (" + codigo + ").";
        }

        static Sessao LerSessao(IDictionary<string, object> r, Sessao anterior = null)
        {
            var s = anterior ?? new Sessao();
            s.IdToken = Trabalho.Texto(r, "idToken", Trabalho.Texto(r, "id_token", ""));
            s.RefreshToken = Trabalho.Texto(r, "refreshToken", Trabalho.Texto(r, "refresh_token", s.RefreshToken));
            s.Uid = Trabalho.Texto(r, "localId", Trabalho.Texto(r, "user_id", s.Uid));
            if (r.ContainsKey("email")) s.Email = Trabalho.Texto(r, "email", s.Email);
            long seg = Trabalho.Numero(r, "expiresIn", Trabalho.Numero(r, "expires_in", 3600));
            s.ExpiraEm = DateTime.UtcNow.AddSeconds(Math.Max(60, seg - 60));
            return s;
        }

        string UrlAuth(string acao) => "https://identitytoolkit.googleapis.com/v1/accounts:" + acao + "?key=" + Uri.EscapeDataString(ApiKey);

        void ExigirConfig()
        {
            if (!Configurada) throw new ErroNuvem("sem-config", "As contas ainda não estão disponíveis: o administrador precisa configurar o Firebase no painel do site.");
        }

        public async Task<Sessao> Entrar(string email, string senha)
        {
            ExigirConfig();
            var r = await Postar(UrlAuth("signInWithPassword"), new Dictionary<string, object> { ["email"] = email.Trim(), ["password"] = senha, ["returnSecureToken"] = true }).ConfigureAwait(false);
            var s = LerSessao(r);
            await AtualizarDadosConta(s).ConfigureAwait(false);
            return s;
        }

        public async Task<Sessao> CriarConta(string email, string senha)
        {
            ExigirConfig();
            var r = await Postar(UrlAuth("signUp"), new Dictionary<string, object> { ["email"] = email.Trim(), ["password"] = senha, ["returnSecureToken"] = true }).ConfigureAwait(false);
            var s = LerSessao(r);
            try { await EnviarVerificacao(s).ConfigureAwait(false); } catch { }
            return s;
        }

        public Task EnviarVerificacao(Sessao s) =>
            Postar(UrlAuth("sendOobCode"), new Dictionary<string, object> { ["requestType"] = "VERIFY_EMAIL", ["idToken"] = s.IdToken });

        public Task RecuperarSenha(string email)
        {
            ExigirConfig();
            return Postar(UrlAuth("sendOobCode"), new Dictionary<string, object> { ["requestType"] = "PASSWORD_RESET", ["email"] = email.Trim() });
        }

        public async Task AtualizarDadosConta(Sessao s)
        {
            var r = await Postar(UrlAuth("lookup"), new Dictionary<string, object> { ["idToken"] = s.IdToken }).ConfigureAwait(false);
            if (r != null && r.TryGetValue("users", out var us) && us is List<object> l && l.Count > 0 && l[0] is IDictionary<string, object> u)
            {
                s.Email = Trabalho.Texto(u, "email", s.Email);
                s.EmailVerificado = Trabalho.Logico(u, "emailVerified", false);
            }
        }

        /// <summary>Garante um token válido (renova com o refresh token quando expira).</summary>
        public async Task Renovar(Sessao s, bool forcar = false)
        {
            ExigirConfig();
            if (!forcar && s.IdToken != "" && DateTime.UtcNow < s.ExpiraEm) return;
            using (var req = new HttpRequestMessage(HttpMethod.Post, "https://securetoken.googleapis.com/v1/token?key=" + Uri.EscapeDataString(ApiKey)))
            {
                req.Content = new FormUrlEncodedContent(new[]
                {
                    new KeyValuePair<string, string>("grant_type", "refresh_token"),
                    new KeyValuePair<string, string>("refresh_token", s.RefreshToken),
                });
                var r = await Enviar(req).ConfigureAwait(false) as IDictionary<string, object>;
                LerSessao(r, s);
            }
            await AtualizarDadosConta(s).ConfigureAwait(false);
        }

        // ------------------------------------------------------------------
        //  Firestore
        // ------------------------------------------------------------------

        string UrlDocs => "https://firestore.googleapis.com/v1/projects/" + Uri.EscapeDataString(ProjectId) + "/databases/(default)/documents";

        async Task<object> Firestore(HttpMethod metodo, string caminho, object corpo, Sessao s)
        {
            ExigirConfig();
            if (s != null) await Renovar(s).ConfigureAwait(false);
            using (var req = new HttpRequestMessage(metodo, UrlDocs + caminho))
            {
                if (corpo != null) req.Content = new StringContent(Json.Escrever(corpo), Encoding.UTF8, "application/json");
                if (s != null) req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", s.IdToken);
                return await Enviar(req).ConfigureAwait(false);
            }
        }

        public async Task<ConfigApp> LerConfigApp()
        {
            try
            {
                var d = await Firestore(HttpMethod.Get, "/backupApp/config", null, null).ConfigureAwait(false) as IDictionary<string, object>;
                var c = ConfigApp.DeDicionario(DeDocumento(d));
                if (!c.PixConfigurado && PixDoSite != null) { c.PixChave = PixDoSite.PixChave; c.PixNome = PixDoSite.PixNome; c.PixCidade = PixDoSite.PixCidade; }
                return c;
            }
            catch (ErroNuvem e) when (e.Codigo.Contains("NOT_FOUND") || e.Codigo == "404")
            {
                var c = new ConfigApp();
                if (PixDoSite != null) { c.PixChave = PixDoSite.PixChave; c.PixNome = PixDoSite.PixNome; c.PixCidade = PixDoSite.PixCidade; c.PixValores = PixDoSite.PixValores; }
                return c;
            }
        }

        public Task SalvarConfigApp(ConfigApp c, Sessao admin) =>
            Firestore(new HttpMethod("PATCH"), "/backupApp/config", ParaDocumento(c.ParaFirestore()), admin);

        public async Task<Licenca> LerLicenca(Sessao s)
        {
            try
            {
                var d = await Firestore(HttpMethod.Get, "/backupLicencas/" + Uri.EscapeDataString(s.Uid), null, s).ConfigureAwait(false) as IDictionary<string, object>;
                return LicencaDe(s.Uid, DeDocumento(d));
            }
            catch (ErroNuvem e) when (e.Codigo.Contains("NOT_FOUND") || e.Codigo == "404") { return null; }
        }

        static Licenca LicencaDe(string uid, IDictionary<string, object> o)
        {
            return new Licenca
            {
                Uid = uid,
                Email = Trabalho.Texto(o, "email", ""),
                Plano = Trabalho.Texto(o, "plano", "pro"),
                Observacao = Trabalho.Texto(o, "observacao", ""),
                ValidoAte = o.TryGetValue("validoAte", out var v) ? v as DateTime? : null,
                AtualizadoEm = o.TryGetValue("atualizadoEm", out var a) ? a as DateTime? : null,
            };
        }

        public async Task<List<Licenca>> ListarLicencas(Sessao admin)
        {
            var r = new List<Licenca>();
            var d = await Firestore(HttpMethod.Get, "/backupLicencas?pageSize=300", null, admin).ConfigureAwait(false) as IDictionary<string, object>;
            if (d != null && d.TryGetValue("documents", out var docs) && docs is List<object> l)
                foreach (var doc in l)
                    if (doc is IDictionary<string, object> dd) r.Add(LicencaDe(IdDoc(dd), DeDocumento(dd)));
            r.Sort((a, b) => string.Compare(a.Email, b.Email, StringComparison.OrdinalIgnoreCase));
            return r;
        }

        public Task SalvarLicenca(Licenca l, Sessao admin)
        {
            var o = new Dictionary<string, object>
            {
                ["email"] = l.Email, ["plano"] = l.Plano, ["observacao"] = l.Observacao,
                ["validoAte"] = l.ValidoAte.HasValue ? (object)l.ValidoAte.Value.ToUniversalTime() : null,
                ["atualizadoEm"] = DateTime.UtcNow,
            };
            return Firestore(new HttpMethod("PATCH"), "/backupLicencas/" + Uri.EscapeDataString(l.Uid), ParaDocumento(o), admin);
        }

        public Task CriarPedido(Pedido p, Sessao s)
        {
            var o = new Dictionary<string, object>
            {
                ["uid"] = s.Uid, ["email"] = s.Email, ["plano"] = p.Plano, ["valor"] = p.Valor,
                ["meses"] = (long)p.Meses, ["codigo"] = p.Codigo, ["status"] = "aguardando", ["criadoEm"] = DateTime.UtcNow,
            };
            return Firestore(HttpMethod.Post, "/backupPedidos", ParaDocumento(o), s);
        }

        public async Task<List<Pedido>> ListarPedidos(Sessao s, bool todos)
        {
            var sq = new Dictionary<string, object>
            {
                ["from"] = new List<object> { new Dictionary<string, object> { ["collectionId"] = "backupPedidos" } },
            };
            if (!todos)
                sq["where"] = new Dictionary<string, object>
                {
                    ["fieldFilter"] = new Dictionary<string, object>
                    {
                        ["field"] = new Dictionary<string, object> { ["fieldPath"] = "uid" },
                        ["op"] = "EQUAL",
                        ["value"] = new Dictionary<string, object> { ["stringValue"] = s.Uid },
                    },
                };
            sq["limit"] = 300L;
            var consulta = new Dictionary<string, object> { ["structuredQuery"] = sq };
            var r = new List<Pedido>();
            var lista = await Firestore(HttpMethod.Post, ":runQuery", consulta, s).ConfigureAwait(false) as List<object>;
            if (lista != null)
                foreach (var item in lista)
                    if (item is IDictionary<string, object> it && it.TryGetValue("document", out var doc) && doc is IDictionary<string, object> dd)
                    {
                        var o = DeDocumento(dd);
                        r.Add(new Pedido
                        {
                            Id = IdDoc(dd),
                            Uid = Trabalho.Texto(o, "uid", ""),
                            Email = Trabalho.Texto(o, "email", ""),
                            Plano = Trabalho.Texto(o, "plano", ""),
                            Codigo = Trabalho.Texto(o, "codigo", ""),
                            Status = Trabalho.Texto(o, "status", "aguardando"),
                            Valor = o.TryGetValue("valor", out var v) && v != null ? Convert.ToDouble(v, CultureInfo.InvariantCulture) : 0,
                            Meses = (int)Trabalho.Numero(o, "meses", 0),
                            CriadoEm = o.TryGetValue("criadoEm", out var c) ? c as DateTime? : null,
                        });
                    }
            r.Sort((a, b) => Nullable.Compare(b.CriadoEm, a.CriadoEm));
            return r;
        }

        public Task MudarStatusPedido(Pedido p, string status, Sessao admin) =>
            Firestore(new HttpMethod("PATCH"), "/backupPedidos/" + Uri.EscapeDataString(p.Id) + "?updateMask.fieldPaths=status",
                ParaDocumento(new Dictionary<string, object> { ["status"] = status }), admin);

        /// <summary>Confirma o acesso de administrador lendo um documento que só ele pode ler.</summary>
        public async Task<bool> ConfirmarAdmin(Sessao s)
        {
            try { await Firestore(HttpMethod.Get, "/backupLicencas?pageSize=1", null, s).ConfigureAwait(false); return true; }
            catch (ErroNuvem) { return false; }
        }

        // ------------------------------------------------------------------
        //  Conversão para o formato de documento do Firestore
        // ------------------------------------------------------------------

        static string IdDoc(IDictionary<string, object> doc)
        {
            string nome = Trabalho.Texto(doc, "name", "");
            int i = nome.LastIndexOf('/');
            return i >= 0 ? nome.Substring(i + 1) : nome;
        }

        public static Dictionary<string, object> ParaDocumento(IDictionary<string, object> campos)
        {
            var f = new Dictionary<string, object>();
            foreach (var par in campos) f[par.Key] = ParaValor(par.Value);
            return new Dictionary<string, object> { ["fields"] = f };
        }

        static Dictionary<string, object> ParaValor(object v)
        {
            switch (v)
            {
                case null: return new Dictionary<string, object> { ["nullValue"] = null };
                case string s: return new Dictionary<string, object> { ["stringValue"] = s };
                case bool b: return new Dictionary<string, object> { ["booleanValue"] = b };
                case int i: return new Dictionary<string, object> { ["integerValue"] = i.ToString(CultureInfo.InvariantCulture) };
                case long l: return new Dictionary<string, object> { ["integerValue"] = l.ToString(CultureInfo.InvariantCulture) };
                case double d: return new Dictionary<string, object> { ["doubleValue"] = d };
                case DateTime dt:
                    return new Dictionary<string, object> { ["timestampValue"] = dt.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fff'Z'", CultureInfo.InvariantCulture) };
                case IDictionary<string, object> m:
                {
                    var f = new Dictionary<string, object>();
                    foreach (var par in m) f[par.Key] = ParaValor(par.Value);
                    return new Dictionary<string, object> { ["mapValue"] = new Dictionary<string, object> { ["fields"] = f } };
                }
                case System.Collections.IEnumerable lista:
                {
                    var vals = new List<object>();
                    foreach (var item in lista) vals.Add(ParaValor(item));
                    return new Dictionary<string, object> { ["arrayValue"] = new Dictionary<string, object> { ["values"] = vals } };
                }
                default: return new Dictionary<string, object> { ["stringValue"] = Convert.ToString(v, CultureInfo.InvariantCulture) };
            }
        }

        public static Dictionary<string, object> DeDocumento(IDictionary<string, object> doc)
        {
            var r = new Dictionary<string, object>();
            if (doc != null && doc.TryGetValue("fields", out var f) && f is IDictionary<string, object> campos)
                foreach (var par in campos) r[par.Key] = DeValor(par.Value as IDictionary<string, object>);
            return r;
        }

        static object DeValor(IDictionary<string, object> v)
        {
            if (v == null) return null;
            if (v.TryGetValue("stringValue", out var s)) return s;
            if (v.TryGetValue("booleanValue", out var b)) return b;
            if (v.TryGetValue("integerValue", out var i)) return long.Parse(Convert.ToString(i, CultureInfo.InvariantCulture), CultureInfo.InvariantCulture);
            if (v.TryGetValue("doubleValue", out var d)) return Convert.ToDouble(d, CultureInfo.InvariantCulture);
            if (v.TryGetValue("timestampValue", out var t))
                return DateTime.Parse(Convert.ToString(t, CultureInfo.InvariantCulture), CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal).ToLocalTime();
            if (v.TryGetValue("mapValue", out var m) && m is IDictionary<string, object> mm)
                return DeDocumento(mm);
            if (v.TryGetValue("arrayValue", out var a))
            {
                var l = new List<object>();
                if (a is IDictionary<string, object> aa && aa.TryGetValue("values", out var vs) && vs is List<object> lv)
                    foreach (var x in lv) l.Add(DeValor(x as IDictionary<string, object>));
                return l;
            }
            return null;
        }

        /// <summary>Código curto e legível para identificar um pedido no Pix (ex.: BKP7F3K2Q).</summary>
        public static string NovoCodigoPedido()
        {
            const string letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
            var rnd = new byte[6];
            using (var g = System.Security.Cryptography.RandomNumberGenerator.Create()) g.GetBytes(rnd);
            var sb = new StringBuilder("BKP");
            foreach (byte b in rnd) sb.Append(letras[b % letras.Length]);
            return sb.ToString();
        }
    }

    /// <summary>
    /// O que cada plano pode usar. A versão gratuita já faz backups automáticos de
    /// verdade; o Pro libera recursos extras e pastas ilimitadas.
    /// </summary>
    public static class Recursos
    {
        public static int LimitePastas(Plano p, ConfigApp c) => p == Plano.Gratis ? Math.Max(1, c?.LimiteGratis ?? 2) : int.MaxValue;
        public static bool ModoModificados(Plano p) => p != Plano.Gratis;
        public static bool IgnorarExistentes(Plano p) => p != Plano.Gratis;
        public static bool ExclusoesPersonalizadas(Plano p) => p != Plano.Gratis;
        public static bool IntervaloEmMinutos(Plano p) => p != Plano.Gratis;

        public static readonly string[] ListaPro =
        {
            "Pastas ilimitadas (a versão grátis tem um limite)",
            "Copiar também arquivos modificados",
            "Copiar só o que for adicionado daqui pra frente",
            "Ignorar arquivos e pastas por nome (ex.: *.tmp, Cache)",
            "Backups a cada poucos minutos",
        };
    }
}
