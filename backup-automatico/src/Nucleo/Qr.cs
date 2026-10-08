using System;
using System.Collections.Generic;
using System.Text;

namespace BackupAutomatico.Nucleo
{
    /// <summary>
    /// Gerador de QR Code (modo byte, correção de erros "M"), baseado no algoritmo
    /// do Project Nayuki (licença MIT). Usado para o QR Code do Pix.
    /// </summary>
    public sealed class Qr
    {
        static readonly int[] EccPorBloco = { -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28 };
        static readonly int[] NumBlocos = { -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49 };
        const int BitsFormatoM = 0;

        public readonly int Versao;
        public readonly int Tamanho;
        readonly bool[,] modulos;
        readonly bool[,] funcao;

        public bool Escuro(int x, int y) => x >= 0 && y >= 0 && x < Tamanho && y < Tamanho && modulos[y, x];

        public static Qr Gerar(string texto)
        {
            byte[] dados = Encoding.UTF8.GetBytes(texto);
            for (int v = 1; v <= 40; v++)
            {
                int bitsContagem = v <= 9 ? 8 : 16;
                int capacidade = DadosPorVersao(v) * 8;
                int usados = 4 + bitsContagem + dados.Length * 8;
                if (usados > capacidade) continue;

                var bits = new List<bool>();
                Anexar(bits, 4, 4);
                Anexar(bits, dados.Length, bitsContagem);
                foreach (byte b in dados) Anexar(bits, b, 8);
                Anexar(bits, 0, Math.Min(4, capacidade - bits.Count));
                Anexar(bits, 0, (8 - bits.Count % 8) % 8);
                for (int pad = 0xEC; bits.Count < capacidade; pad ^= 0xEC ^ 0x11) Anexar(bits, pad, 8);
                var codigos = new byte[bits.Count / 8];
                for (int i = 0; i < bits.Count; i++) if (bits[i]) codigos[i >> 3] |= (byte)(1 << (7 - (i & 7)));
                return new Qr(v, codigos);
            }
            throw new ArgumentException("Texto grande demais para um QR Code.");
        }

        static void Anexar(List<bool> bits, int valor, int n)
        {
            for (int i = n - 1; i >= 0; i--) bits.Add(((valor >> i) & 1) != 0);
        }

        Qr(int versao, byte[] dados)
        {
            Versao = versao;
            Tamanho = versao * 4 + 17;
            modulos = new bool[Tamanho, Tamanho];
            funcao = new bool[Tamanho, Tamanho];
            DesenharPadroes();
            DesenharCodigos(AdicionarCorrecao(dados));

            int melhor = 0;
            long menor = long.MaxValue;
            for (int m = 0; m < 8; m++)
            {
                AplicarMascara(m);
                DesenharFormato(m);
                long pen = Penalidade();
                if (pen < menor) { menor = pen; melhor = m; }
                AplicarMascara(m);
            }
            AplicarMascara(melhor);
            DesenharFormato(melhor);
        }

        static int ModulosBrutos(int v)
        {
            int r = (16 * v + 128) * v + 64;
            if (v >= 2)
            {
                int n = v / 7 + 2;
                r -= (25 * n - 10) * n - 55;
                if (v >= 7) r -= 36;
            }
            return r;
        }

        static int DadosPorVersao(int v) => ModulosBrutos(v) / 8 - EccPorBloco[v] * NumBlocos[v];

        void Marcar(int x, int y, bool escuro)
        {
            modulos[y, x] = escuro;
            funcao[y, x] = true;
        }

        void DesenharPadroes()
        {
            for (int i = 0; i < Tamanho; i++)
            {
                Marcar(6, i, i % 2 == 0);
                Marcar(i, 6, i % 2 == 0);
            }
            Localizador(3, 3);
            Localizador(Tamanho - 4, 3);
            Localizador(3, Tamanho - 4);
            int[] pos = PosicoesAlinhamento();
            int n = pos.Length;
            for (int i = 0; i < n; i++)
                for (int j = 0; j < n; j++)
                    if (!(i == 0 && j == 0 || i == 0 && j == n - 1 || i == n - 1 && j == 0)) Alinhamento(pos[i], pos[j]);
            DesenharFormato(0);
            DesenharVersao();
        }

