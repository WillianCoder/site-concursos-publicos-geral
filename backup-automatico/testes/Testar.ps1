# Testes automáticos do núcleo do Backup Automático.
# Rodar:  powershell -NoProfile -ExecutionPolicy Bypass -File testes\Testar.ps1
# Não mexe nas suas configurações: usa uma pasta temporária.

$ErrorActionPreference = 'Stop'
$raizTeste = [IO.Path]::Combine([IO.Path]::GetTempPath(), 'bkpauto-teste-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
[void][IO.Directory]::CreateDirectory($raizTeste)
$env:BACKUPAUTO_DADOS = [IO.Path]::Combine($raizTeste, 'dados')

. ([IO.Path]::Combine($PSScriptRoot, '..', 'app', 'Nucleo.ps1'))

$script:Falhas = 0
$script:Total = 0
function Confirmar([bool]$Condicao, [string]$Descricao) {
    $script:Total++
    if ($Condicao) { Write-Host "  ok    $Descricao" -ForegroundColor Green }
    else { $script:Falhas++; Write-Host "  FALHA $Descricao" -ForegroundColor Red }
}
function Igual($Obtido, $Esperado, [string]$Descricao) {
    Confirmar ($Obtido -eq $Esperado) "$Descricao (esperado: '$Esperado', obtido: '$Obtido')"
}
function Novo-Arquivo([string]$Caminho, [string]$Conteudo = 'x', $Data = $null) {
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($Caminho))
    [IO.File]::WriteAllText($Caminho, $Conteudo)
    if ($null -ne $Data) { [IO.File]::SetLastWriteTime($Caminho, $Data) }
}
function D([string]$Texto) { return [datetime]::ParseExact($Texto, 'yyyy-MM-dd HH:mm', [Globalization.CultureInfo]::InvariantCulture) }
function P { return [IO.Path]::Combine([string[]]$args) }

