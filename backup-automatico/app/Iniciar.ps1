# =============================================================================
#  Backup Automático - Iniciar
#  Abre o Painel sem deixar nenhuma janela preta aberta. Se o Painel já estiver
#  rodando, só traz ele para a frente. Também recebe a pasta que foi arrastada
#  para cima do "Backup Automatico.bat".
# =============================================================================
param(
    [string]$Pasta = '',
    [switch]$Bandeja
)

$ErrorActionPreference = 'Stop'
try {
    $pastaApp = $PSScriptRoot

    # Arquivos baixados da internet vêm "bloqueados" pelo Windows; desbloqueia os nossos.
    try {
        Get-ChildItem -LiteralPath ([IO.Path]::GetDirectoryName($pastaApp)) -Recurse -File -ErrorAction SilentlyContinue |
            Unblock-File -ErrorAction SilentlyContinue
    } catch { }

    . ([IO.Path]::Combine($pastaApp, 'Nucleo.ps1'))

    $Pasta = $Pasta.Trim().Trim('"')
    if ($Pasta -ne '') {
        $linha = (Get-CaminhoNormalizado $Pasta) + [Environment]::NewLine
        [IO.File]::AppendAllText((Get-ArquivoPendentes), $linha, (New-Object Text.UTF8Encoding($false)))
    }

    # O Painel já está aberto? Então só pede para ele aparecer.
    $mutex = $null
    if ([System.Threading.Mutex]::TryOpenExisting('Local\BackupAutomatico_Painel', [ref]$mutex)) {
        $mutex.Dispose()
        try {
            [void][System.Threading.EventWaitHandle]::OpenExisting('Local\BackupAutomatico_Mostrar').Set()
            exit 0
        } catch { }
    }

    $argumentos = '-NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File "' + [IO.Path]::Combine($pastaApp, 'Painel.ps1') + '"'
    if ($Bandeja) { $argumentos += ' -Bandeja' }
    [void](Start-ProcessoOculto (Get-CaminhoPowerShell) $argumentos)
    exit 0
} catch {
    Write-Host ''
    Write-Host ('Não foi possível abrir o Backup Automático: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
