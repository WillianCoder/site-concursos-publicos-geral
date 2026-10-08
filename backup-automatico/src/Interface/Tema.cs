using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Win32;

namespace BackupAutomatico.Interface
{
    public sealed class Paleta
    {
        public bool Escuro;
        public Color Fundo, Superficie, SuperficieAlt, Hover, Borda, BordaForte, Texto, TextoSuave, TextoFraco;
        public Color Destaque, DestaqueHover, DestaquePressionado, DestaqueSuave, TextoNoDestaque;
        public Color Ok, OkSuave, Aviso, AvisoSuave, Erro, ErroSuave, Pausado, PausadoSuave, Pro, ProSuave;
        public Color Campo, CampoBorda, Sombra;
    }

    /// <summary>Cores, fontes, escala de DPI, ícones e o tema claro/escuro.</summary>
    public static class Tema
    {
        public static readonly Paleta Clara = new Paleta
        {
            Escuro = false,
            Fundo = Cor("#F3F6FA"), Superficie = Cor("#FFFFFF"), SuperficieAlt = Cor("#F8FAFC"), Hover = Cor("#EEF2F7"),
            Borda = Cor("#E2E8F0"), BordaForte = Cor("#CBD5E1"), Texto = Cor("#0F172A"), TextoSuave = Cor("#64748B"), TextoFraco = Cor("#94A3B8"),
            Destaque = Cor("#2563EB"), DestaqueHover = Cor("#1D4ED8"), DestaquePressionado = Cor("#1E40AF"), DestaqueSuave = Cor("#DBEAFE"), TextoNoDestaque = Color.White,
            Ok = Cor("#15803D"), OkSuave = Cor("#DCFCE7"), Aviso = Cor("#B45309"), AvisoSuave = Cor("#FEF3C7"),
            Erro = Cor("#B91C1C"), ErroSuave = Cor("#FEE2E2"), Pausado = Cor("#64748B"), PausadoSuave = Cor("#E2E8F0"),
            Pro = Cor("#7C3AED"), ProSuave = Cor("#EDE9FE"),
            Campo = Cor("#FFFFFF"), CampoBorda = Cor("#CBD5E1"), Sombra = Color.FromArgb(18, 15, 23, 42),
        };

        public static readonly Paleta Escura = new Paleta
        {
            Escuro = true,
            Fundo = Cor("#0B1120"), Superficie = Cor("#151E2E"), SuperficieAlt = Cor("#1B2638"), Hover = Cor("#223049"),
            Borda = Cor("#26324A"), BordaForte = Cor("#33415C"), Texto = Cor("#E5EAF2"), TextoSuave = Cor("#97A3B6"), TextoFraco = Cor("#64748B"),
            Destaque = Cor("#3B82F6"), DestaqueHover = Cor("#60A5FA"), DestaquePressionado = Cor("#2563EB"), DestaqueSuave = Cor("#1E3A6B"), TextoNoDestaque = Color.White,
            Ok = Cor("#4ADE80"), OkSuave = Cor("#123824"), Aviso = Cor("#FBBF24"), AvisoSuave = Cor("#3B2A0A"),
            Erro = Cor("#F87171"), ErroSuave = Cor("#3F1515"), Pausado = Cor("#94A3B8"), PausadoSuave = Cor("#26324A"),
            Pro = Cor("#A78BFA"), ProSuave = Cor("#2E1F5B"),
            Campo = Cor("#0F1726"), CampoBorda = Cor("#33415C"), Sombra = Color.FromArgb(60, 0, 0, 0),
        };

        public static Paleta P = Clara;
        public static string Modo = "auto";
        public static event Action Mudou;

        public static float Escala = 1f;
        public static Font Base, Pequena, Negrito, Titulo, CartaoTitulo, Grande, Subtitulo;
        static string fonteIcones;
        static readonly Dictionary<float, Font> icones = new Dictionary<float, Font>();