try {
    Write-Host "`nTextos" -ForegroundColor Cyan
    Igual (Format-Frequencia 1 'semanas') 'Toda semana' 'frequência semanal'
    Igual (Format-Frequencia 3 'dias') 'A cada 3 dias' 'frequência a cada 3 dias'
    Igual (Format-Frequencia 1 'meses') 'Todo mês' 'frequência mensal'
    Igual (Format-Tamanho 1536) '1,5 KB' 'tamanho em KB'
    Igual (Format-Tamanho 500) '500 bytes' 'tamanho em bytes'
    Igual (Format-Plural 1 'arquivo' 'arquivos') '1 arquivo' 'singular'
    Igual (Format-Plural 1234 'arquivo' 'arquivos') '1.234 arquivos' 'plural com milhar'
    $agora = D '2026-10-07 10:00'
    Igual (Format-DataAmigavel (D '2026-10-07 18:00') $agora) 'hoje às 18:00' 'data de hoje'
    Igual (Format-DataAmigavel (D '2026-10-08 09:30') $agora) 'amanhã às 09:30' 'data de amanhã'
    Igual (Format-DataAmigavel (D '2026-10-09 18:00') $agora) 'sex, 09/10 às 18:00' 'data na semana'
    Igual (Format-DataAmigavel (D '2027-01-04 08:00') $agora) 'seg, 04/01/2027 às 08:00' 'data em outro ano'
    Igual (Format-Duracao ([TimeSpan]::FromSeconds(83))) '1 min 23 s' 'duração'

    Write-Host "`nAgenda" -ForegroundColor Cyan
    $t = New-Trabalho @{ inicio = '2026-10-02T18:00:00'; intervaloValor = 1; intervaloUnidade = 'semanas' }
    Igual (Get-ProximaExecucao $t) (D '2026-10-02 18:00') 'nunca executado: roda no início'
    $t.ultimaExecucao = '2026-10-02T18:00:05'
    Igual (Get-ProximaExecucao $t) (D '2026-10-09 18:00') 'semanal: próxima sexta no mesmo horário'
    $t.ultimaExecucao = '2026-10-25T09:00:00'
    Igual (Get-ProximaExecucao $t) (D '2026-10-30 18:00') 'atrasado (PC desligado): volta para a grade'
    Confirmar (Test-BackupVencido $t (D '2026-10-30 18:00')) 'vence na hora marcada'
    Confirmar (-not (Test-BackupVencido $t (D '2026-10-30 17:59'))) 'não vence antes da hora'
    $t.ativo = $false
    Confirmar (-not (Test-BackupVencido $t (D '2026-11-30 18:00'))) 'pausado nunca vence'

    $m = New-Trabalho @{ inicio = '2026-01-31T08:00:00'; intervaloValor = 1; intervaloUnidade = 'meses'; ultimaExecucao = '2026-01-31T08:00:00' }
    Igual (Get-ProximaExecucao $m) (D '2026-02-28 08:00') 'mensal no dia 31 cai no último dia de fevereiro'
    $m.ultimaExecucao = '2026-02-28T08:00:00'
    Igual (Get-ProximaExecucao $m) (D '2026-03-31 08:00') 'mensal volta para o dia 31 em março'
    $a = New-Trabalho @{ inicio = '2026-03-10T12:00:00'; intervaloValor = 1; intervaloUnidade = 'anos'; ultimaExecucao = '2027-05-01T00:00:00' }
    Igual (Get-ProximaExecucao $a) (D '2028-03-10 12:00') 'anual'
    $h = New-Trabalho @{ inicio = '2026-10-07T00:00:00'; intervaloValor = 6; intervaloUnidade = 'horas'; ultimaExecucao = '2026-10-07T13:10:00' }
    Igual (Get-ProximaExecucao $h) (D '2026-10-07 18:00') 'a cada 6 horas'
    $h.aguardarAte = '2026-10-07T19:30:00'
    Igual (Get-ProximaExecucao $h) (D '2026-10-07 19:30') 'espera quando o destino estava indisponível'
    $mi = New-Trabalho @{ inicio = '2026-10-07T10:00:00'; intervaloValor = 15; intervaloUnidade = 'minutos'; ultimaExecucao = '2026-10-09T10:00:00' }
    Igual (Get-ProximaExecucao $mi) (D '2026-10-09 10:15') 'a cada 15 minutos'

    Write-Host "`nCaminhos e validação" -ForegroundColor Cyan
    $origem = P $raizTeste 'Minhas Fotos'
    $destinoBase = P $raizTeste 'Google Drive' 'Backup Automático'
    [void][IO.Directory]::CreateDirectory($origem)
    $tv = New-Trabalho @{ nome = 'Fotos'; origem = $origem; destinoBase = $destinoBase; criarSubpasta = $true }
    Igual (Get-DestinoFinal $tv) (P $destinoBase 'Minhas Fotos') 'subpasta com o nome da origem'
    Igual (Test-Trabalho $tv).Count 0 'trabalho válido'
    $tv.destinoBase = P $origem 'dentro'
    $tv.criarSubpasta = $false
    Confirmar ((Test-Trabalho $tv).Count -eq 1) 'destino dentro da origem é recusado'
    $tv.destinoBase = $destinoBase
    $tv.intervaloUnidade = 'minutos'; $tv.intervaloValor = 2
    Confirmar ((Test-Trabalho $tv).Count -eq 1) 'menos de 5 minutos é recusado'
    Confirmar (Test-CaminhoDentro (P $raizTeste 'a' 'b') (P $raizTeste 'a')) 'caminho dentro'
    Confirmar (-not (Test-CaminhoDentro (P $raizTeste 'ab') (P $raizTeste 'a'))) 'prefixo parecido não conta como dentro'

    Write-Host "`nConfiguração" -ForegroundColor Cyan
    $cfg = Read-Configuracao
    Igual $cfg.trabalhos.Count 0 'configuração nova vem vazia'
    [void]$cfg.trabalhos.Add((New-Trabalho @{ nome = 'Documentos ação'; origem = 'C:\Usuários\José\Documentos'; intervaloValor = 2; intervaloUnidade = 'dias' }))
    Save-Configuracao $cfg
    $lida = Read-Configuracao
    Igual $lida.trabalhos.Count 1 'salva e lê 1 trabalho'
    Igual $lida.trabalhos[0].nome 'Documentos ação' 'acentos preservados'
    Igual $lida.trabalhos[0].origem 'C:\Usuários\José\Documentos' 'caminho preservado'
    Igual $lida.trabalhos[0].intervaloValor 2 'número preservado'
    Igual $lida.trabalhos[0].inicio $cfg.trabalhos[0].inicio 'data preservada'
    [void]$lida.trabalhos.Add((New-Trabalho @{ nome = 'Outro' }))
    Save-Configuracao $lida
    Igual (Read-Configuracao).trabalhos.Count 2 'salva e lê 2 trabalhos'
    $json = [IO.File]::ReadAllText((P $env:BACKUPAUTO_DADOS 'config.json'))
    Confirmar ($json -notmatch '"Count"') 'JSON sem o defeito value/Count'
    [IO.File]::WriteAllText((P $env:BACKUPAUTO_DADOS 'config.json'), '{ quebrado')
    Igual (Read-Configuracao).trabalhos.Count 1 'arquivo corrompido: usa a cópia .bak'

    Write-Host "`nMotor de backup" -ForegroundColor Cyan
    $src = P $raizTeste 'origem'
    $dst = P $raizTeste 'destino'
    $ontem = (Get-Date).AddDays(-1)
    Novo-Arquivo (P $src 'a.txt') 'aaa' $ontem
    Novo-Arquivo (P $src 'sub' 'b.txt') 'bbb' $ontem
    Novo-Arquivo (P $src 'sub' 'fundo' 'c ção.txt') 'ccc' $ontem
    Novo-Arquivo (P $src 'desktop.ini') 'ignorar'
    Novo-Arquivo (P $src '~$planilha.xlsx') 'ignorar'
    Novo-Arquivo (P $src '.tmp.driveupload' 'x.bin') 'ignorar'
    $hist = Get-ArquivoHistorico 'teste'

    $r = Invoke-Backup -Origem $src -Destino $dst -Nome 'Teste' -ArquivoHistorico $hist
    Igual $r.Status 'ok' '1ª execução: status'
    Igual $r.Copiados 3 '1ª execução copia tudo que existe (menos os ignorados)'
    Confirmar ([IO.File]::Exists((P $dst 'sub' 'fundo' 'c ção.txt'))) 'subpastas e acentos copiados'
    Confirmar (-not [IO.File]::Exists((P $dst 'desktop.ini'))) 'desktop.ini ignorado'
    Confirmar (-not [IO.File]::Exists((P $dst '~$planilha.xlsx'))) 'arquivo temporário do Office ignorado'
    Igual ([IO.File]::GetLastWriteTime((P $dst 'a.txt'))).ToString('s') $ontem.ToString('s') 'data do arquivo preservada'

    $r = Invoke-Backup -Origem $src -Destino $dst -Nome 'Teste' -ArquivoHistorico $hist
    Igual $r.Copiados 0 '2ª execução sem novidades não copia nada'
    Igual $r.Mensagem 'Nenhum arquivo novo.' 'mensagem sem novidades'

    Novo-Arquivo (P $src 'novo.pdf') 'novo'
    Novo-Arquivo (P $src 'a.txt') 'aaa modificado'
    $r = Invoke-Backup -Origem $src -Destino $dst -Nome 'Teste' -ArquivoHistorico $hist
    Igual $r.Copiados 1 'modo "novos": só o arquivo novo'
    Igual ([IO.File]::ReadAllText((P $dst 'a.txt'))) 'aaa' 'modo "novos": modificado não é sobrescrito'

    $r = Invoke-Backup -Origem $src -Destino $dst -Modo 'alterados' -Nome 'Teste' -ArquivoHistorico $hist
    Igual $r.Alterados 1 'modo "alterados": copia o modificado'
    Igual ([IO.File]::ReadAllText((P $dst 'a.txt'))) 'aaa modificado' 'modo "alterados": conteúdo atualizado'
    $r = Invoke-Backup -Origem $src -Destino $dst -Modo 'alterados' -Nome 'Teste' -ArquivoHistorico $hist
    Igual $r.Copiados 0 'modo "alterados": nada muda na repetição'

    Remove-Item -LiteralPath (P $src 'novo.pdf')
    $r = Invoke-Backup -Origem $src -Destino $dst -Nome 'Teste' -ArquivoHistorico $hist
    Confirmar ([IO.File]::Exists((P $dst 'novo.pdf'))) 'apagar na origem não apaga do backup'

    Novo-Arquivo (P $dst 'sub' ('d.txt' + $script:SufixoParcial)) 'pela metade'
    Novo-Arquivo (P $src 'sub' 'd.txt') 'ddd'
    $r = Invoke-Backup -Origem $src -Destino $dst -Nome 'Teste' -ArquivoHistorico $hist
    Confirmar (-not [IO.File]::Exists((P $dst 'sub' ('d.txt' + $script:SufixoParcial)))) 'restos de cópia interrompida são limpos'
    Igual ([IO.File]::ReadAllText((P $dst 'sub' 'd.txt'))) 'ddd' 'arquivo copiado por inteiro'

    $historico = [IO.File]::ReadAllText($hist)
    Confirmar ($historico -match [regex]::Escape('+ novo.pdf')) 'histórico lista os arquivos copiados'

    Write-Host "`nSó o que for adicionado daqui pra frente" -ForegroundColor Cyan
    $src2 = P $raizTeste 'origem2'
    $dst2 = P $raizTeste 'destino2'
    Novo-Arquivo (P $src2 'antigo1.txt') '1'
    Novo-Arquivo (P $src2 'pasta' 'antigo2.txt') '2'
    $base = Get-ArquivoBase 'teste2'
    $r = Invoke-Backup -Origem $src2 -RegistrarBase -ArquivoBase $base
    Igual $r.Status 'base' 'ponto de partida registrado'
    Igual $r.Ignorados 2 'dois arquivos antigos no ponto de partida'
    Novo-Arquivo (P $src2 'pasta' 'recente.txt') '3'
    $r = Invoke-Backup -Origem $src2 -Destino $dst2 -ArquivoBase $base
    Igual $r.Copiados 1 'só o arquivo adicionado depois é copiado'
    Igual $r.Ignorados 2 'antigos ignorados'
    Confirmar (-not [IO.File]::Exists((P $dst2 'antigo1.txt'))) 'arquivo antigo não foi para o backup'

    Write-Host "`nSituações especiais" -ForegroundColor Cyan
    $r = Invoke-Backup -Origem (P $raizTeste 'nao-existe') -Destino $dst
    Igual $r.Status 'indisponivel' 'origem ausente = indisponível (tenta de novo depois)'
    $sync = [hashtable]::Synchronized(@{ Cancelar = $true })
    $r = Invoke-Backup -Origem $src -Destino (P $raizTeste 'destino3') -Sync $sync
    Igual $r.Status 'cancelado' 'cancelamento respeitado'
    $r = Invoke-Backup -Origem $src -Destino (P $src 'backup')
    Igual $r.Status 'erro' 'destino dentro da origem é recusado pelo motor'

    Write-Host "`nExecução em segundo plano (como no Painel)" -ForegroundColor Cyan
    $textoNucleo = [IO.File]::ReadAllText([IO.Path]::Combine($PSScriptRoot, '..', 'app', 'Nucleo.ps1'))
    $sync = [hashtable]::Synchronized(@{ Cancelar = $false })
    $ps = [PowerShell]::Create()
    [void]$ps.AddScript($textoNucleo)
    [void]$ps.Invoke()
    $ps.Commands.Clear()
    Novo-Arquivo (P $src 'em-segundo-plano.txt') 'bg'
    [void]$ps.AddCommand('Invoke-Backup').AddParameters(@{ Origem = $src; Destino = $dst; Sync = $sync; Nome = 'BG' })
    $handle = $ps.BeginInvoke()
    $limite = (Get-Date).AddSeconds(30)
    while (-not $handle.IsCompleted -and (Get-Date) -lt $limite) { Start-Sleep -Milliseconds 100 }
    $saida = $ps.EndInvoke($handle)
    $rb = $saida[$saida.Count - 1]
    Igual $saida.Count 1 'o motor devolve um único resultado'
    Igual $rb.Status 'ok' 'segundo plano: status'
    Igual $rb.Copiados 1 'segundo plano: copiou o novo arquivo'
    Igual $sync.Fase 'Concluído' 'segundo plano: progresso compartilhado'
    $ps.Dispose()
} catch {
    $script:Falhas++
    Write-Host "ERRO INESPERADO: $($_.Exception.Message)`n$($_.ScriptStackTrace)" -ForegroundColor Red
} finally {
    Remove-Item -LiteralPath $raizTeste -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ''
if ($script:Falhas -eq 0) { Write-Host "Todos os $script:Total testes passaram." -ForegroundColor Green }
else { Write-Host "$script:Falhas de $script:Total testes falharam." -ForegroundColor Red }
exit $script:Falhas
