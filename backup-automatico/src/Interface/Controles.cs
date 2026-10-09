using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
using static BackupAutomatico.Interface.Tema;

namespace BackupAutomatico.Interface
{
    public enum EstiloBotao { Primario, Secundario, Fantasma, Perigo, Pro }

    /// <summary>Botão arredondado com ícone opcional, nos dois temas.</summary>
    public class Botao : Button, ITemavel
    {
        public EstiloBotao Estilo = EstiloBotao.Secundario;
        public string Icone;
        public bool SoIcone;
        public bool Compacto;
        public Color? FundoPai;   // cor por trás dos cantos arredondados (quando o pai pinta outra cor)
        bool sobre, apertado;

        public Botao(string texto, EstiloBotao estilo = EstiloBotao.Secundario, string icone = null)
        {
            Text = texto;
            Estilo = estilo;
            Icone = icone;
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.SupportsTransparentBackColor, true);
            FlatStyle = FlatStyle.Flat;
            FlatAppearance.BorderSize = 0;
            Font = estilo == EstiloBotao.Primario || estilo == EstiloBotao.Pro ? Negrito : Base;
            Cursor = Cursors.Hand;
            AutoSize = true;
            Margin = new Padding(0, 0, S(8), 0);
            UseVisualStyleBackColor = false;
        }

        public void AplicarTema() => Invalidate();

        public override Size GetPreferredSize(Size proposto)
        {
            int altura = S(Compacto ? 30 : 36);
            bool temIcone = Tema.TemIcones && !string.IsNullOrEmpty(Icone);
            if (SoIcone) return new Size(altura, altura);
            int largura = TextRenderer.MeasureText(Text, Font, Size.Empty, TextFormatFlags.NoPrefix).Width + S(Compacto ? 20 : 28);
            if (temIcone) largura += S(22);
            return new Size(Math.Max(largura, altura), altura);
        }

        protected override void OnMouseEnter(EventArgs e) { sobre = true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { sobre = false; apertado = false; Invalidate(); base.OnMouseLeave(e); }
        protected override void OnMouseDown(MouseEventArgs e) { apertado = true; Invalidate(); base.OnMouseDown(e); }
        protected override void OnMouseUp(MouseEventArgs e) { apertado = false; Invalidate(); base.OnMouseUp(e); }
        protected override void OnEnabledChanged(EventArgs e) { Invalidate(); base.OnEnabledChanged(e); }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.Clear(FundoPai ?? Parent?.BackColor ?? P.Fundo);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var r = new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f);
            float raio = S(SoIcone ? 8 : 7);
            Color fundo, texto, borda = Color.Empty;
            switch (Estilo)
            {
                case EstiloBotao.Primario:
                    fundo = apertado ? P.DestaquePressionado : sobre ? P.DestaqueHover : P.Destaque;
                    texto = P.TextoNoDestaque;
                    break;
                case EstiloBotao.Pro:
                    fundo = apertado ? Misturar(P.Pro, Color.Black, 0.2f) : sobre ? Misturar(P.Pro, Color.White, 0.12f) : P.Pro;
                    texto = Color.White;
                    break;
                case EstiloBotao.Fantasma:
                    fundo = apertado ? P.BordaForte : sobre ? P.Hover : Color.Transparent;
                    texto = P.Texto;
                    break;
                case EstiloBotao.Perigo:
                    fundo = apertado ? P.ErroSuave : sobre ? P.ErroSuave : P.Superficie;
                    texto = P.Erro;
                    borda = P.Borda;
                    break;
                default:
                    fundo = apertado ? P.BordaForte : sobre ? P.Hover : P.Superficie;
                    texto = P.Texto;
                    borda = P.BordaForte;
                    break;
            }
            if (!Enabled) { fundo = Estilo == EstiloBotao.Fantasma ? Color.Transparent : Misturar(fundo, P.Fundo, 0.5f); texto = P.TextoFraco; }
            if (fundo.A > 0) Preencher(g, r, raio, fundo);
            if (borda != Color.Empty) Contornar(g, r, raio, borda);
            if (Focused && ShowFocusCues) Contornar(g, RectangleF.Inflate(r, -2, -2), raio - 2, P.Destaque, S(1.5f));

