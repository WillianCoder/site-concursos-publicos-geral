using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using BackupAutomatico.Nucleo;

// Testes automáticos do núcleo do Backup Automático.
// Rodar: dotnet run --project testes-cs  (sai com código = número de falhas)
static class Testes
{
    static int falhas, total;
    static string raiz;

    static void Ok(bool cond, string desc)
    {
        total++;
        if (cond) Console.WriteLine("  ok    " + desc);
        else { falhas++; Console.ForegroundColor = ConsoleColor.Red; Console.WriteLine("  FALHA " + desc); Console.ResetColor(); }
    }

    static void Igual(object obtido, object esperado, string desc) =>
        Ok(Equals(obtido, esperado), desc + " (esperado: '" + esperado + "', obtido: '" + obtido + "')");

    static DateTime D(string s) => DateTime.ParseExact(s, "yyyy-MM-dd HH:mm", System.Globalization.CultureInfo.InvariantCulture);
    static string P(params string[] partes) => Path.Combine(partes);

    static void Arquivo(string caminho, string conteudo = "x", DateTime? data = null)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(caminho));
        File.WriteAllText(caminho, conteudo);
        if (data != null) File.SetLastWriteTime(caminho, data.Value);
    }

    static void Secao(string nome) { Console.ForegroundColor = ConsoleColor.Cyan; Console.WriteLine("\n" + nome); Console.ResetColor(); }

    static int Main()
    {
        raiz = P(Path.GetTempPath(), "bkpauto-teste-" + Guid.NewGuid().ToString("N").Substring(0, 8));
        Directory.CreateDirectory(raiz);
        Environment.SetEnvironmentVariable("BACKUPAUTO_DADOS", P(raiz, "dados"));
        try
        {
            TestarTextos();
            TestarAgenda();
            TestarCaminhos();
            TestarJsonEConfig();
            TestarMotor();
            TestarPontoDePartida();
            TestarEspeciais();
            TestarPixEQr();
            TestarNuvemOffline();
        }
        catch (Exception ex)
        {
            falhas++;
            Console.WriteLine("ERRO INESPERADO: " + ex);
        }
        finally
        {
            try { Directory.Delete(raiz, true); } catch { }
        }
        Console.WriteLine();
        Console.WriteLine(falhas == 0 ? "Todos os " + total + " testes passaram." : falhas + " de " + total + " testes falharam.");
        return falhas;
    }

    static void TestarTextos()
    {
        Secao("Textos");
        Igual(Textos.Frequencia(1, "semanas"), "Toda semana", "frequência semanal");
        Igual(Textos.Frequencia(3, "dias"), "A cada 3 dias", "a cada 3 dias");
        Igual(Textos.Frequencia(1, "meses"), "Todo mês", "mensal");
        Igual(Textos.Tamanho(1536), "1,5 KB", "tamanho em KB");
        Igual(Textos.Tamanho(500), "500 bytes", "tamanho em bytes");
        Igual(Textos.Plural(1, "arquivo", "arquivos"), "1 arquivo", "singular");
        Igual(Textos.Plural(1234, "arquivo", "arquivos"), "1.234 arquivos", "plural com milhar");
        var agora = D("2026-10-07 10:00");
        Igual(Textos.DataAmigavel(D("2026-10-07 18:00"), agora), "hoje às 18:00", "hoje");
        Igual(Textos.DataAmigavel(D("2026-10-08 09:30"), agora), "amanhã às 09:30", "amanhã");
        Igual(Textos.DataAmigavel(D("2026-10-09 18:00"), agora), "sex, 09/10 às 18:00", "na semana");
        Igual(Textos.DataAmigavel(D("2027-01-04 08:00"), agora), "seg, 04/01/2027 às 08:00", "outro ano");
        Igual(Textos.Duracao(TimeSpan.FromSeconds(83)), "1 min 23 s", "duração");
        Igual(Textos.Agendamento(1, "semanas", D("2026-10-09 18:00")), "Toda semana, sex às 18:00", "descrição semanal");
        Igual(Textos.Agendamento(1, "meses", D("2026-10-15 08:30")), "Todo mês, dia 15 às 08:30", "descrição mensal");
        Igual(Textos.Dinheiro(9.9), "R$ 9,90", "dinheiro");
    }

    static void TestarAgenda()
    {
        Secao("Agenda");
        var t = new Trabalho { Inicio = D("2026-10-02 18:00"), IntervaloValor = 1, IntervaloUnidade = "semanas" };
        Igual(Agenda.Proxima(t), D("2026-10-02 18:00"), "nunca executado: roda no início");
        t.UltimaExecucao = D("2026-10-02 18:00").AddSeconds(5);
        Igual(Agenda.Proxima(t), D("2026-10-09 18:00"), "semanal: próxima sexta");
        t.UltimaExecucao = D("2026-10-25 09:00");
        Igual(Agenda.Proxima(t), D("2026-10-30 18:00"), "atrasado volta para a grade");
        Ok(Agenda.Vencido(t, D("2026-10-30 18:00")), "vence na hora");
        Ok(!Agenda.Vencido(t, D("2026-10-30 17:59")), "não vence antes");
        t.Ativo = false;
        Ok(!Agenda.Vencido(t, D("2026-11-30 18:00")), "pausado nunca vence");

        var m = new Trabalho { Inicio = D("2026-01-31 08:00"), IntervaloUnidade = "meses", UltimaExecucao = D("2026-01-31 08:00") };
        Igual(Agenda.Proxima(m), D("2026-02-28 08:00"), "dia 31 cai no fim de fevereiro");
        m.UltimaExecucao = D("2026-02-28 08:00");
        Igual(Agenda.Proxima(m), D("2026-03-31 08:00"), "volta para o dia 31");
        var a = new Trabalho { Inicio = D("2026-03-10 12:00"), IntervaloUnidade = "anos", UltimaExecucao = D("2027-05-01 00:00") };
        Igual(Agenda.Proxima(a), D("2028-03-10 12:00"), "anual");
        var h = new Trabalho { Inicio = D("2026-10-07 00:00"), IntervaloValor = 6, IntervaloUnidade = "horas", UltimaExecucao = D("2026-10-07 13:10") };
        Igual(Agenda.Proxima(h), D("2026-10-07 18:00"), "a cada 6 horas");
        h.AguardarAte = D("2026-10-07 19:30");
        Igual(Agenda.Proxima(h), D("2026-10-07 19:30"), "espera quando o destino estava indisponível");

        var agora = D("2026-10-07 10:00"); // quarta
        Igual(Agenda.PrimeiraOcorrencia("dias", 18, 0, DayOfWeek.Monday, 1, 1, agora), D("2026-10-07 18:00"), "diário: hoje mais tarde");
        Igual(Agenda.PrimeiraOcorrencia("dias", 8, 0, DayOfWeek.Monday, 1, 1, agora), D("2026-10-08 08:00"), "diário: amanhã");
        Igual(Agenda.PrimeiraOcorrencia("semanas", 18, 0, DayOfWeek.Friday, 1, 1, agora), D("2026-10-09 18:00"), "semanal: sexta");
        Igual(Agenda.PrimeiraOcorrencia("semanas", 9, 0, DayOfWeek.Wednesday, 1, 1, agora), D("2026-10-14 09:00"), "semanal: hoje já passou");
        Igual(Agenda.PrimeiraOcorrencia("meses", 8, 0, DayOfWeek.Monday, 31, 1, agora), D("2026-10-31 08:00"), "mensal: dia 31");
        Igual(Agenda.PrimeiraOcorrencia("meses", 8, 0, DayOfWeek.Monday, 5, 1, agora), D("2026-11-05 08:00"), "mensal: mês que vem");
        Igual(Agenda.PrimeiraOcorrencia("anos", 8, 0, DayOfWeek.Monday, 29, 2, agora), D("2027-02-28 08:00"), "anual: 29/02 em ano comum");
    }

    static void TestarCaminhos()
    {
        Secao("Caminhos e validação");
        string origem = P(raiz, "Minhas Fotos");
        string destinoBase = P(raiz, "Backups", "Backup Automático");
        Directory.CreateDirectory(origem);
        var t = new Trabalho { Nome = "Fotos", Origem = origem, DestinoBase = destinoBase, CriarSubpasta = true };
        Igual(t.DestinoFinal, P(destinoBase, "Minhas Fotos"), "subpasta com o nome da origem");
        Igual(Agenda.Validar(t).Count, 0, "trabalho válido");
        t.DestinoBase = P(origem, "dentro"); t.CriarSubpasta = false;
        Igual(Agenda.Validar(t).Count, 1, "destino dentro da origem é recusado");
        t.DestinoBase = destinoBase; t.IntervaloUnidade = "minutos"; t.IntervaloValor = 2;
        Igual(Agenda.Validar(t).Count, 1, "menos de 5 minutos é recusado");
        Ok(Caminhos.Dentro(P(raiz, "a", "b"), P(raiz, "a")), "caminho dentro");
        Ok(!Caminhos.Dentro(P(raiz, "ab"), P(raiz, "a")), "prefixo parecido não conta");
        Ok(Motor.Coincide("arquivo.TMP", "*.tmp"), "padrão *.tmp");
        Ok(Motor.Coincide("node_modules", "node_modules"), "padrão exato");
        Ok(Motor.Coincide("~$planilha.xlsx", "~$*"), "padrão ~$*");
        Ok(!Motor.Coincide("foto.jpg", "*.tmp"), "padrão não coincide");
        Ok(Motor.Coincide("relatorio-2026.pdf", "relatorio-????.pdf"), "padrão com ?");
    }

    static void TestarJsonEConfig()
    {
        Secao("JSON e configuração");
        var o = Json.Ler("{\"a\": [1, 2.5, \"x\\n\\u00e7\"], \"b\": {\"c\": true, \"d\": null}}") as Dictionary<string, object>;
        Igual(((List<object>)o["a"])[0], 1L, "inteiro");
        Igual(((List<object>)o["a"])[1], 2.5, "decimal");
        Igual(((List<object>)o["a"])[2], "x\nç", "texto com escape");
        Igual(Json.Escrever(Json.Ler(Json.Escrever(o))), Json.Escrever(o), "ida e volta");

        var cfg = Configuracao.Ler();
        Igual(cfg.Trabalhos.Count, 0, "configuração nova vazia");
        cfg.Trabalhos.Add(new Trabalho { Nome = "Documentos ação", Origem = @"C:\Usuários\José\Documentos", IntervaloValor = 2, IntervaloUnidade = "dias", Exclusoes = "*.tmp; Cache" });
        cfg.Tema = "escuro";
        cfg.Salvar();
        var lida = Configuracao.Ler();
        Igual(lida.Trabalhos.Count, 1, "salva e lê");
        Igual(lida.Trabalhos[0].Nome, "Documentos ação", "acentos");
        Igual(lida.Trabalhos[0].Origem, @"C:\Usuários\José\Documentos", "caminho");
        Igual(lida.Trabalhos[0].IntervaloValor, 2, "número");
        Igual(lida.Trabalhos[0].Inicio, cfg.Trabalhos[0].Inicio, "data");
        Igual(lida.Tema, "escuro", "tema");
        Igual(lida.Trabalhos[0].ListaExclusoes().Count, 2, "exclusões");
        lida.Salvar();
        File.WriteAllText(Caminhos.ArquivoConfig, "{ quebrado");
        Igual(Configuracao.Ler().Trabalhos.Count, 1, "arquivo corrompido: usa a cópia .bak");

        // Configuração gravada pela versão antiga (PowerShell) continua funcionando.
        string antigo = "{\n  \"versao\": 1,\n  \"iniciarComWindows\": true,\n  \"notificacoes\": false,\n  \"trabalhos\": [\n    {\n      \"id\": \"abc1234567\",\n      \"nome\": \"Fotos\",\n      \"origem\": \"C:\\\\Fotos\",\n      \"destinoBase\": \"G:\\\\Meu Drive\\\\Backup\",\n      \"criarSubpasta\": true,\n      \"modo\": \"novos\",\n      \"intervaloValor\": 1,\n      \"intervaloUnidade\": \"semanas\",\n      \"inicio\": \"2026-10-02T18:00:00\",\n      \"ativo\": true,\n      \"ignorarExistentes\": false,\n      \"baseRegistradaEm\": null,\n      \"ultimaExecucao\": \"2026-10-02T18:00:05\",\n      \"ultimoStatus\": \"ok\",\n      \"ultimoResumo\": \"3 arquivos novos copiados.\",\n      \"ultimosCopiados\": 3,\n      \"totalCopiados\": 10,\n      \"aguardarAte\": null,\n      \"criadoEm\": \"2026-10-01T10:00:00\"\n    }\n  ]\n}";
        File.WriteAllText(Caminhos.ArquivoConfig, antigo);
        var v1 = Configuracao.Ler();
        Igual(v1.Trabalhos.Count, 1, "lê configuração da versão 1");
        Igual(v1.Notificacoes, false, "versão 1: notificações");
        Igual(v1.Trabalhos[0].UltimaExecucao, D("2026-10-02 18:00").AddSeconds(5), "versão 1: última execução");
        Igual(v1.Trabalhos[0].TotalCopiados, 10L, "versão 1: total copiado");
        Igual(v1.Tema, "auto", "versão 1: tema padrão");
    }

    static void TestarMotor()
    {
        Secao("Motor de backup");
        string src = P(raiz, "origem"), dst = P(raiz, "destino");
        var ontem = DateTime.Now.AddDays(-1);
        Arquivo(P(src, "a.txt"), "aaa", ontem);
        Arquivo(P(src, "sub", "b.txt"), "bbb", ontem);
        Arquivo(P(src, "sub", "fundo", "c ção.txt"), "ccc", ontem);
        Arquivo(P(src, "desktop.ini"), "ignorar");
        Arquivo(P(src, "~$planilha.xlsx"), "ignorar");
        Arquivo(P(src, ".tmp.driveupload", "x.bin"), "ignorar");
        Arquivo(P(src, "Cache", "lixo.bin"), "ignorar por exclusão");
        string hist = Caminhos.ArquivoHistorico("teste");
        OpcoesBackup Op(string modo = "novos") => new OpcoesBackup { Origem = src, Destino = dst, Modo = modo, Nome = "Teste", ArquivoHistorico = hist, Exclusoes = new List<string> { "Cache" } };

        var p = new Progresso();
        var r = Motor.Executar(Op(), p);
        Igual(r.Status, "ok", "1ª execução: status");
        Igual(r.Copiados, 3, "1ª execução copia tudo (menos ignorados)");
        Ok(File.Exists(P(dst, "sub", "fundo", "c ção.txt")), "subpastas e acentos");
        Ok(!File.Exists(P(dst, "desktop.ini")), "desktop.ini ignorado");
        Ok(!File.Exists(P(dst, "~$planilha.xlsx")), "temporário do Office ignorado");
        Ok(!Directory.Exists(P(dst, "Cache")), "exclusão personalizada respeitada");
        Igual(File.GetLastWriteTime(P(dst, "a.txt")).ToString("s"), ontem.ToString("s"), "data preservada");
        Igual(p.Fracao, 1.0, "progresso chega a 100%");

        r = Motor.Executar(Op());
        Igual(r.Copiados, 0, "2ª execução sem novidades");
        Igual(r.Mensagem, "Nenhum arquivo novo.", "mensagem sem novidades");

        Arquivo(P(src, "novo.pdf"), "novo");
        Arquivo(P(src, "a.txt"), "aaa modificado");
        r = Motor.Executar(Op());
        Igual(r.Copiados, 1, "modo novos: só o novo");
        Igual(File.ReadAllText(P(dst, "a.txt")), "aaa", "modo novos: modificado não sobrescreve");

        r = Motor.Executar(Op("alterados"));
        Igual(r.Alterados, 1, "modo alterados: copia o modificado");
        Igual(File.ReadAllText(P(dst, "a.txt")), "aaa modificado", "modo alterados: conteúdo atualizado");
        r = Motor.Executar(Op("alterados"));
        Igual(r.Copiados, 0, "modo alterados: nada na repetição");

        File.Delete(P(src, "novo.pdf"));
        Motor.Executar(Op());
        Ok(File.Exists(P(dst, "novo.pdf")), "apagar na origem não apaga do backup");

        Arquivo(P(dst, "sub", "d.txt" + Motor.SufixoParcial), "pela metade");
        Arquivo(P(src, "sub", "d.txt"), "ddd");
        Motor.Executar(Op());
        Ok(!File.Exists(P(dst, "sub", "d.txt" + Motor.SufixoParcial)), "restos de cópia interrompida limpos");
        Igual(File.ReadAllText(P(dst, "sub", "d.txt")), "ddd", "arquivo inteiro");
        Ok(File.ReadAllText(hist).Contains("+ novo.pdf"), "histórico lista os arquivos");
    }

    static void TestarPontoDePartida()
    {
        Secao("Só o que for adicionado daqui pra frente");
        string src = P(raiz, "origem2"), dst = P(raiz, "destino2");
        Arquivo(P(src, "antigo1.txt"), "1");
        Arquivo(P(src, "pasta", "antigo2.txt"), "2");
        string b = Caminhos.ArquivoBase("teste2");
        var r = Motor.Executar(new OpcoesBackup { Origem = src, RegistrarBase = true, ArquivoBase = b });
        Igual(r.Status, "base", "ponto de partida registrado");
        Igual(r.Ignorados, 2, "dois antigos");
        Arquivo(P(src, "pasta", "recente.txt"), "3");
        r = Motor.Executar(new OpcoesBackup { Origem = src, Destino = dst, ArquivoBase = b });
        Igual(r.Copiados, 1, "só o adicionado depois");
        Igual(r.Ignorados, 2, "antigos ignorados");
        Ok(!File.Exists(P(dst, "antigo1.txt")), "antigo não foi para o backup");
        r = Motor.Executar(new OpcoesBackup { Origem = src, Destino = P(raiz, "destino2b"), ArquivoBase = P(raiz, "nao-existe.txt") });
        Igual(r.Status, "erro", "sem ponto de partida não copia tudo por engano");
    }

    static void TestarEspeciais()
    {
        Secao("Situações especiais");
        string src = P(raiz, "origem");
        var r = Motor.Executar(new OpcoesBackup { Origem = P(raiz, "nao-existe"), Destino = P(raiz, "x") });
        Igual(r.Status, "indisponivel", "origem ausente = indisponível");
        var p = new Progresso { Cancelar = true };
        r = Motor.Executar(new OpcoesBackup { Origem = src, Destino = P(raiz, "destino3") }, p);
        Igual(r.Status, "cancelado", "cancelamento");
        r = Motor.Executar(new OpcoesBackup { Origem = src, Destino = P(src, "backup") });
        Igual(r.Status, "erro", "destino dentro da origem recusado");

        // Arquivo grande: progresso por bytes.
        string g = P(raiz, "grande"), gd = P(raiz, "grande-destino");
        Directory.CreateDirectory(g);
        File.WriteAllBytes(P(g, "video.bin"), new byte[5 * 1024 * 1024 + 123]);
        var pg = new Progresso();
        r = Motor.Executar(new OpcoesBackup { Origem = g, Destino = gd }, pg);
        Igual(new FileInfo(P(gd, "video.bin")).Length, 5L * 1024 * 1024 + 123, "arquivo grande copiado inteiro");
        Igual(pg.BytesFeitos, pg.BytesTotal, "bytes contados");
    }

    static void TestarPixEQr()
    {
        Secao("Pix e QR Code");
        // Exemplo oficial do manual do BR Code (CRC 1D3D).
        string exemplo = "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304";
        Igual(Pix.Crc16(exemplo).ToString("X4"), "1D3D", "CRC16 do exemplo oficial");
        string c = Pix.Codigo("123.456.789-09", "José da Silva", "São Paulo", 10, "Doacao");
        Ok(c.StartsWith("000201"), "começa com o indicador");
        Ok(c.Contains("0014br.gov.bcb.pix0111" + "12345678909"), "chave CPF sem pontuação");
        Ok(c.Contains("5913JOSE DA SILVA"), "nome sem acentos");
        Ok(c.Contains("6009SAO PAULO"), "cidade sem acentos");
        Ok(c.Contains("540510.00"), "valor");
        Igual(Pix.Crc16(c.Substring(0, c.Length - 4)).ToString("X4"), c.Substring(c.Length - 4), "CRC confere");
        Igual(Pix.NormalizarChave("Fulano@Email.com"), "fulano@email.com", "e-mail em minúsculas");
        Igual(Pix.NormalizarChave("+55 (11) 91234-5678"), "+5511912345678", "celular");

        var qr = Qr.Gerar(c);
        Ok(qr.Tamanho == qr.Versao * 4 + 17, "QR: tamanho coerente");
        Ok(qr.Escuro(0, 0) && qr.Escuro(6, 6) && !qr.Escuro(7, 7), "QR: padrão localizador");
        // Exporta como PGM para conferência externa (zbarimg nos testes do CI/Linux).
        string pgm = Environment.GetEnvironmentVariable("BACKUPAUTO_QR_SAIDA");
        if (!string.IsNullOrEmpty(pgm))
        {
            int esc = 6, borda = 4, n = (qr.Tamanho + borda * 2) * esc;
            var sb = new StringBuilder("P2\n" + n + " " + n + "\n255\n");
            for (int y = 0; y < n; y++)
            {
                for (int x = 0; x < n; x++) sb.Append(qr.Escuro(x / esc - borda, y / esc - borda) ? "0 " : "255 ");
                sb.Append('\n');
            }
            File.WriteAllText(pgm, sb.ToString());
            File.WriteAllText(pgm + ".txt", c);
        }
    }

    static void TestarNuvemOffline()
    {
        Secao("Nuvem (sem internet)");
        string js = "window.ATLAS_CONFIG = {\n \"pix\": { \"chave\": \"a@b.com\", \"nome\": \"Fulano\", \"cidade\": \"Rio\", \"valores\": [5, 10] },\n \"firebase\": { \"apiKey\": \"AIza123\", \"projectId\": \"meu-projeto\" },\n \"adminEmail\": \"Admin@Site.com\"\n};";
        var n = Nuvem.DoTextoConfigSite(js);
        Igual(n.ApiKey, "AIza123", "lê apiKey do config.js do site");
        Igual(n.ProjectId, "meu-projeto", "lê projectId");
        Ok(n.EhAdmin(new Sessao { Email = "admin@site.com", EmailVerificado = true }), "admin reconhecido (sem diferenciar maiúsculas)");
        Ok(!n.EhAdmin(new Sessao { Email = "admin@site.com", EmailVerificado = false }), "admin precisa de e-mail confirmado");
        Ok(!n.EhAdmin(new Sessao { Email = "outro@site.com", EmailVerificado = true }), "outra conta não é admin");
        Igual(n.PixDoSite.PixChave, "a@b.com", "Pix do site como reserva");
        var semFirebase = Nuvem.DoTextoConfigSite("window.ATLAS_CONFIG = { \"firebase\": null, \"adminEmail\": \"\" };");
        Ok(!semFirebase.Configurada, "sem Firebase: contas indisponíveis");

        var cfg = new ConfigApp { PixChave = "x@y.com", LimiteGratis = 3 };
        var doc = Nuvem.ParaDocumento(cfg.ParaFirestore());
        var volta = ConfigApp.DeDicionario(Nuvem.DeDocumento(Json.Ler(Json.Escrever(doc)) as Dictionary<string, object>));
        Igual(volta.PixChave, "x@y.com", "Firestore: ida e volta do texto");
        Igual(volta.LimiteGratis, 3, "Firestore: ida e volta do número");
        Igual(volta.Planos.Count, 3, "Firestore: lista de planos");
        Igual(volta.Planos[1].Valor, 59.90, "Firestore: valor do plano");
        Igual(Recursos.LimitePastas(Plano.Gratis, volta), 3, "limite grátis");
        Ok(Recursos.LimitePastas(Plano.Pro, volta) > 1000, "Pro ilimitado");
        Ok(Nuvem.NovoCodigoPedido().StartsWith("BKP") && Nuvem.NovoCodigoPedido().Length == 9, "código de pedido");
        var lic = new Licenca { Plano = "pro", ValidoAte = DateTime.Now.AddDays(-1) };
        Ok(!lic.Valida(DateTime.Now), "licença vencida");
        lic.ValidoAte = null;
        Ok(lic.Valida(DateTime.Now), "licença vitalícia");
        Igual(Nuvem.TraduzirErro("INVALID_LOGIN_CREDENTIALS", 400), "E-mail ou senha incorretos.", "mensagem de erro em português");
    }
}
