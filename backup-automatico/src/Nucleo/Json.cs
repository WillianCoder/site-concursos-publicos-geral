using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace BackupAutomatico.Nucleo
{
    /// <summary>
    /// Leitor e escritor de JSON pequeno e sem dependências.
    /// Objetos viram Dictionary&lt;string, object&gt; (mantendo a ordem de inserção),
    /// listas viram List&lt;object&gt;, números inteiros viram long e os demais double.
    /// </summary>
    public static class Json
    {
        public static object Ler(string texto)
        {
            if (texto == null) throw new FormatException("JSON vazio.");
            var leitor = new Leitor(texto);
            leitor.PularEspacos();
            var valor = leitor.LerValor();
            leitor.PularEspacos();
            if (!leitor.Fim) throw new FormatException("Conteúdo inesperado depois do JSON.");
            return valor;
        }

        public static string Escrever(object valor)
        {
            var sb = new StringBuilder();
            EscreverValor(sb, valor, 0);
            return sb.ToString();
        }

        static void EscreverValor(StringBuilder sb, object valor, int nivel)
        {
            switch (valor)
            {
                case null:
                    sb.Append("null");
                    break;
                case string s:
                    EscreverTexto(sb, s);
                    break;
                case bool b:
                    sb.Append(b ? "true" : "false");
                    break;
                case int i:
                    sb.Append(i.ToString(CultureInfo.InvariantCulture));
                    break;
                case long l:
                    sb.Append(l.ToString(CultureInfo.InvariantCulture));
                    break;
                case double d:
                    sb.Append(d.ToString("R", CultureInfo.InvariantCulture));
                    break;
                case IDictionary<string, object> obj:
                    EscreverObjeto(sb, obj, nivel);
                    break;
                case IEnumerable lista:
                    EscreverLista(sb, lista, nivel);
                    break;
                default:
                    EscreverTexto(sb, Convert.ToString(valor, CultureInfo.InvariantCulture));
                    break;
            }
        }

        static void EscreverObjeto(StringBuilder sb, IDictionary<string, object> obj, int nivel)
        {
            if (obj.Count == 0) { sb.Append("{}"); return; }
            sb.Append("{\n");
            int i = 0;
            foreach (var par in obj)
            {
                sb.Append(' ', (nivel + 1) * 2);
                EscreverTexto(sb, par.Key);
                sb.Append(": ");
                EscreverValor(sb, par.Value, nivel + 1);
                if (++i < obj.Count) sb.Append(',');
                sb.Append('\n');
            }
            sb.Append(' ', nivel * 2).Append('}');
        }

        static void EscreverLista(StringBuilder sb, IEnumerable lista, int nivel)
        {
            var itens = new List<object>();
            foreach (var item in lista) itens.Add(item);
            if (itens.Count == 0) { sb.Append("[]"); return; }
            sb.Append("[\n");
            for (int i = 0; i < itens.Count; i++)
            {
                sb.Append(' ', (nivel + 1) * 2);
                EscreverValor(sb, itens[i], nivel + 1);
                if (i < itens.Count - 1) sb.Append(',');
                sb.Append('\n');
            }
            sb.Append(' ', nivel * 2).Append(']');
        }

        static void EscreverTexto(StringBuilder sb, string s)
        {
            sb.Append('"');
            foreach (char c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    case '\b': sb.Append("\\b"); break;
                    case '\f': sb.Append("\\f"); break;
                    default:
                        if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4"));
                        else sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
        }

        sealed class Leitor
        {
            readonly string t;
            int p;

            public Leitor(string texto)
            {
                t = texto;
                if (t.Length > 0 && t[0] == '﻿') p = 1;
            }

            public bool Fim => p >= t.Length;

            public void PularEspacos()
            {
                while (p < t.Length && char.IsWhiteSpace(t[p])) p++;
            }

            char Atual
            {
                get
                {
                    if (p >= t.Length) throw new FormatException("JSON terminou antes do esperado.");
                    return t[p];
                }
            }

            public object LerValor()
            {
                PularEspacos();
                char c = Atual;
                if (c == '{') return LerObjeto();
                if (c == '[') return LerLista();
                if (c == '"') return LerTexto();
                if (c == 't') { Esperar("true"); return true; }
                if (c == 'f') { Esperar("false"); return false; }
                if (c == 'n') { Esperar("null"); return null; }
                if (c == '-' || (c >= '0' && c <= '9')) return LerNumero();
                throw new FormatException("Caractere inesperado no JSON: " + c);
            }

            void Esperar(string palavra)
            {
                if (string.CompareOrdinal(t, p, palavra, 0, palavra.Length) != 0)
                    throw new FormatException("Esperado '" + palavra + "' no JSON.");
                p += palavra.Length;
            }

            Dictionary<string, object> LerObjeto()
            {
                var obj = new Dictionary<string, object>(StringComparer.Ordinal);
                p++;
                PularEspacos();
                if (Atual == '}') { p++; return obj; }
                while (true)
                {
                    PularEspacos();
                    if (Atual != '"') throw new FormatException("Esperado nome de campo no JSON.");
                    string chave = LerTexto();
                    PularEspacos();
                    if (Atual != ':') throw new FormatException("Esperado ':' no JSON.");
                    p++;
                    obj[chave] = LerValor();
                    PularEspacos();
                    char c = Atual;
                    p++;
                    if (c == '}') return obj;
                    if (c != ',') throw new FormatException("Esperado ',' ou '}' no JSON.");
                }
            }

            List<object> LerLista()
            {
                var lista = new List<object>();
                p++;
                PularEspacos();
                if (Atual == ']') { p++; return lista; }
                while (true)
                {
                    lista.Add(LerValor());
                    PularEspacos();
                    char c = Atual;
                    p++;
                    if (c == ']') return lista;
                    if (c != ',') throw new FormatException("Esperado ',' ou ']' no JSON.");
                }
            }

            string LerTexto()
            {
                p++;
                var sb = new StringBuilder();
                while (true)
                {
                    char c = Atual;
                    p++;
                    if (c == '"') return sb.ToString();
                    if (c != '\\') { sb.Append(c); continue; }
                    char e = Atual;
                    p++;
                    switch (e)
                    {
                        case '"': sb.Append('"'); break;
                        case '\\': sb.Append('\\'); break;
                        case '/': sb.Append('/'); break;
                        case 'b': sb.Append('\b'); break;
                        case 'f': sb.Append('\f'); break;
                        case 'n': sb.Append('\n'); break;
                        case 'r': sb.Append('\r'); break;
                        case 't': sb.Append('\t'); break;
                        case 'u':
                            if (p + 4 > t.Length) throw new FormatException("Escape \\u incompleto no JSON.");
                            sb.Append((char)int.Parse(t.Substring(p, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture));
                            p += 4;
                            break;
                        default: throw new FormatException("Escape inválido no JSON.");
                    }
                }
            }

            object LerNumero()
            {
                int inicio = p;
                if (t[p] == '-') p++;
                bool fracao = false;
                while (p < t.Length)
                {
                    char c = t[p];
                    if (c >= '0' && c <= '9') { p++; continue; }
                    if (c == '.' || c == 'e' || c == 'E' || c == '+' || c == '-') { fracao = true; p++; continue; }
                    break;
                }
                string s = t.Substring(inicio, p - inicio);
                if (!fracao && long.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out long l)) return l;
                return double.Parse(s, NumberStyles.Float, CultureInfo.InvariantCulture);
            }
        }
    }
}