        static Color Cor(string hex) => ColorTranslator.FromHtml(hex);

        public static int S(float px) => (int)Math.Round(px * Escala);

        public static void Iniciar(string modo)
        {
            using (var g = Graphics.FromHwnd(IntPtr.Zero)) Escala = Math.Max(1f, g.DpiX / 96f);
            Base = new Font("Segoe UI", 9.75f);
            Pequena = new Font("Segoe UI", 8.75f);
            Negrito = new Font("Segoe UI Semibold", 9.75f);
            Subtitulo = new Font("Segoe UI Semibold", 11f);
            CartaoTitulo = new Font("Segoe UI Semibold", 11.5f);
            Titulo = new Font("Segoe UI Semibold", 17f);
            Grande = new Font("Segoe UI Light", 13f);
            using (var fontes = new InstalledFontCollection())
            {
                foreach (var f in fontes.Families)
                {
                    if (f.Name == "Segoe Fluent Icons") { fonteIcones = f.Name; break; }
                    if (f.Name == "Segoe MDL2 Assets") fonteIcones = f.Name;
                }
            }
            Definir(modo, false);
            SystemEvents.UserPreferenceChanged += (s, e) =>
            {
                if (Modo == "auto" && e.Category == UserPreferenceCategory.General) Definir("auto");
            };
        }

        public static bool TemIcones => fonteIcones != null;

        public static Font Icones(float tamanho)
        {
            if (fonteIcones == null) return Base;
            if (!icones.TryGetValue(tamanho, out var f)) icones[tamanho] = f = new Font(fonteIcones, tamanho);
            return f;
        }