        void Localizador(int x, int y)
        {
            for (int dy = -4; dy <= 4; dy++)
                for (int dx = -4; dx <= 4; dx++)
                {
                    int d = Math.Max(Math.Abs(dx), Math.Abs(dy));
                    int xx = x + dx, yy = y + dy;
                    if (xx >= 0 && xx < Tamanho && yy >= 0 && yy < Tamanho) Marcar(xx, yy, d != 2 && d != 4);
                }
        }

        void Alinhamento(int x, int y)
        {
            for (int dy = -2; dy <= 2; dy++)
                for (int dx = -2; dx <= 2; dx++)
                    Marcar(x + dx, y + dy, Math.Max(Math.Abs(dx), Math.Abs(dy)) != 1);
        }

        int[] PosicoesAlinhamento()
        {
            if (Versao == 1) return new int[0];
            int n = Versao / 7 + 2;
            int passo = Versao == 32 ? 26 : (Versao * 4 + n * 2 + 1) / (n * 2 - 2) * 2;
            var r = new int[n];
            r[0] = 6;
            for (int i = n - 1, p = Tamanho - 7; i >= 1; i--, p -= passo) r[i] = p;
            return r;
        }

        void DesenharFormato(int mascara)
        {
            int dados = BitsFormatoM << 3 | mascara;
            int rem = dados;
            for (int i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
            int bits = (dados << 10 | rem) ^ 0x5412;
            bool Bit(int i) => ((bits >> i) & 1) != 0;
            for (int i = 0; i <= 5; i++) Marcar(8, i, Bit(i));
            Marcar(8, 7, Bit(6));
            Marcar(8, 8, Bit(7));
            Marcar(7, 8, Bit(8));
            for (int i = 9; i < 15; i++) Marcar(14 - i, 8, Bit(i));
            for (int i = 0; i < 8; i++) Marcar(Tamanho - 1 - i, 8, Bit(i));
            for (int i = 8; i < 15; i++) Marcar(8, Tamanho - 15 + i, Bit(i));
            Marcar(8, Tamanho - 8, true);
        }

        void DesenharVersao()
        {
            if (Versao < 7) return;
            int rem = Versao;
            for (int i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >> 11) * 0x1F25);
            int bits = Versao << 12 | rem;
            for (int i = 0; i < 18; i++)
            {
                bool b = ((bits >> i) & 1) != 0;
                int a = Tamanho - 11 + i % 3, c = i / 3;
                Marcar(a, c, b);
                Marcar(c, a, b);
            }
        }

        byte[] AdicionarCorrecao(byte[] dados)
        {
            int nBlocos = NumBlocos[Versao];
            int eccLen = EccPorBloco[Versao];
            int brutos = ModulosBrutos(Versao) / 8;
            int curtos = nBlocos - brutos % nBlocos;
            int tamCurto = brutos / nBlocos;
            byte[] divisor = Divisor(eccLen);
            var blocos = new List<byte[]>();
            for (int i = 0, k = 0; i < nBlocos; i++)
            {
                int len = tamCurto - eccLen + (i < curtos ? 0 : 1);
                var dat = new byte[len];
                Array.Copy(dados, k, dat, 0, len);
                k += len;
                byte[] ecc = Resto(dat, divisor);
                var bloco = new byte[tamCurto + 1];
                Array.Copy(dat, bloco, len);
                Array.Copy(ecc, 0, bloco, tamCurto + 1 - eccLen, eccLen);
                blocos.Add(bloco);
            }
            var r = new List<byte>();
            for (int i = 0; i < blocos[0].Length; i++)
                for (int j = 0; j < blocos.Count; j++)
                    if (i != tamCurto - eccLen || j >= curtos) r.Add(blocos[j][i]);
            return r.ToArray();
        }

