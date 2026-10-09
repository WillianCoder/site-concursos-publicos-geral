using System;
using System.Collections.Generic;
using System.IO;

namespace BackupAutomatico.Nucleo
{
    /// <summary>Cálculo de quando cada backup deve rodar.</summary>
    public static class Agenda
    {
        public const int MinimoMinutos = 5;

        public static DateTime Somar(DateTime data, int valor, string unidade, long vezes = 1)
        {
            long n = (long)valor * vezes;
            switch (unidade)
            {
                case "minutos": return data.AddMinutes(n);
                case "horas": return data.AddHours(n);
                case "dias": return data.AddDays(n);
                case "meses": return data.AddMonths((int)n);
                case "anos": return data.AddYears((int)n);
                default: return data.AddDays(7 * n);
            }
        }

        /// <summary>
        /// Os horários seguem uma "grade" que começa em Inicio: Inicio, Inicio + 1x,
        /// Inicio + 2x... O próximo é o primeiro horário da grade depois do último
        /// backup. Se o computador ficou desligado, o backup atrasado roda assim que
        /// possível e a grade continua no mesmo dia e horário de sempre.
        /// </summary>
        public static DateTime Proxima(Trabalho t)
        {
            DateTime inicio = t.Inicio;
            DateTime proxima;
            if (t.UltimaExecucao == null || t.UltimaExecucao.Value < inicio)
            {
                proxima = inicio;
            }
            else
            {
                DateTime ultima = t.UltimaExecucao.Value;
                int v = Math.Max(1, t.IntervaloValor);
                string u = t.IntervaloUnidade;
                long estimativa;
                if (u == "meses") estimativa = (long)Math.Floor(((ultima.Year - inicio.Year) * 12 + ultima.Month - inicio.Month) / (double)v);
                else if (u == "anos") estimativa = (long)Math.Floor((ultima.Year - inicio.Year) / (double)v);
                else
                {
                    long passo = (Somar(inicio, v, u) - inicio).Ticks;
                    estimativa = (ultima - inicio).Ticks / passo;
                }
                long k = Math.Max(1, estimativa - 1);
                while (Somar(inicio, v, u, k) <= ultima) k++;
                proxima = Somar(inicio, v, u, k);
            }
            if (t.AguardarAte != null && t.AguardarAte.Value > proxima) proxima = t.AguardarAte.Value;
            return proxima;
        }

        public static bool Vencido(Trabalho t, DateTime agora) => t.Ativo && Proxima(t) <= agora;

        /// <summary>"Ignorar o que já existe" precisa primeiro anotar o ponto de partida.</summary>
        public static bool BaseNecessaria(Trabalho t) => t.IgnorarExistentes && t.BaseRegistradaEm == null;

        /// <summary>
        /// Primeira ocorrência (a partir de agora) para um agendamento escolhido na tela:
        /// diário no horário H; semanal no dia da semana D; mensal no dia do mês D;
        /// anual em D/M. Para minutos e horas, começa agora.
        /// </summary>
        public static DateTime PrimeiraOcorrencia(string unidade, int hora, int minuto, DayOfWeek diaSemana, int diaMes, int mes, DateTime agora)
        {
            DateTime baseHoje = new DateTime(agora.Year, agora.Month, agora.Day, hora, minuto, 0);
            switch (unidade)
            {
                case "dias":
                    return baseHoje > agora ? baseHoje : baseHoje.AddDays(1);
                case "semanas":
                {
                    int dif = ((int)diaSemana - (int)agora.DayOfWeek + 7) % 7;
                    DateTime d = baseHoje.AddDays(dif);
                    return d > agora ? d : d.AddDays(7);
                }
                case "meses":
                {
                    for (int i = 0; i < 13; i++)
                    {
                        var m = new DateTime(agora.Year, agora.Month, 1).AddMonths(i);
                        int dia = Math.Min(diaMes, DateTime.DaysInMonth(m.Year, m.Month));
                        var d = new DateTime(m.Year, m.Month, dia, hora, minuto, 0);
                        if (d > agora) return d;
                    }
                    return baseHoje.AddMonths(1);
                }
                case "anos":
                {
                    for (int i = 0; i < 3; i++)
                    {
                        int ano = agora.Year + i;
                        int dia = Math.Min(diaMes, DateTime.DaysInMonth(ano, mes));
                        var d = new DateTime(ano, mes, dia, hora, minuto, 0);
                        if (d > agora) return d;
                    }
                    return baseHoje.AddYears(1);
                }
                default:
                    return new DateTime(agora.Year, agora.Month, agora.Day, agora.Hour, agora.Minute, 0);
            }
        }

        /// <summary>Lista de problemas da configuração (vazia = tudo certo).</summary>
        public static List<string> Validar(Trabalho t)
        {
            var erros = new List<string>();
            if (string.IsNullOrWhiteSpace(t.Nome)) erros.Add("Dê um nome para este backup.");
            string origem = Caminhos.Normalizar(t.Origem);
            if (origem == "") erros.Add("Escolha a pasta que será copiada (origem).");
            else if (!Directory.Exists(origem)) erros.Add("A pasta de origem não foi encontrada:\n" + origem);
            string destino = Caminhos.DestinoFinal(t);
            if (destino == "") erros.Add("Escolha a pasta para onde os arquivos serão copiados (destino).");
            else if (origem != "" && (Caminhos.Dentro(destino, origem) || Caminhos.Dentro(origem, destino)))
                erros.Add("A pasta de destino não pode ser a mesma da origem, nem ficar dentro dela (e vice-versa).");
            if (t.IntervaloValor < 1) erros.Add("A frequência precisa ser de pelo menos 1.");
            if (t.IntervaloUnidade == "minutos" && t.IntervaloValor < MinimoMinutos)
                erros.Add("O intervalo mínimo é de " + MinimoMinutos + " minutos.");
            return erros;
        }
    }
}