        public static bool SistemaEscuro()
        {
            try
            {
                using (var k = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"))
                    return k?.GetValue("AppsUseLightTheme") is int v && v == 0;
            }
            catch { return false; }
        }

        public static void Definir(string modo, bool avisar = true)
        {
            Modo = modo == "claro" || modo == "escuro" ? modo : "auto";
            bool escuro = Modo == "escuro" || (Modo == "auto" && SistemaEscuro());
            var nova = escuro ? Escura : Clara;
            bool mudou = nova != P;
            P = nova;
            if (avisar && mudou)
            {
                foreach (Form f in Application.OpenForms) Aplicar(f);
                Mudou?.Invoke();
            }
        }

        /// <summary>Aplica as cores do tema numa janela e em tudo dentro dela.</summary>
        public static void Aplicar(Control c)
        {
            if (c is Form f)
            {
                f.BackColor = f.Tag as string == "superficie" ? P.Superficie : P.Fundo;
                f.ForeColor = P.Texto;
                if (f.IsHandleCreated) Nativo.TituloEscuro(f.Handle, P.Escuro);
            }
            foreach (Control filho in c.Controls) AplicarFilho(filho);
            c.Invalidate(true);
        }

        static void AplicarFilho(Control c)
        {
            string papel = c.Tag as string;
            switch (c)
            {
                case ITemavel t:
                    t.AplicarTema();
                    break;
                case Label l:
                    l.BackColor = Color.Transparent;
                    l.ForeColor = papel == "suave" ? P.TextoSuave : papel == "destaque" ? P.Destaque : papel == "erro" ? P.Erro
                        : papel == "ok" ? P.Ok : papel == "aviso" ? P.Aviso : papel == "pro" ? P.Pro : P.Texto;
                    break;
                case TextBox tb:
                    tb.BackColor = P.Campo;
                    tb.ForeColor = P.Texto;
                    break;
                default:
                    if (papel == "superficie") c.BackColor = P.Superficie;
                    else if (papel == "fundo") c.BackColor = P.Fundo;
                    else if (papel == "alt") c.BackColor = P.SuperficieAlt;
                    else if (c.Parent != null) c.BackColor = c.Parent.BackColor;
                    c.ForeColor = P.Texto;
                    if (c is ScrollableControl sc && sc.AutoScroll && c.IsHandleCreated) Nativo.TemaRolagem(c.Handle, P.Escuro);
                    break;
            }
            foreach (Control filho in c.Controls) AplicarFilho(filho);
        }

        // ---------------- Recursos embutidos (ícones e logo) ----------------

        static Stream Recurso(string nome)
        {
            var asm = Assembly.GetExecutingAssembly();
            foreach (string n in asm.GetManifestResourceNames())
                if (n.EndsWith("." + nome, StringComparison.OrdinalIgnoreCase)) return asm.GetManifestResourceStream(n);
            return null;
        }

        public static Icon Icone(string nome, int tamanho)
        {
            using (var s = Recurso(nome))
            {
                if (s == null) return SystemIcons.Application;
                return new Icon(s, tamanho, tamanho);
            }
        }

        static Image logo;
        public static Image Logo
        {
            get
            {
                if (logo == null)
                {
                    using (var s = Recurso("logo.png")) logo = s != null ? Image.FromStream(s) : new Bitmap(1, 1);
                }
                return logo;
            }
        }

        // ---------------- Desenho ----------------

        public static GraphicsPath Arredondado(RectangleF r, float raio)
        {
            var p = new GraphicsPath();
            float d = Math.Min(raio * 2, Math.Min(r.Width, r.Height));
            if (d <= 0) { p.AddRectangle(r); return p; }
            p.AddArc(r.X, r.Y, d, d, 180, 90);
            p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            p.CloseFigure();
            return p;
        }

        public static void Preencher(Graphics g, RectangleF r, float raio, Color cor)
        {
            using (var p = Arredondado(r, raio))
            using (var b = new SolidBrush(cor)) g.FillPath(b, p);
        }

        public static void Contornar(Graphics g, RectangleF r, float raio, Color cor, float largura = 1f)
        {
            using (var p = Arredondado(r, raio))
            using (var pen = new Pen(cor, largura)) g.DrawPath(pen, p);
        }

        public static Color Misturar(Color a, Color b, float t)
        {
            return Color.FromArgb(
                (int)(a.A + (b.A - a.A) * t), (int)(a.R + (b.R - a.R) * t),
                (int)(a.G + (b.G - a.G) * t), (int)(a.B + (b.B - a.B) * t));
        }

        public static void Texto(Graphics g, string texto, Font fonte, Rectangle r, Color cor, TextFormatFlags extra = 0)
        {
            TextRenderer.DrawText(g, texto, fonte, r, cor, TextFormatFlags.NoPrefix | TextFormatFlags.VerticalCenter | extra);
        }

        public static void Glifo(Graphics g, string glifo, float tamanho, Rectangle r, Color cor)
        {
            if (!TemIcones || string.IsNullOrEmpty(glifo)) return;
            TextRenderer.DrawText(g, glifo, Icones(tamanho), r, cor,
                TextFormatFlags.NoPrefix | TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
        }
    }

    /// <summary>Controles que sabem se redesenhar quando o tema muda.</summary>
    public interface ITemavel
    {
        void AplicarTema();
    }

    /// <summary>Códigos dos ícones da fonte Segoe MDL2 Assets / Segoe Fluent Icons.</summary>
    public static class G
    {
        public const string Adicionar = "", Config = "", Sol = "", Lua = "", Play = "", Pausa = "";
        public const string Parar = "", Editar = "", Mais = "", Pasta = "", Historico = "", Lixeira = "";
        public const string Sincronizar = "", Nuvem = "", Enviar = "", Certo = "", Alerta = "", Info = "";
        public const string Pessoa = "", Cadeado = "", Coracao = "", QrCode = "", Escudo = "", Estrela = "";
        public const string Copiar = "", Atualizar = "", Seta = "", Abaixo = "", Email = "", Relogio = "";
        public const string Disco = "", Sair = "", Fechar = "", Dinheiro = "", Pastas = "";
    }
}