        static byte[] Divisor(int grau)
        {
            var r = new byte[grau];
            r[grau - 1] = 1;
            int raiz = 1;
            for (int i = 0; i < grau; i++)
            {
                for (int j = 0; j < r.Length; j++)
                {
                    r[j] = Mult(r[j], raiz);
                    if (j + 1 < r.Length) r[j] ^= r[j + 1];
                }
                raiz = Mult(raiz, 0x02);
            }
            return r;
        }

        static byte[] Resto(byte[] dados, byte[] divisor)
        {
            var r = new byte[divisor.Length];
            foreach (byte b in dados)
            {
                int fator = b ^ r[0];
                Array.Copy(r, 1, r, 0, r.Length - 1);
                r[r.Length - 1] = 0;
                for (int i = 0; i < r.Length; i++) r[i] ^= Mult(divisor[i], fator);
            }
            return r;
        }

        static byte Mult(int x, int y)
        {
            int z = 0;
            for (int i = 7; i >= 0; i--)
            {
                z = (z << 1) ^ ((z >> 7) * 0x11D);
                z ^= ((y >> i) & 1) * x;
            }
            return (byte)z;
        }

        void DesenharCodigos(byte[] dados)
        {
            int i = 0;
            for (int direita = Tamanho - 1; direita >= 1; direita -= 2)
            {
                if (direita == 6) direita = 5;
                for (int vert = 0; vert < Tamanho; vert++)
                {
                    for (int j = 0; j < 2; j++)
                    {
                        int x = direita - j;
                        bool subindo = ((direita + 1) & 2) == 0;
                        int y = subindo ? Tamanho - 1 - vert : vert;
                        if (!funcao[y, x] && i < dados.Length * 8)
                        {
                            modulos[y, x] = ((dados[i >> 3] >> (7 - (i & 7))) & 1) != 0;
                            i++;
                        }
                    }
                }
            }
        }

        void AplicarMascara(int m)
        {
            for (int y = 0; y < Tamanho; y++)
                for (int x = 0; x < Tamanho; x++)
                {
                    bool inv;
                    switch (m)
                    {
                        case 0: inv = (x + y) % 2 == 0; break;
                        case 1: inv = y % 2 == 0; break;
                        case 2: inv = x % 3 == 0; break;
                        case 3: inv = (x + y) % 3 == 0; break;
                        case 4: inv = (x / 3 + y / 2) % 2 == 0; break;
                        case 5: inv = x * y % 2 + x * y % 3 == 0; break;
                        case 6: inv = (x * y % 2 + x * y % 3) % 2 == 0; break;
                        default: inv = ((x + y) % 2 + x * y % 3) % 2 == 0; break;
                    }
                    if (inv && !funcao[y, x]) modulos[y, x] = !modulos[y, x];
                }
        }

        long Penalidade()
        {
            long r = 0;
            for (int y = 0; y < Tamanho; y++)
            {
                int corrida = 1;
                for (int x = 1; x < Tamanho; x++)
                {
                    if (modulos[y, x] == modulos[y, x - 1]) { corrida++; if (corrida == 5) r += 3; else if (corrida > 5) r++; }
                    else corrida = 1;
                }
            }
            for (int x = 0; x < Tamanho; x++)
            {
                int corrida = 1;
                for (int y = 1; y < Tamanho; y++)
                {
                    if (modulos[y, x] == modulos[y - 1, x]) { corrida++; if (corrida == 5) r += 3; else if (corrida > 5) r++; }
                    else corrida = 1;
                }
            }
            for (int y = 0; y < Tamanho - 1; y++)
                for (int x = 0; x < Tamanho - 1; x++)
                {
                    bool c = modulos[y, x];
                    if (c == modulos[y, x + 1] && c == modulos[y + 1, x] && c == modulos[y + 1, x + 1]) r += 3;
                }
            int escuros = 0;
            foreach (bool b in modulos) if (b) escuros++;
            int total = Tamanho * Tamanho;
            int k = (Math.Abs(escuros * 20 - total * 10) + total - 1) / total - 1;
            r += Math.Max(0, k) * 10;
            return r;
        }
    }
}
