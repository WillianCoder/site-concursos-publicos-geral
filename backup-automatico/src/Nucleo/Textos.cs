using System;
using System.Globalization;

namespace BackupAutomatico.Nucleo
{
    /// <summary>Formatação de números, datas, tamanhos e frequências em português.</summary>
    public static class Textos
    {
        public static readonly CultureInfo PtBr = CriarCultura();
        public static readonly string[] DiasCurtos = { "dom", "seg", "ter", "qua", "qui", "sex", "sáb" };
        public static readonly string[] DiasLongos = { "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado" };
        public static readonly string[] Meses = { "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro" };

        static CultureInfo CriarCultura()
        {
            try { return CultureInfo.GetCultureInfo("pt-BR"); }
            catch { return CultureInfo.InvariantCulture; }
        }

        public static string Numero(long n)
        {
            // Separador de milhar sempre com ponto, independente da cultura do sistema.
            string s = Math.Abs(n).ToString(CultureInfo.InvariantCulture);
            var sb = new System.Text.StringBuilder();
            for (int i = 0; i < s.Length; i++)
            {
                if (i > 0 && (s.Length - i) % 3 == 0) sb.Append('.');
                sb.Append(s[i]);
            }
            return (n < 0 ? "-" : "") + sb;
        }

        public static string Plural(long n, string singular, string plural)
        {
            return n == 1 ? "1 " + singular : Numero(n) + " " + plural;
        }

        public static string Decimal(double v, string formato = "0.#")
        {
            return v.ToString(formato, CultureInfo.InvariantCulture).Replace('.', ',');
        }

        public static string Tamanho(long bytes)
        {
            if (bytes < 1024) return Plural(bytes, "byte", "bytes");
            string[] unidades = { "KB", "MB", "GB", "TB" };
            double v = bytes;
            int i = -1;
            while (v >= 1024 && i < 3) { v /= 1024; i++; }
            return Decimal(v) + " " + unidades[i];
        }

        public static string Duracao(TimeSpan d)
        {
            if (d.TotalSeconds < 60) return Math.Max(1, (int)Math.Round(d.TotalSeconds)) + " s";
            if (d.TotalMinutes < 60) return string.Format(CultureInfo.InvariantCulture, "{0} min {1:00} s", (int)d.TotalMinutes, d.Seconds);
            return string.Format(CultureInfo.InvariantCulture, "{0} h {1:00} min", (int)d.TotalHours, d.Minutes);
        }

        public static string Dinheiro(double valor)
        {
            return "R$ " + valor.ToString("0.00", CultureInfo.InvariantCulture).Replace('.', ',');
        }

        public static string Frequencia(int valor, string unidade)
        {
            if (valor <= 1)
            {
                switch (unidade)
                {
                    case "minutos": return "A cada minuto";
                    case "horas": return "A cada hora";
                    case "dias": return "Todo dia";
                    case "semanas": return "Toda semana";
                    case "meses": return "Todo mês";
                    case "anos": return "Todo ano";
                }
            }
            return "A cada " + valor + " " + unidade;
        }

        /// <summary>Descrição completa: "Toda semana, sex às 18:00".</summary>
        public static string Agendamento(int valor, string unidade, DateTime inicio)
        {
            string f = Frequencia(valor, unidade);
            string hora = inicio.ToString("HH:mm", CultureInfo.InvariantCulture);
            switch (unidade)
            {
                case "dias": return f + ", às " + hora;
                case "semanas": return f + ", " + DiasCurtos[(int)inicio.DayOfWeek] + " às " + hora;
                case "meses": return f + ", dia " + inicio.Day + " às " + hora;
                case "anos": return f + ", " + inicio.Day + " de " + Meses[inicio.Month - 1] + " às " + hora;
                default: return f;
            }
        }

        /// <summary>"hoje às 18:00", "amanhã às 09:30", "sex, 10/10 às 18:00".</summary>
        public static string DataAmigavel(DateTime? data, DateTime? agora = null)
        {
            if (data == null) return "-";
            var d = data.Value;
            var a = agora ?? DateTime.Now;
            string hora = d.ToString("HH:mm", CultureInfo.InvariantCulture);
            int dias = (d.Date - a.Date).Days;
            if (dias == 0) return "hoje às " + hora;
            if (dias == 1) return "amanhã às " + hora;
            if (dias == -1) return "ontem às " + hora;
            string dia = DiasCurtos[(int)d.DayOfWeek];
            if (d.Year == a.Year) return dia + ", " + d.ToString("dd/MM", CultureInfo.InvariantCulture) + " às " + hora;
            return dia + ", " + d.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture) + " às " + hora;
        }

        public static string Data(DateTime d)
        {
            return d.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);
        }

        public static string SemAcentos(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            var normal = s.Normalize(System.Text.NormalizationForm.FormD);
            var sb = new System.Text.StringBuilder();
            foreach (char c in normal)
            {
                if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(c);
            }
            return sb.ToString().Normalize(System.Text.NormalizationForm.FormC);
        }
    }
}
