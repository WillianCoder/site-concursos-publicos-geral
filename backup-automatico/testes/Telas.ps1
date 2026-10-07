# Teste do Painel no Windows: monta backups de exemplo, abre o Painel em modo
# de teste, faz um backup de verdade pela tela e salva imagens das janelas.
# Rodar:  powershell -NoProfile -ExecutionPolicy Bypass -File testes\Telas.ps1 -Saida C:\temp\telas
param([string]$Saida = (Join-Path ([IO.Path]::GetTempPath()) 'backup-automatico-telas'))

$ErrorActionPreference = 'Stop'
$raiz = [IO.Path]::Combine([IO.Path]::GetTempPath(), 'bkpauto-telas-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$env:BACKUPAUTO_DADOS = [IO.Path]::Combine($raiz, 'dados')
$app = [IO.Path]::GetFullPath([IO.Path]::Combine($PSScriptRoot, '..', 'app'))
. ([IO.Path]::Combine($app, 'Nucleo.ps1'))

$origem = [IO.Path]::Combine($raiz, 'Documentos de Concursos')
$destino = [IO.Path]::Combine($raiz, 'Meu Drive', 'Backup Automático')
foreach ($n in 1..5) {
    $arq = [IO.Path]::Combine($origem, "Edital $n.pdf")
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($arq))
    [IO.File]::WriteAllText($arq, "conteúdo $n")
}
[void][IO.Directory]::CreateDirectory([IO.Path]::Combine($origem, 'Simulados', 'Português'))
[IO.File]::WriteAllText([IO.Path]::Combine($origem, 'Simulados', 'Português', 'prova ação.txt'), 'acentos')

$cfg = Read-Configuracao
$cfg.iniciarComWindows = $false
[void]$cfg.trabalhos.Add((New-Trabalho @{ nome = 'Concursos'; origem = $origem; destinoBase = $destino; intervaloUnidade = 'semanas'; inicio = '2026-10-02T18:00:00' }))
[void]$cfg.trabalhos.Add((New-Trabalho @{ nome = 'Fotos do celular'; origem = 'C:\Users\Exemplo\Pictures\Celular'; destinoBase = $destino; intervaloValor = 12; intervaloUnidade = 'horas'; ultimoStatus = 'indisponivel'; ultimoResumo = 'Aguardando: A pasta de origem não está acessível agora.' }))
[void]$cfg.trabalhos.Add((New-Trabalho @{ nome = 'Planilhas'; origem = 'C:\Users\Exemplo\Documents\Planilhas'; destinoBase = $destino; intervaloUnidade = 'meses'; ativo = $false; ultimaExecucao = '2026-09-01T09:00:00'; ultimoStatus = 'ok'; ultimoResumo = '3 arquivos novos copiados (1,2 MB) em 2 s.' }))
Save-Configuracao $cfg

[void][IO.Directory]::CreateDirectory($Saida)
$ps = Get-CaminhoPowerShell
& $ps -NoProfile -ExecutionPolicy Bypass -STA -File ([IO.Path]::Combine($app, 'Painel.ps1')) -CapturarTelas $Saida
$codigo = $LASTEXITCODE

$copiados = @(Get-ChildItem -LiteralPath ([IO.Path]::Combine($destino, 'Documentos de Concursos')) -Recurse -File -ErrorAction SilentlyContinue).Count
Write-Host "Arquivos no backup de teste: $copiados (esperado: 6)"
if ($copiados -ne 6) { $codigo = 1 }
Remove-Item -LiteralPath $raiz -Recurse -Force -ErrorAction SilentlyContinue
if ($codigo -eq 0) { Write-Host 'Teste das telas OK.' } else { Write-Host 'Teste das telas FALHOU.' }
exit $codigo