            bool temIcone = Tema.TemIcones && !string.IsNullOrEmpty(Icone);
            if (SoIcone)
            {
                Glifo(g, Icone, 11f, ClientRectangle, texto);
                return;
            }
            int largTexto = TextRenderer.MeasureText(Text, Font, Size.Empty, TextFormatFlags.NoPrefix).Width;
            int largIcone = temIcone ? S(22) : 0;
            int x = (Width - largTexto - largIcone) / 2;
            if (temIcone) Glifo(g, Icone, 10f, new Rectangle(x, 0, S(18), Height), texto);
            Tema.Texto(g, Text, Font, new Rectangle(x + largIcone, 0, largTexto + 2, Height), texto);
        }
    }

    /// <summary>Chave liga/desliga.</summary>
    public class Interruptor : CheckBox, ITemavel
    {
        public Interruptor(string texto)
        {
            Text = texto;
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            AutoSize = true;
            Cursor = Cursors.Hand;
            Font = Base;
            Margin = new Padding(0, S(4), 0, S(4));
        }

        public void AplicarTema() => Invalidate();
        protected override void OnCheckedChanged(EventArgs e) { Invalidate(); base.OnCheckedChanged(e); }
        protected override void OnEnabledChanged(EventArgs e) { Invalidate(); base.OnEnabledChanged(e); }

        public override Size GetPreferredSize(Size proposto)
        {
            var t = TextRenderer.MeasureText(Text, Font, Size.Empty, TextFormatFlags.NoPrefix);
            return new Size(S(46) + t.Width + S(4), Math.Max(S(26), t.Height + S(4)));
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.Clear(Parent?.BackColor ?? P.Fundo);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            int h = S(20), w = S(36), y = (Height - h) / 2;
            var trilho = new RectangleF(0.5f, y + 0.5f, w - 1, h - 1);
            Color cor = Checked ? P.Destaque : P.Escuro ? P.BordaForte : P.TextoFraco;
            if (!Enabled) cor = Misturar(cor, P.Fundo, 0.5f);
            Preencher(g, trilho, h / 2f, cor);
            int d = h - S(6);
            float x = Checked ? w - d - S(3) : S(3);
            using (var b = new SolidBrush(Color.White)) g.FillEllipse(b, x, y + S(3), d, d);
            if (Focused && ShowFocusCues) Contornar(g, RectangleF.Inflate(trilho, 2, 2), h / 2f + 2, P.Destaque);
            Tema.Texto(g, Text, Font, new Rectangle(w + S(10), 0, Width - w - S(10), Height), Enabled ? P.Texto : P.TextoFraco);
        }
    }

    /// <summary>Botão de opção (redondo).</summary>
    public class Opcao : RadioButton, ITemavel
    {
        public Opcao(string texto)
        {
            Text = texto;
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            AutoSize = true;
            Cursor = Cursors.Hand;
            Font = Base;
            Margin = new Padding(0, S(3), S(12), S(3));
        }

        public void AplicarTema() => Invalidate();
        protected override void OnCheckedChanged(EventArgs e) { Invalidate(); base.OnCheckedChanged(e); }
        protected override void OnEnabledChanged(EventArgs e) { Invalidate(); base.OnEnabledChanged(e); }

        public override Size GetPreferredSize(Size proposto)
        {
            var t = TextRenderer.MeasureText(Text, Font, Size.Empty, TextFormatFlags.NoPrefix);
            return new Size(S(28) + t.Width, Math.Max(S(24), t.Height + S(4)));
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.Clear(Parent?.BackColor ?? P.Fundo);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            int d = S(18), y = (Height - d) / 2;
            var c = new RectangleF(1, y, d - 2, d - 2);
            using (var b = new SolidBrush(P.Campo)) g.FillEllipse(b, c);
            using (var pen = new Pen(Checked ? P.Destaque : P.BordaForte, S(1.5f))) g.DrawEllipse(pen, c);
            if (Checked)
            {
                float m = d * 0.27f;
                using (var b = new SolidBrush(P.Destaque)) g.FillEllipse(b, c.X + m, c.Y + m, c.Width - 2 * m, c.Height - 2 * m);
            }
            if (Focused && ShowFocusCues) using (var pen = new Pen(P.Destaque)) g.DrawEllipse(pen, RectangleF.Inflate(c, 2, 2));
            Tema.Texto(g, Text, Font, new Rectangle(d + S(8), 0, Width - d - S(8), Height), Enabled ? P.Texto : P.TextoFraco);
        }
    }

    /// <summary>Caixa de texto com borda arredondada e texto de exemplo.</summary>
    public class Campo : UserControl, ITemavel
    {
        public readonly TextBox Caixa = new TextBox();
        public string Exemplo;
        public event Action<string> Soltou;

        public Campo(string exemplo = "", bool senha = false)
        {
            Exemplo = exemplo;
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            Caixa.BorderStyle = BorderStyle.None;
            Caixa.Font = Base;
            Caixa.UseSystemPasswordChar = senha;
            Controls.Add(Caixa);
            Height = S(36);
            Margin = new Padding(0, S(4), S(8), S(4));
            Caixa.GotFocus += (s, e) => Invalidate();
            Caixa.LostFocus += (s, e) => Invalidate();
            Caixa.HandleCreated += (s, e) => { if (!string.IsNullOrEmpty(Exemplo)) Nativo.TextoExemplo(Caixa.Handle, Exemplo); };
            Caixa.AllowDrop = true;
            Caixa.DragEnter += (s, e) => { if (Soltou != null && e.Data.GetDataPresent(DataFormats.FileDrop)) e.Effect = DragDropEffects.Copy; };
            Caixa.DragDrop += (s, e) =>
            {
                if (e.Data.GetData(DataFormats.FileDrop) is string[] itens && itens.Length > 0) Soltou?.Invoke(itens[0]);
            };
            AplicarTema();
        }

        public string Texto { get => Caixa.Text; set => Caixa.Text = value ?? ""; }
        public new event EventHandler TextChanged { add => Caixa.TextChanged += value; remove => Caixa.TextChanged -= value; }

        public void AplicarTema()
        {
            Caixa.BackColor = P.Campo;
            Caixa.ForeColor = P.Texto;
            Invalidate();
        }

        public override Size GetPreferredSize(Size proposto) => new Size(Width, S(36));

        protected override void OnLayout(LayoutEventArgs e)
        {
            base.OnLayout(e);
            int alt = Caixa.PreferredHeight;
            Caixa.SetBounds(S(10), (Height - alt) / 2, Width - S(20), alt);
        }

        protected override void OnClick(EventArgs e) { Caixa.Focus(); base.OnClick(e); }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.Clear(Parent?.BackColor ?? P.Fundo);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var r = new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f);
            Preencher(g, r, S(7), P.Campo);
            Contornar(g, r, S(7), Caixa.Focused ? P.Destaque : P.CampoBorda, Caixa.Focused ? S(1.5f) : 1f);
        }
    }

    /// <summary>Lista de escolha (abre um menu com as opções).</summary>
    public class Seletor : Control, ITemavel
    {
        public readonly List<string> Itens = new List<string>();
        int indice = -1;
        bool sobre;
        public event Action Mudou;

        public Seletor(params string[] itens)
        {
            Itens.AddRange(itens);
            if (itens.Length > 0) indice = 0;
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.Selectable, true);
            Font = Base;
            Cursor = Cursors.Hand;
            Height = S(36);
            Width = S(160);
            Margin = new Padding(0, S(4), S(8), S(4));
            TabStop = true;
        }

        public int Indice
        {
            get => indice;
            set { if (value != indice && value >= -1 && value < Itens.Count) { indice = value; Invalidate(); Mudou?.Invoke(); } }
        }

        public string Selecionado => indice >= 0 && indice < Itens.Count ? Itens[indice] : "";

        public void AplicarTema() => Invalidate();
        public override Size GetPreferredSize(Size proposto) => new Size(Width, S(36));
        protected override void OnMouseEnter(EventArgs e) { sobre = true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { sobre = false; Invalidate(); base.OnMouseLeave(e); }
        protected override void OnGotFocus(EventArgs e) { Invalidate(); base.OnGotFocus(e); }
        protected override void OnLostFocus(EventArgs e) { Invalidate(); base.OnLostFocus(e); }

        protected override void OnKeyDown(KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Down && indice < Itens.Count - 1) Indice++;
            else if (e.KeyCode == Keys.Up && indice > 0) Indice--;
            else if (e.KeyCode == Keys.Space || e.KeyCode == Keys.Enter || e.KeyCode == Keys.F4) Abrir();
            base.OnKeyDown(e);
        }

        protected override bool IsInputKey(Keys k) => k == Keys.Up || k == Keys.Down || base.IsInputKey(k);

        protected override void OnClick(EventArgs e) { Focus(); Abrir(); base.OnClick(e); }

        void Abrir()
        {
            var menu = MenuTema.Criar();
            for (int i = 0; i < Itens.Count; i++)
            {
                int n = i;
                var item = new ToolStripMenuItem(Itens[i]) { Checked = i == indice };
                item.Click += (s, e) => Indice = n;
                menu.Items.Add(item);
            }
            menu.MinimumSize = new Size(Width, 0);
            menu.Show(this, new Point(0, Height + S(2)));
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.Clear(Parent?.BackColor ?? P.Fundo);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var r = new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f);
            Preencher(g, r, S(7), sobre && Enabled ? P.Hover : P.Campo);
            Contornar(g, r, S(7), Focused ? P.Destaque : P.CampoBorda, Focused ? S(1.5f) : 1f);
            Tema.Texto(g, Selecionado, Font, new Rectangle(S(10), 0, Width - S(36), Height), Enabled ? P.Texto : P.TextoFraco, TextFormatFlags.EndEllipsis);
            Glifo(g, G.Abaixo, 8f, new Rectangle(Width - S(30), 0, S(22), Height), P.TextoSuave);
        }
    }

    /// <summary>Número com botões − e +.</summary>
    public class Numero : UserControl, ITemavel
    {
        readonly Campo campo = new Campo();
        readonly Botao menos = new Botao("−") { Compacto = true };
        readonly Botao mais = new Botao("+") { Compacto = true };
        public int Minimo = 1, Maximo = 999;
        int valor = 1;
        public event Action Mudou;

        public Numero()
        {
            Height = S(36);
            Width = S(140);
            Margin = new Padding(0, S(4), S(8), S(4));
            campo.Margin = Padding.Empty;
            campo.Caixa.TextAlign = HorizontalAlignment.Center;
            campo.Texto = "1";
            menos.AutoSize = mais.AutoSize = false;
            menos.Margin = mais.Margin = Padding.Empty;
            Controls.AddRange(new Control[] { menos, campo, mais });
            menos.Click += (s, e) => Valor = valor - 1;
            mais.Click += (s, e) => Valor = valor + 1;
            campo.TextChanged += (s, e) =>
            {
                if (int.TryParse(campo.Texto, out int v) && v >= Minimo && v <= Maximo && v != valor) { valor = v; Mudou?.Invoke(); }
            };
            campo.Caixa.Leave += (s, e) => campo.Texto = valor.ToString();
        }

        public int Valor
        {
            get => valor;
            set
            {
                int v = Math.Max(Minimo, Math.Min(Maximo, value));
                campo.Texto = v.ToString();
                if (v != valor) { valor = v; Mudou?.Invoke(); }
            }
        }

        public void AplicarTema() { BackColor = Parent?.BackColor ?? P.Fundo; campo.AplicarTema(); menos.Invalidate(); mais.Invalidate(); }
        public override Size GetPreferredSize(Size proposto) => new Size(Width, S(36));

        protected override void OnLayout(LayoutEventArgs e)
        {
            base.OnLayout(e);
            int b = S(34);
            menos.SetBounds(0, 0, b, Height);
            mais.SetBounds(Width - b, 0, b, Height);
            campo.SetBounds(b + S(4), 0, Width - 2 * b - S(8), Height);
        }
    }

    /// <summary>Menus (botão direito, ícone perto do relógio, listas) nas cores do tema.</summary>
    public static class MenuTema
    {
        sealed class Cores : ProfessionalColorTable
        {
            public override Color ToolStripDropDownBackground => P.Superficie;
            public override Color ImageMarginGradientBegin => P.Superficie;
            public override Color ImageMarginGradientMiddle => P.Superficie;
            public override Color ImageMarginGradientEnd => P.Superficie;
            public override Color MenuBorder => P.BordaForte;
            public override Color MenuItemBorder => P.Hover;
            public override Color MenuItemSelected => P.Hover;
            public override Color MenuItemSelectedGradientBegin => P.Hover;
            public override Color MenuItemSelectedGradientEnd => P.Hover;
            public override Color MenuItemPressedGradientBegin => P.Hover;
            public override Color MenuItemPressedGradientEnd => P.Hover;
            public override Color SeparatorDark => P.Borda;
            public override Color SeparatorLight => P.Borda;
            public override Color CheckBackground => P.DestaqueSuave;
            public override Color CheckSelectedBackground => P.DestaqueSuave;
            public override Color CheckPressedBackground => P.DestaqueSuave;
        }

        sealed class Desenhista : ToolStripProfessionalRenderer
        {
            public Desenhista() : base(new Cores()) { RoundedEdges = false; }
            protected override void OnRenderItemText(ToolStripItemTextRenderEventArgs e)
            {
                e.TextColor = e.Item.Enabled ? (e.Item.Tag as string == "perigo" ? P.Erro : P.Texto) : P.TextoFraco;
                base.OnRenderItemText(e);
            }
            protected override void OnRenderArrow(ToolStripArrowRenderEventArgs e) { e.ArrowColor = P.TextoSuave; base.OnRenderArrow(e); }
        }

        public static ContextMenuStrip Criar()
        {
            var m = new ContextMenuStrip { Renderer = new Desenhista(), Font = Base, ShowImageMargin = true };
            m.Padding = new Padding(S(2));
            return m;
        }

        public static void Atualizar(ToolStrip m) => m.Renderer = new Desenhista();

        public static ToolStripMenuItem Item(ContextMenuStrip m, string texto, Action acao, bool perigo = false)
        {
            var i = new ToolStripMenuItem(texto) { Tag = perigo ? "perigo" : null, Padding = new Padding(S(4), S(3), S(4), S(3)) };
            i.Click += (s, e) => acao();
            m.Items.Add(i);
            return i;
        }
    }

    /// <summary>Painel com fundo de "cartão" (cantos arredondados e borda).</summary>
    public class Cartao : Panel, ITemavel
    {
        public Color? Faixa;   // cor da faixa à esquerda (opcional)

        public Cartao()
        {
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            Padding = new Padding(S(16));
            AplicarTema();
        }

        public void AplicarTema() { BackColor = P.Superficie; Invalidate(); }

        protected override void OnPaintBackground(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.Clear(Parent?.BackColor ?? P.Fundo);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var r = new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f);
            Preencher(g, r, S(10), P.Superficie);
            Contornar(g, r, S(10), P.Borda);
            if (Faixa.HasValue)
            {
                using (var p = Arredondado(r, S(10)))
                {
                    g.SetClip(p);
                    using (var b = new SolidBrush(Faixa.Value)) g.FillRectangle(b, 0, 0, S(4), Height);
                    g.ResetClip();
                }
            }
        }
    }

    /// <summary>Etiqueta colorida pequena ("Ativo", "Pro", "Administrador"...).</summary>
    public static class Pilula
    {
        public static Size Medir(string texto, Font f) => new Size(TextRenderer.MeasureText(texto, f, Size.Empty, TextFormatFlags.NoPrefix).Width + S(20), S(22));

        public static void Desenhar(Graphics g, string texto, Font f, Point pos, Color cor, Color fundo, bool ponto = true)
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var t = Medir(texto, f);
            int extra = ponto ? S(10) : 0;
            var r = new RectangleF(pos.X, pos.Y, t.Width + extra, t.Height);
            Preencher(g, r, t.Height / 2f, fundo);
            if (ponto) using (var b = new SolidBrush(cor)) g.FillEllipse(b, pos.X + S(9), pos.Y + t.Height / 2f - S(3), S(6), S(6));
            Tema.Texto(g, texto, f, new Rectangle(pos.X + S(10) + extra, pos.Y, t.Width, t.Height), cor);
        }

        public static int Largura(string texto, Font f, bool ponto = true) => Medir(texto, f).Width + (ponto ? S(10) : 0);
    }

    /// <summary>Utilidades para montar janelas.</summary>
    public static class Montar
    {
        public static Label Rotulo(string texto, Font fonte = null, string papel = null, int largMax = 0)
        {
            var l = new Label { Text = texto, AutoSize = true, Font = fonte ?? Base, Tag = papel, Margin = new Padding(0, S(4), S(8), S(4)), UseMnemonic = false };
            if (largMax > 0) l.MaximumSize = new Size(largMax, 0);
            return l;
        }

        public static FlowLayoutPanel Fluxo(bool vertical = false, params Control[] controles)
        {
            var f = new FlowLayoutPanel
            {
                AutoSize = true,
                AutoSizeMode = AutoSizeMode.GrowAndShrink,
                WrapContents = false,
                Margin = Padding.Empty,
                FlowDirection = vertical ? FlowDirection.TopDown : FlowDirection.LeftToRight,
            };
            f.Controls.AddRange(controles);
            return f;
        }

        public static TableLayoutPanel Grade(int colunas)
        {
            var t = new TableLayoutPanel { AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink, ColumnCount = colunas, Margin = Padding.Empty };
            return t;
        }

        /// <summary>Janela de diálogo padrão (fundo de superfície, sem maximizar).</summary>
        public static Form Dialogo(string titulo)
        {
            var f = new Form
            {
                Text = titulo,
                Tag = "superficie",
                Font = Base,
                AutoScaleMode = AutoScaleMode.None,
                FormBorderStyle = FormBorderStyle.FixedDialog,
                MaximizeBox = false,
                MinimizeBox = false,
                ShowInTaskbar = false,
                StartPosition = FormStartPosition.CenterParent,
                Icon = Tema.Icone("app.ico", 32),
            };
            f.HandleCreated += (s, e) => Nativo.TituloEscuro(f.Handle, P.Escuro);
            f.Load += (s, e) => Tema.Aplicar(f);
            return f;
        }

        /// <summary>Ajusta o tamanho da janela ao conteúdo (com rolagem se não couber na tela).</summary>
        public static void Encaixar(Form f, Control conteudo, Control rodape, int margem)
        {
            var area = (f.Owner != null ? Screen.FromControl(f.Owner) : Screen.FromPoint(Cursor.Position)).WorkingArea;
            var tam = conteudo.PreferredSize;
            int altRodape = rodape?.PreferredSize.Height ?? 0;
            int largura = tam.Width + margem * 2;
            int altConteudo = tam.Height;
            int maxConteudo = (int)(area.Height * 0.88) - altRodape - margem * 3;
            var rolagem = conteudo.Parent as Panel;
            bool temRolagem = rolagem != null && rolagem.Tag as string == "rolagem";
            if (altConteudo > maxConteudo)
            {
                int barra = SystemInformation.VerticalScrollBarWidth;
                if (!temRolagem)
                {
                    rolagem = new Panel { AutoScroll = true, Tag = "rolagem", BackColor = f.BackColor };
                    f.Controls.Add(rolagem);
                    conteudo.Parent = rolagem;
                    rolagem.HandleCreated += (s, e) => Nativo.TemaRolagem(rolagem.Handle, P.Escuro);
                    if (rolagem.IsHandleCreated) Nativo.TemaRolagem(rolagem.Handle, P.Escuro);
                }
                rolagem.SetBounds(margem, margem, tam.Width + barra + S(4), maxConteudo);
                conteudo.Location = Point.Empty;
                largura += barra + S(4);
                altConteudo = maxConteudo;
            }
            else
            {
                if (temRolagem) { conteudo.Parent = f; f.Controls.Remove(rolagem); rolagem.Dispose(); }
                conteudo.Location = new Point(margem, margem);
            }
            int altura = altConteudo + margem * 2 + (rodape != null ? altRodape + margem : 0);
            if (rodape != null) rodape.Location = new Point(largura - margem - rodape.PreferredSize.Width, altura - margem - altRodape);
            f.ClientSize = new Size(largura, altura);
            var dono = f.Owner != null && f.Owner.Visible ? f.Owner.Bounds : area;
            f.Location = new Point(Math.Max(area.Left, dono.Left + (dono.Width - f.Width) / 2), Math.Max(area.Top, dono.Top + (dono.Height - f.Height) / 2));
        }
    }
}
