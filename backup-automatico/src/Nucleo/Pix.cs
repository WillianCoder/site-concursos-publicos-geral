using System;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace BackupAutomatico.Nucleo
{
    /// <summary>Gera o código "Pix copia e cola" (BR Code estático do Banco Central).</summary>
    public static class Pix
    {
        public static string Codigo(string chave, string nome, string cidade, double valor = 0, string descricao = "", string identificador = "***")
        {
            chave = NormalizarChave(chave);
            if (chave == "") throw new ArgumentException("Chave Pix não configurada.");
            nome = Limpar(nome, 25);
            cidade = Limpar(cidade, 15);
            if (nome == "") nome = "RECEBEDOR";
            if (cidade == "") cidade = "BRASIL";
            descricao = Limpar(descricao, 40);
            identificador = Regex.Replace(identificador ?? "", "[^A-Za-z0-9*]", "");
            if (identificador == "") identificador = "***";
            if (identificador.Length > 25) identificador = identificador.Substring(0, 25);

            string conta = Campo("00", "br.gov.bcb.pix") + Campo("01", chave);
            if (descricao != "" && conta.Length + 4 + descricao.Length <= 99) conta += Campo("02", descricao);

            var sb = new StringBuilder();
            sb.Append(Campo("00", "01"));
            sb.Append(Campo("26", conta));
            sb.Append(Campo("52", "0000"));
            sb.Append(Campo("53", "986"));
            if (valor > 0) sb.Append(Campo("54", valor.ToString("0.00", CultureInfo.InvariantCulture)));
            sb.Append(Campo("58", "BR"));
            sb.Append(Campo("59", nome));
            sb.Append(Campo("60", cidade));
            sb.Append(Campo("62", Campo("05", identificador)));
            sb.Append("6304");
            sb.Append(Crc16(sb.ToString()).ToString("X4"));
            return sb.ToString();
        }

        static string Campo(string id, string valor)
        {
            return id + valor.Length.ToString("00", CultureInfo.InvariantCulture) + valor;
        }

        /// <summary>Remove pontuação de CPF/CNPJ; e-mail em minúsculas; demais como digitado.</summary>
        public static string NormalizarChave(string chave)
        {
            string c = (chave ?? "").Trim();
            if (Regex.IsMatch(c, @"^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$") || Regex.IsMatch(c, @"^\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}$"))
                return Regex.Replace(c, @"\D", "");
            if (c.Contains("@")) return c.ToLowerInvariant();
            if (Regex.IsMatch(c, @"^\+?[\d\s()\-]{10,}$") && c.StartsWith("+")) return "+" + Regex.Replace(c, @"\D", "");
            return c;
        }

        static string Limpar(string s, int max)
        {
            s = Textos.SemAcentos(s ?? "").ToUpperInvariant();
            s = Regex.Replace(s, @"[^A-Z0-9 $%*+\-./:]", "").Trim();
            return s.Length > max ? s.Substring(0, max).Trim() : s;
        }

        public static ushort Crc16(string texto)
        {
            ushort crc = 0xFFFF;
            foreach (byte b in Encoding.UTF8.GetBytes(texto))
            {
                crc ^= (ushort)(b << 8);
                for (int i = 0; i < 8; i++)
                    crc = (crc & 0x8000) != 0 ? (ushort)((crc << 1) ^ 0x1021) : (ushort)(crc << 1);
            }
            return crc;
        }
    }
}
