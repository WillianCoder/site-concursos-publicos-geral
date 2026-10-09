using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;

namespace BackupAutomatico.Nucleo
{
    /// <summary>Um backup configurado (uma pasta vinculada).</summary>
    public sealed class Trabalho
    {
        public const string FormatoData = "yyyy-MM-ddTHH:mm:ss";
        public static readonly string[] Unidades = { "minutos", "horas", "dias", "semanas", "meses", "anos" };

        public string Id = NovoId();
        public string Nome = "";
        public string Origem = "";
        public string DestinoBase = "";
        public bool CriarSubpasta = true;
        public string Modo = "novos";               // novos | alterados
        public int IntervaloValor = 1;
        public string IntervaloUnidade = "semanas";
        public DateTime Inicio = AgoraMinuto();
        public bool Ativo = true;
        public bool IgnorarExistentes;
        public DateTime? BaseRegistradaEm;
        public DateTime? UltimaExecucao;
        public string UltimoStatus;                  // ok | parcial | erro | indisponivel | cancelado | base
        public string UltimoResumo = "";
        public long UltimosCopiados;
        public long TotalCopiados;
        public DateTime? AguardarAte;
        public DateTime CriadoEm = AgoraMinuto();
        public string Exclusoes = "";               // padrões separados por ";" (ex.: *.tmp; node_modules)

        public static string NovoId() => Guid.NewGuid().ToString("N").Substring(0, 10);

        public static DateTime AgoraMinuto()
        {
            var a = DateTime.Now;
            return new DateTime(a.Year, a.Month, a.Day, a.Hour, a.Minute, 0);
        }

        public string DestinoFinal => Caminhos.DestinoFinal(this);

        public Trabalho Clonar()
        {
            return (Trabalho)MemberwiseClone();
        }

        public List<string> ListaExclusoes()
        {
            var l = new List<string>();
            foreach (string p in (Exclusoes ?? "").Split(new[] { ';', ',', '\n' }, StringSplitOptions.RemoveEmptyEntries))
            {
                string s = p.Trim();
                if (s != "") l.Add(s);
            }
            return l;
        }

        public Dictionary<string, object> ParaJson()
        {
            return new Dictionary<string, object>
            {
                ["id"] = Id,
                ["nome"] = Nome,
                ["origem"] = Origem,
                ["destinoBase"] = DestinoBase,
                ["criarSubpasta"] = CriarSubpasta,
                ["modo"] = Modo,
                ["intervaloValor"] = IntervaloValor,
                ["intervaloUnidade"] = IntervaloUnidade,
                ["inicio"] = Data(Inicio),
                ["ativo"] = Ativo,
                ["ignorarExistentes"] = IgnorarExistentes,
                ["baseRegistradaEm"] = Data(BaseRegistradaEm),
                ["ultimaExecucao"] = Data(UltimaExecucao),
                ["ultimoStatus"] = UltimoStatus,
                ["ultimoResumo"] = UltimoResumo,
                ["ultimosCopiados"] = UltimosCopiados,
                ["totalCopiados"] = TotalCopiados,
                ["aguardarAte"] = Data(AguardarAte),
                ["criadoEm"] = Data(CriadoEm),
                ["exclusoes"] = Exclusoes,
            };
        }

        public static Trabalho DeJson(IDictionary<string, object> o)
        {
            var t = new Trabalho();
            t.Id = Texto(o, "id", t.Id);
            if (t.Id == "") t.Id = NovoId();
            t.Nome = Texto(o, "nome", "");
            t.Origem = Texto(o, "origem", "");
            t.DestinoBase = Texto(o, "destinoBase", "");
            t.CriarSubpasta = Logico(o, "criarSubpasta", true);
            t.Modo = Texto(o, "modo", "novos") == "alterados" ? "alterados" : "novos";
            t.IntervaloValor = (int)Math.Max(1, Math.Min(9999, Numero(o, "intervaloValor", 1)));
            t.IntervaloUnidade = Texto(o, "intervaloUnidade", "semanas");
            if (Array.IndexOf(Unidades, t.IntervaloUnidade) < 0) t.IntervaloUnidade = "semanas";
            t.Inicio = LerData(o, "inicio") ?? AgoraMinuto();
            t.Ativo = Logico(o, "ativo", true);
            t.IgnorarExistentes = Logico(o, "ignorarExistentes", false);
            t.BaseRegistradaEm = LerData(o, "baseRegistradaEm");
            t.UltimaExecucao = LerData(o, "ultimaExecucao");
            t.UltimoStatus = o.TryGetValue("ultimoStatus", out var s) && s is string ss && ss != "" ? ss : null;
            t.UltimoResumo = Texto(o, "ultimoResumo", "");
            t.UltimosCopiados = Numero(o, "ultimosCopiados", 0);
            t.TotalCopiados = Numero(o, "totalCopiados", 0);
            t.AguardarAte = LerData(o, "aguardarAte");
            t.CriadoEm = LerData(o, "criadoEm") ?? AgoraMinuto();
            t.Exclusoes = Texto(o, "exclusoes", "");
            return t;
        }

