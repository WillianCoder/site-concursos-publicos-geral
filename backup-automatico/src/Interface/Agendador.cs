using System;
using System.Collections.Generic;
using System.Threading;
using System.Windows.Forms;
using BackupAutomatico.Nucleo;

namespace BackupAutomatico.Interface
{
    /// <summary>Escolhe e executa os backups (um por vez, em segundo plano).</summary>
    public sealed class Agendador
    {
        public sealed class Execucao
        {
            public string Id, Nome, Tipo;   // Tipo: backup | base
            public bool Manual;
            public Progresso Progresso = new Progresso();
            public DateTime Inicio = DateTime.Now;
        }

        readonly Configuracao cfg;
        readonly Control ui;
        public readonly List<string> Fila = new List<string>();
        public Execucao Atual;
        public DateTime LiberadoEm = DateTime.Now.AddSeconds(3);
        public event Action Mudou;
        public event Action<Trabalho, Resultado, Execucao, string> Concluiu;   // (trabalho, resultado, execução, status anterior)

        public Agendador(Configuracao cfg, Control ui)
        {
            this.cfg = cfg;
            this.ui = ui;
        }

        public bool Executando(Trabalho t) => Atual != null && Atual.Id == t.Id;
        public bool NaFila(Trabalho t) => Fila.Contains(t.Id);

        /// <summary>O plano permite este backup? (a versão grátis tem limite de pastas)</summary>
        public bool Permitido(Trabalho t)
        {
            int limite = Recursos.LimitePastas(Conta.Plano, Conta.App);
            int i = cfg.Trabalhos.IndexOf(t);
            return i >= 0 && i < limite;
        }

        public void PedirAgora(Trabalho t)
        {
            if (!Executando(t) && !Fila.Contains(t.Id)) Fila.Add(t.Id);
            LiberadoEm = DateTime.Now;
            Verificar();
            Mudou?.Invoke();
        }

        public void PedirTodos()
        {
            foreach (var t in cfg.Trabalhos)
                if (t.Ativo && Permitido(t) && !Executando(t) && !Fila.Contains(t.Id)) Fila.Add(t.Id);
            LiberadoEm = DateTime.Now;
            Verificar();
            Mudou?.Invoke();
        }

        public void Cancelar()
        {
            if (Atual != null) Atual.Progresso.Cancelar = true;
        }

        bool NaBateria()
        {
            try { return SystemInformation.PowerStatus.PowerLineStatus == PowerLineStatus.Offline; } catch { return false; }
        }

        /// <summary>Chamado a cada poucos segundos: começa o próximo backup, se houver.</summary>
        public void Verificar()
        {
            if (Atual != null) return;
            var agora = DateTime.Now;
            if (agora < LiberadoEm) return;

            // 1) Backups que precisam anotar o "ponto de partida".
            foreach (var t in cfg.Trabalhos)
            {
                if (!Agenda.BaseNecessaria(t) || !Permitido(t)) continue;
                if (t.AguardarAte == null || t.AguardarAte <= agora || Fila.Contains(t.Id)) { Iniciar(t, "base", Fila.Contains(t.Id)); return; }
            }
            // 2) Pedidos de "Fazer backup agora".
            while (Fila.Count > 0)
            {
                var t = cfg.Achar(Fila[0]);
                Fila.RemoveAt(0);
                if (t != null && Permitido(t)) { Iniciar(t, "backup", true); return; }
            }
            // 3) O backup agendado mais atrasado.
            if (cfg.PausaGeral || (cfg.NaoUsarBateria && NaBateria())) return;
            Trabalho escolhido = null;
            DateTime? menor = null;
            foreach (var t in cfg.Trabalhos)
            {
                if (Agenda.BaseNecessaria(t) || !Permitido(t) || !Agenda.Vencido(t, agora)) continue;
                var p = Agenda.Proxima(t);
                if (menor == null || p < menor) { menor = p; escolhido = t; }
            }
            if (escolhido != null) Iniciar(escolhido, "backup", false);
        }

        void Iniciar(Trabalho t, string tipo, bool manual)
        {
            if (tipo == "backup" && t.IgnorarExistentes && !System.IO.File.Exists(Caminhos.ArquivoBase(t.Id))) t.BaseRegistradaEm = null;
            if (tipo == "backup" && Agenda.BaseNecessaria(t))
            {
                tipo = "base";
                if (manual && !Fila.Contains(t.Id)) Fila.Insert(0, t.Id);
            }
            var ex = new Execucao { Id = t.Id, Nome = t.Nome, Tipo = tipo, Manual = manual };
            var op = new OpcoesBackup
            {
                Origem = t.Origem,
                Destino = t.DestinoFinal,
                Modo = t.Modo,
                Nome = t.Nome,
                ArquivoHistorico = Caminhos.ArquivoHistorico(t.Id),
                ArquivoBase = t.IgnorarExistentes ? Caminhos.ArquivoBase(t.Id) : "",
                RegistrarBase = tipo == "base",
                Exclusoes = t.ListaExclusoes(),
            };
            Atual = ex;
            var thread = new Thread(() =>
            {
                Resultado r;
                try { r = Motor.Executar(op, ex.Progresso); }
                catch (Exception e2) { r = new Resultado { Status = "erro", Mensagem = Motor.Mensagem(e2) }; }
                try { ui.BeginInvoke(new Action(() => Concluir(ex, r))); } catch { }
            })
            { IsBackground = true, Priority = ThreadPriority.BelowNormal, Name = "Backup " + t.Nome };
            thread.Start();
            Mudou?.Invoke();
        }

        void Concluir(Execucao e, Resultado res)
        {
            Atual = null;
            var t = cfg.Achar(e.Id);
            if (t == null) { Mudou?.Invoke(); return; }   // foi removido enquanto rodava
            var agora = DateTime.Now;
            string anterior = t.UltimoStatus;
            switch (res.Status)
            {
                case "base":
                    t.BaseRegistradaEm = agora;
                    t.AguardarAte = null;
                    t.UltimoStatus = "base";
                    t.UltimoResumo = res.Mensagem;
                    break;
                case "indisponivel":
                    t.AguardarAte = agora.AddMinutes(10);
                    t.UltimoStatus = "indisponivel";
                    t.UltimoResumo = "Aguardando: " + res.Mensagem;
                    break;
                case "erro":
                    t.AguardarAte = agora.AddMinutes(30);
                    t.UltimoStatus = "erro";
                    t.UltimoResumo = res.Mensagem;
                    break;
                case "cancelado":
                    t.AguardarAte = agora.AddHours(2);
                    t.UltimoStatus = "cancelado";
                    t.UltimoResumo = res.Mensagem + " Tenta de novo " + Textos.DataAmigavel(agora.AddHours(2)) + ".";
                    break;
                default:
                    t.UltimaExecucao = e.Inicio;
                    t.AguardarAte = null;
                    t.UltimoStatus = res.Status;
                    t.UltimoResumo = res.Mensagem;
                    t.UltimosCopiados = res.Copiados;
                    t.TotalCopiados += res.Copiados;
                    break;
            }
            if (e.Tipo == "base" && res.Status != "base") Fila.Remove(t.Id);
            try { cfg.Salvar(); } catch (Exception ex) { Caminhos.LogErro("Salvar: " + ex.Message); }
            Concluiu?.Invoke(t, res, e, anterior);
            Mudou?.Invoke();
            LiberadoEm = DateTime.Now;
        }
    }
}