        // ---- auxiliares de leitura ----

        public static string Data(DateTime? d) => d?.ToString(FormatoData, CultureInfo.InvariantCulture);

        public static DateTime? LerData(object v)
        {
            if (v is string s && s != "")
            {
                if (DateTime.TryParseExact(s, FormatoData, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)) return d;
                if (DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out d)) return d;
            }
            return null;
        }

        static DateTime? LerData(IDictionary<string, object> o, string k) => o.TryGetValue(k, out var v) ? LerData(v) : null;

        internal static string Texto(IDictionary<string, object> o, string k, string padrao)
        {
            if (!o.TryGetValue(k, out var v) || v == null) return padrao;
            return Convert.ToString(v, CultureInfo.InvariantCulture);
        }

        internal static bool Logico(IDictionary<string, object> o, string k, bool padrao)
        {
            if (!o.TryGetValue(k, out var v) || v == null) return padrao;
            if (v is bool b) return b;
            if (v is string s) return s == "true" || s == "1";
            try { return Convert.ToDouble(v, CultureInfo.InvariantCulture) != 0; } catch { return padrao; }
        }

        internal static long Numero(IDictionary<string, object> o, string k, long padrao)
        {
            if (!o.TryGetValue(k, out var v) || v == null) return padrao;
            try { return Convert.ToInt64(Convert.ToDouble(v, CultureInfo.InvariantCulture)); } catch { return padrao; }
        }
    }

    /// <summary>Configuração do programa (arquivo config.json na pasta de dados).</summary>
    public sealed class Configuracao
    {
        public bool IniciarComWindows = true;
        public bool Notificacoes = true;
        public string Tema = "auto";                 // auto | claro | escuro
        public bool NaoUsarBateria;
        public bool PausaGeral;
        public bool InstalacaoPerguntada;
        public List<Trabalho> Trabalhos = new List<Trabalho>();

        public static Configuracao Ler()
        {
            var cfg = new Configuracao();
            string arquivo = Caminhos.ArquivoConfig;
            foreach (string candidato in new[] { arquivo, arquivo + ".bak" })
            {
                if (!File.Exists(candidato)) continue;
                try
                {
                    string texto = File.ReadAllText(candidato, Encoding.UTF8);
                    if (texto.Trim() == "") continue;
                    if (Json.Ler(texto) is IDictionary<string, object> o)
                    {
                        cfg.IniciarComWindows = Trabalho.Logico(o, "iniciarComWindows", true);
                        cfg.Notificacoes = Trabalho.Logico(o, "notificacoes", true);
                        cfg.Tema = Trabalho.Texto(o, "tema", "auto");
                        if (cfg.Tema != "claro" && cfg.Tema != "escuro") cfg.Tema = "auto";
                        cfg.NaoUsarBateria = Trabalho.Logico(o, "naoUsarBateria", false);
                        cfg.PausaGeral = Trabalho.Logico(o, "pausaGeral", false);
                        cfg.InstalacaoPerguntada = Trabalho.Logico(o, "instalacaoPerguntada", false);
                        if (o.TryGetValue("trabalhos", out var lista) && lista is List<object> l)
                        {
                            foreach (var item in l)
                                if (item is IDictionary<string, object> d) cfg.Trabalhos.Add(Trabalho.DeJson(d));
                        }
                        return cfg;
                    }
                }
                catch (Exception ex)
                {
                    Caminhos.LogErro("Configuração ilegível em " + candidato + ": " + ex.Message);
                }
            }
            return cfg;
        }

        public void Salvar()
        {
            var trabalhos = new List<object>();
            foreach (var t in Trabalhos) trabalhos.Add(t.ParaJson());
            var o = new Dictionary<string, object>
            {
                ["versao"] = 2,
                ["programa"] = "Backup Automático " + Versao.Atual,
                ["iniciarComWindows"] = IniciarComWindows,
                ["notificacoes"] = Notificacoes,
                ["tema"] = Tema,
                ["naoUsarBateria"] = NaoUsarBateria,
                ["pausaGeral"] = PausaGeral,
                ["instalacaoPerguntada"] = InstalacaoPerguntada,
                ["trabalhos"] = trabalhos,
            };
            string arquivo = Caminhos.ArquivoConfig;
            string temp = arquivo + ".tmp";
            File.WriteAllText(temp, Json.Escrever(o), new UTF8Encoding(false));
            File.Copy(temp, arquivo, true);
            File.Copy(temp, arquivo + ".bak", true);   // cópia de segurança da última versão válida
            File.Delete(temp);
        }

        public Trabalho Achar(string id)
        {
            foreach (var t in Trabalhos) if (t.Id == id) return t;
            return null;
        }
    }

    public static class Versao
    {
        public const string Atual = "2.0.0";
    }
}
