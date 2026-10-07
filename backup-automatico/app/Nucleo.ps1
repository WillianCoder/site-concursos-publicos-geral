# =============================================================================
#  Backup Automático - Núcleo
#  Tudo o que não é tela: configuração, agenda e o motor que copia os arquivos.
#  É usado pelo Painel (Painel.ps1), pelo Iniciar.ps1 e pelos testes.
#  Compatível com o Windows PowerShell 5.1 (já vem no Windows 10 e 11).
# =============================================================================

# O Windows PowerShell 5.1 tem um defeito que faz o ConvertTo-Json gravar
# listas como {"value": [...], "Count": n}. Remover este TypeData resolve.
try { Remove-TypeData -TypeName System.Array -ErrorAction SilentlyContinue } catch { }

$script:VersaoApp         = '1.0.0'
$script:FormatoData       = 'yyyy-MM-ddTHH:mm:ss'
$script:Unidades          = @('minutos', 'horas', 'dias', 'semanas', 'meses', 'anos')
$script:MinimoMinutos     = 5
$script:SufixoParcial     = '.bkpauto-parcial'
$script:ArquivosIgnorados = @('desktop.ini', 'Thumbs.db', '~$*', '*.tmp', '.~lock.*#', ('*' + $script:SufixoParcial))
$script:PastasIgnoradas   = @('.tmp.drivedownload', '.tmp.driveupload', '$RECYCLE.BIN', 'System Volume Information')
$script:DiasSemana        = @('dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb')
$script:UsarPrefixoLongo  = $null
try { $script:CulturaBR = [Globalization.CultureInfo]::GetCultureInfo('pt-BR') }
catch { $script:CulturaBR = [Globalization.CultureInfo]::InvariantCulture }

# -----------------------------------------------------------------------------
#  Pastas e arquivos do programa
# -----------------------------------------------------------------------------

function Get-PastaDados {
    # Onde ficam a configuração e o histórico: %LOCALAPPDATA%\BackupAutomatico.
    # A variável BACKUPAUTO_DADOS permite trocar o local (usada nos testes).
    if ($env:BACKUPAUTO_DADOS) {
        $pasta = $env:BACKUPAUTO_DADOS
    } else {
        $pasta = [IO.Path]::Combine([Environment]::GetFolderPath('LocalApplicationData'), 'BackupAutomatico')
    }
    if (-not [IO.Directory]::Exists($pasta)) { [void][IO.Directory]::CreateDirectory($pasta) }
    return $pasta
}

function Get-ArquivoHistorico([string]$Id) {
    $pasta = [IO.Path]::Combine((Get-PastaDados), 'historico')
    if (-not [IO.Directory]::Exists($pasta)) { [void][IO.Directory]::CreateDirectory($pasta) }
    return [IO.Path]::Combine($pasta, "$Id.txt")
}

function Get-ArquivoBase([string]$Id) {
    $pasta = [IO.Path]::Combine((Get-PastaDados), 'ponto-de-partida')
    if (-not [IO.Directory]::Exists($pasta)) { [void][IO.Directory]::CreateDirectory($pasta) }
    return [IO.Path]::Combine($pasta, "$Id.txt")
}

function Get-ArquivoPendentes {
    return [IO.Path]::Combine((Get-PastaDados), 'pastas-pendentes.txt')
}

function Write-LogErro([string]$Texto) {
    # Erros inesperados do programa (não dos backups) vão para erros.log.
    try {
        $arq = [IO.Path]::Combine((Get-PastaDados), 'erros.log')
        if ([IO.File]::Exists($arq) -and (New-Object IO.FileInfo $arq).Length -gt 1MB) { [IO.File]::Delete($arq) }
        $linha = (Get-Date).ToString('dd/MM/yyyy HH:mm:ss') + '  ' + $Texto + [Environment]::NewLine
        [IO.File]::AppendAllText($arq, $linha, (New-Object Text.UTF8Encoding($true)))
    } catch { }
}

# -----------------------------------------------------------------------------
#  Datas e textos
# -----------------------------------------------------------------------------

function ConvertTo-TextoData($Data) {
    if ($null -eq $Data) { return $null }
    return ([datetime]$Data).ToString($script:FormatoData, [Globalization.CultureInfo]::InvariantCulture)
}

function ConvertFrom-TextoData($Valor) {
    if ($null -eq $Valor) { return $null }
    if ($Valor -is [datetime]) { return [datetime]::SpecifyKind($Valor, [DateTimeKind]::Unspecified) }
    $texto = [string]$Valor
    if ($texto -eq '') { return $null }
    $data = [datetime]::MinValue
    $inv = [Globalization.CultureInfo]::InvariantCulture
    if ([datetime]::TryParseExact($texto, $script:FormatoData, $inv, [Globalization.DateTimeStyles]::None, [ref]$data)) { return $data }
    if ([datetime]::TryParse($texto, $inv, [Globalization.DateTimeStyles]::None, [ref]$data)) { return $data }
    return $null
}

function Format-Numero([long]$Numero) {
    return $Numero.ToString('N0', $script:CulturaBR)
}

function Format-Plural([long]$Numero, [string]$Singular, [string]$Plural) {
    if ($Numero -eq 1) { return "1 $Singular" }
    return (Format-Numero $Numero) + " $Plural"
}

function Format-Tamanho([long]$Bytes) {
    if ($Bytes -lt 1024) { return (Format-Plural $Bytes 'byte' 'bytes') }
    $unidades = @('KB', 'MB', 'GB', 'TB')
    $valor = [double]$Bytes
    $i = -1
    while ($valor -ge 1024 -and $i -lt 3) { $valor = $valor / 1024; $i++ }
    return $valor.ToString('0.#', $script:CulturaBR) + ' ' + $unidades[$i]
}

function Format-Duracao([TimeSpan]$Duracao) {
    if ($Duracao.TotalSeconds -lt 60) { return ([int][Math]::Max(1, [Math]::Round($Duracao.TotalSeconds))).ToString() + ' s' }
    if ($Duracao.TotalMinutes -lt 60) { return ('{0} min {1:00} s' -f [int][Math]::Floor($Duracao.TotalMinutes), $Duracao.Seconds) }
    return ('{0} h {1:00} min' -f [int][Math]::Floor($Duracao.TotalHours), $Duracao.Minutes)
}

function Format-Frequencia([int]$Valor, [string]$Unidade) {
    if ($Valor -le 1) {
        switch ($Unidade) {
            'minutos' { return 'A cada minuto' }
            'horas'   { return 'A cada hora' }
            'dias'    { return 'Todo dia' }
            'semanas' { return 'Toda semana' }
            'meses'   { return 'Todo mês' }
            'anos'    { return 'Todo ano' }
        }
    }
    return "A cada $Valor $Unidade"
}

function Format-DataAmigavel($Data, $Agora = $null) {
    # "hoje às 18:00", "amanhã às 09:30", "sex, 10/10 às 18:00"
    if ($null -eq $Data) { return '-' }
    if ($null -eq $Agora) { $Agora = Get-Date }
    $d = [datetime]$Data
    $hora = $d.ToString('HH:mm')
    $dias = ($d.Date - ([datetime]$Agora).Date).Days
    if ($dias -eq 0)  { return "hoje às $hora" }
    if ($dias -eq 1)  { return "amanhã às $hora" }
    if ($dias -eq -1) { return "ontem às $hora" }
    $dia = $script:DiasSemana[[int]$d.DayOfWeek]
    if ($d.Year -eq ([datetime]$Agora).Year) { return "$dia, " + $d.ToString('dd/MM') + " às $hora" }
    return "$dia, " + $d.ToString('dd/MM/yyyy') + " às $hora"
}

# -----------------------------------------------------------------------------
#  Caminhos
# -----------------------------------------------------------------------------

function Get-CaminhoNormalizado([string]$Caminho) {
    # Caminho completo, sem aspas e sem barra no final (exceto em "C:\").
    if ([string]::IsNullOrWhiteSpace($Caminho)) { return '' }
    $c = $Caminho.Trim().Trim('"').Trim()
    if ($c -eq '') { return '' }
    try { $c = [IO.Path]::GetFullPath($c) } catch { }
    $raiz = ''
    try { $raiz = [IO.Path]::GetPathRoot($c) } catch { }
    if ($null -eq $raiz) { $raiz = '' }
    if ($c.Length -gt $raiz.Length) { $c = $c.TrimEnd('\', '/') }
    return $c
}

function Test-CaminhoDentro([string]$Filho, [string]$Pai) {
    # Verdadeiro se $Filho é igual a $Pai ou fica dentro dele.
    $sep = [string][IO.Path]::DirectorySeparatorChar
    $f = (Get-CaminhoNormalizado $Filho).TrimEnd('\', '/') + $sep
    $p = (Get-CaminhoNormalizado $Pai).TrimEnd('\', '/') + $sep
    if ($f -eq $sep -or $p -eq $sep) { return $false }
    return $f.StartsWith($p, [StringComparison]::OrdinalIgnoreCase)
}

function Get-NomePasta([string]$Caminho) {
    $c = Get-CaminhoNormalizado $Caminho
    $nome = [IO.Path]::GetFileName($c)
    if ([string]::IsNullOrWhiteSpace($nome)) {
        $letra = $c.TrimEnd('\', '/', ':')
        if ($letra -eq '') { return 'Backup' }
        $nome = "Disco $letra"
    }
    foreach ($ch in [IO.Path]::GetInvalidFileNameChars()) { $nome = $nome.Replace([string]$ch, '_') }
    return $nome
}

function Get-DestinoFinal($Trabalho) {
    $base = Get-CaminhoNormalizado $Trabalho.destinoBase
    if ($base -eq '') { return '' }
    if ($Trabalho.criarSubpasta) { return [IO.Path]::Combine($base, (Get-NomePasta $Trabalho.origem)) }
    return $base
}

function Initialize-CaminhoLongo {
    # No Windows, o prefixo \\?\ permite caminhos com mais de 260 caracteres.
    if ($null -ne $script:UsarPrefixoLongo) { return }
    $script:UsarPrefixoLongo = $false
    if ([IO.Path]::DirectorySeparatorChar -ne '\') { return }
    try { $script:UsarPrefixoLongo = [IO.Directory]::Exists('\\?\' + $env:SystemRoot) } catch { }
}

function Get-CaminhoLongo([string]$Caminho) {
    Initialize-CaminhoLongo
    if (-not $script:UsarPrefixoLongo) { return $Caminho }
    if ($Caminho.StartsWith('\\?\')) { return $Caminho }
    if ($Caminho.StartsWith('\\')) { return '\\?\UNC\' + $Caminho.Substring(2) }
    return '\\?\' + $Caminho
}

function Remove-PrefixoLongo([string]$Texto) {
    if ($null -eq $Texto) { return '' }
    return ($Texto -replace '\\\\\?\\UNC\\', '\\' -replace '\\\\\?\\', '')
}

function Get-MensagemErro($Erro) {
    $ex = $Erro
    if ($Erro -is [System.Management.Automation.ErrorRecord]) { $ex = $Erro.Exception }
    while ($null -ne $ex -and $null -ne $ex.InnerException -and
           ($ex -is [System.Management.Automation.MethodInvocationException] -or
            $ex -is [System.Management.Automation.RuntimeException])) {
        $ex = $ex.InnerException
    }
    if ($null -eq $ex) { return 'Erro desconhecido.' }
    return (Remove-PrefixoLongo $ex.Message).Trim()
}

function Find-GoogleDrive {
    # Procura a pasta "Meu Drive" do Google Drive para computador.
    # Normalmente é G:\Meu Drive (ou "My Drive" com o Windows em inglês).
    $nomes = @('Meu Drive', 'My Drive', 'Mi unidad', 'Mon Drive', 'Il mio Drive', 'Meine Ablage', 'Google Drive')
    $raizes = New-Object System.Collections.Generic.List[string]
    try {
        foreach ($d in [IO.DriveInfo]::GetDrives()) {
            try {
                if (-not $d.IsReady) { continue }
                if ([string]$d.VolumeLabel -like '*Google Drive*') { $raizes.Insert(0, $d.RootDirectory.FullName) }
                else { $raizes.Add($d.RootDirectory.FullName) }
            } catch { }
        }
    } catch { }
    if ($env:USERPROFILE) { $raizes.Add($env:USERPROFILE) }
    foreach ($raiz in $raizes) {
        foreach ($nome in $nomes) {
            try {
                $p = [IO.Path]::Combine($raiz, $nome)
                if ([IO.Directory]::Exists($p)) { return $p }
            } catch { }
        }
    }
    return $null
}

# -----------------------------------------------------------------------------
#  Trabalhos de backup (cada pasta vinculada) e configuração
# -----------------------------------------------------------------------------

function New-Trabalho {
    param([System.Collections.IDictionary]$Valores = @{})
    $agora = ConvertTo-TextoData (Get-Date -Second 0 -Millisecond 0)
    $t = [ordered]@{
        id                = [guid]::NewGuid().ToString('N').Substring(0, 10)
        nome              = ''
        origem            = ''
        destinoBase       = ''
        criarSubpasta     = $true
        modo              = 'novos'          # novos | alterados
        intervaloValor    = 1
        intervaloUnidade  = 'semanas'
        inicio            = $agora
        ativo             = $true
        ignorarExistentes = $false
        baseRegistradaEm  = $null
        ultimaExecucao    = $null
        ultimoStatus      = $null            # ok | parcial | erro | indisponivel | cancelado | base
        ultimoResumo      = ''
        ultimosCopiados   = 0
        totalCopiados     = 0
        aguardarAte       = $null
        criadoEm          = $agora
    }
    foreach ($k in @($Valores.Keys)) {
        if ($t.Contains([string]$k)) { $t[[string]$k] = $Valores[$k] }
    }
    # Normaliza tipos (o JSON pode trazer números/datas em formatos diferentes).
    foreach ($k in @('inicio', 'baseRegistradaEm', 'ultimaExecucao', 'aguardarAte', 'criadoEm')) {
        $t[$k] = ConvertTo-TextoData (ConvertFrom-TextoData $t[$k])
    }
    if ($null -eq $t.inicio) { $t.inicio = $agora }
    foreach ($k in @('nome', 'origem', 'destinoBase', 'ultimoResumo', 'id')) {
        if ($null -eq $t[$k]) { $t[$k] = '' } else { $t[$k] = [string]$t[$k] }
    }
    foreach ($k in @('criarSubpasta', 'ativo', 'ignorarExistentes')) { $t[$k] = [bool]$t[$k] }
    $t.intervaloValor = [int][Math]::Max(1, [Math]::Min(9999, [int]$t.intervaloValor))
    if ($script:Unidades -notcontains $t.intervaloUnidade) { $t.intervaloUnidade = 'semanas' }
    if (@('novos', 'alterados') -notcontains $t.modo) { $t.modo = 'novos' }
    $t.ultimosCopiados = [long]$t.ultimosCopiados
    $t.totalCopiados = [long]$t.totalCopiados
    if ($t.id -eq '') { $t.id = [guid]::NewGuid().ToString('N').Substring(0, 10) }
    return [pscustomobject]$t
}

function ConvertTo-Dicionario($Objeto) {
    $d = [ordered]@{}
    if ($null -eq $Objeto) { return $d }
    if ($Objeto -is [System.Collections.IDictionary]) {
        foreach ($k in $Objeto.Keys) { $d[[string]$k] = $Objeto[$k] }
    } else {
        foreach ($p in $Objeto.PSObject.Properties) { $d[$p.Name] = $p.Value }
    }
    return $d
}

function Read-Configuracao {
    $arquivo = [IO.Path]::Combine((Get-PastaDados), 'config.json')
    $lido = $null
    foreach ($candidato in @($arquivo, "$arquivo.bak")) {
        if (-not [IO.File]::Exists($candidato)) { continue }
        try {
            $texto = [IO.File]::ReadAllText($candidato, [Text.Encoding]::UTF8)
            if ($texto.Trim() -ne '') { $lido = ConvertFrom-Json -InputObject $texto }
        } catch { Write-LogErro "Configuração ilegível em ${candidato}: $(Get-MensagemErro $_)" }
        if ($null -ne $lido) { break }
    }
    $cfg = [pscustomobject]@{
        versao            = 1
        iniciarComWindows = $true
        notificacoes      = $true
        trabalhos         = New-Object System.Collections.ArrayList
    }
    if ($null -ne $lido) {
        if ($null -ne $lido.PSObject.Properties['iniciarComWindows']) { $cfg.iniciarComWindows = [bool]$lido.iniciarComWindows }
        if ($null -ne $lido.PSObject.Properties['notificacoes']) { $cfg.notificacoes = [bool]$lido.notificacoes }
        if ($null -ne $lido.PSObject.Properties['trabalhos']) {
            foreach ($o in @($lido.trabalhos)) {
                if ($null -ne $o) { [void]$cfg.trabalhos.Add((New-Trabalho (ConvertTo-Dicionario $o))) }
            }
        }
    }
    return $cfg
}

function Save-Configuracao($Cfg) {
    $arquivo = [IO.Path]::Combine((Get-PastaDados), 'config.json')
    $lista = New-Object System.Collections.Generic.List[object]
    foreach ($t in $Cfg.trabalhos) { $lista.Add((ConvertTo-Dicionario $t)) }
    $obj = [ordered]@{
        versao            = 1
        programa          = "Backup Automático $script:VersaoApp"
        iniciarComWindows = [bool]$Cfg.iniciarComWindows
        notificacoes      = [bool]$Cfg.notificacoes
        trabalhos         = [object[]]$lista.ToArray()
    }
    $json = ConvertTo-Json -InputObject $obj -Depth 6
    $temp = "$arquivo.tmp"
    [IO.File]::WriteAllText($temp, $json, (New-Object Text.UTF8Encoding($false)))
    if ([IO.File]::Exists($arquivo)) { [IO.File]::Copy($arquivo, "$arquivo.bak", $true) }
    [IO.File]::Copy($temp, $arquivo, $true)
    [IO.File]::Delete($temp)
}

function Test-Trabalho($Trabalho) {
    # Devolve a lista de problemas (vazia = tudo certo).
    $erros = New-Object System.Collections.Generic.List[string]
    if ([string]::IsNullOrWhiteSpace($Trabalho.nome)) { $erros.Add('Dê um nome para este backup.') }
    $origem = Get-CaminhoNormalizado $Trabalho.origem
    if ($origem -eq '') {
        $erros.Add('Escolha a pasta que será copiada (origem).')
    } elseif (-not [IO.Directory]::Exists($origem)) {
        $erros.Add("A pasta de origem não foi encontrada:`n$origem")
    }
    $destino = Get-DestinoFinal $Trabalho
    if ($destino -eq '') {
        $erros.Add('Escolha a pasta para onde os arquivos serão copiados (destino).')
    } elseif ($origem -ne '' -and ((Test-CaminhoDentro $destino $origem) -or (Test-CaminhoDentro $origem $destino))) {
        $erros.Add('A pasta de destino não pode ser a mesma pasta da origem, nem ficar dentro dela (e vice-versa).')
    }
    if ([int]$Trabalho.intervaloValor -lt 1) { $erros.Add('A frequência precisa ser de pelo menos 1.') }
    if ($Trabalho.intervaloUnidade -eq 'minutos' -and [int]$Trabalho.intervaloValor -lt $script:MinimoMinutos) {
        $erros.Add("O intervalo mínimo é de $script:MinimoMinutos minutos.")
    }
    return ,$erros
}

# -----------------------------------------------------------------------------
#  Agenda
# -----------------------------------------------------------------------------

function Add-Intervalo([datetime]$Data, [int]$Valor, [string]$Unidade, [long]$Vezes = 1) {
    $n = [long]$Valor * $Vezes
    switch ($Unidade) {
        'minutos' { return $Data.AddMinutes($n) }
        'horas'   { return $Data.AddHours($n) }
        'dias'    { return $Data.AddDays($n) }
        'meses'   { return $Data.AddMonths([int]$n) }
        'anos'    { return $Data.AddYears([int]$n) }
        default   { return $Data.AddDays(7 * $n) }
    }
}

function Get-ProximaExecucao($Trabalho) {
    # Os horários seguem a "grade" que começa em 'inicio': inicio, inicio + 1x,
    # inicio + 2x... O próximo é o primeiro horário da grade depois do último
    # backup. Se o computador ficou desligado, o backup atrasado roda assim que
    # possível e a grade continua no mesmo dia/horário de sempre.
    $inicio = ConvertFrom-TextoData $Trabalho.inicio
    if ($null -eq $inicio) { $inicio = Get-Date }
    $ultima = ConvertFrom-TextoData $Trabalho.ultimaExecucao
    if ($null -eq $ultima -or $ultima -lt $inicio) {
        $proxima = $inicio
    } else {
        $v = [int][Math]::Max(1, [int]$Trabalho.intervaloValor)
        $u = [string]$Trabalho.intervaloUnidade
        switch ($u) {
            'meses' { $estimativa = [long][Math]::Floor((($ultima.Year - $inicio.Year) * 12 + $ultima.Month - $inicio.Month) / $v) }
            'anos'  { $estimativa = [long][Math]::Floor(($ultima.Year - $inicio.Year) / $v) }
            default {
                $passo = (Add-Intervalo $inicio $v $u 1) - $inicio
                $estimativa = [long][Math]::Floor(($ultima - $inicio).Ticks / $passo.Ticks)
            }
        }
        $n = [long][Math]::Max([long]1, [long]($estimativa - 1))
        while ((Add-Intervalo $inicio $v $u $n) -le $ultima) { $n++ }
        $proxima = Add-Intervalo $inicio $v $u $n
    }
    $aguardar = ConvertFrom-TextoData $Trabalho.aguardarAte
    if ($null -ne $aguardar -and $aguardar -gt $proxima) { $proxima = $aguardar }
    return $proxima
}

function Test-BackupVencido($Trabalho, [datetime]$Agora) {
    if (-not $Trabalho.ativo) { return $false }
    return ((Get-ProximaExecucao $Trabalho) -le $Agora)
}

function Test-BaseNecessaria($Trabalho) {
    # "Ignorar o que já existe" precisa primeiro registrar o ponto de partida.
    return ([bool]$Trabalho.ignorarExistentes -and -not $Trabalho.baseRegistradaEm)
}

# -----------------------------------------------------------------------------
#  Iniciar com o Windows e abrir processos sem janela
# -----------------------------------------------------------------------------

function Get-CaminhoPowerShell {
    $ps = [IO.Path]::Combine($env:SystemRoot, 'System32\WindowsPowerShell\v1.0\powershell.exe')
    if ([IO.File]::Exists($ps)) { return $ps }
    return 'powershell.exe'
}

function Set-IniciarComWindows([bool]$Ativar, [string]$CaminhoIniciar) {
    $chave = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
    $nome = 'BackupAutomatico'
    if ($Ativar) {
        $comando = '"' + (Get-CaminhoPowerShell) + '" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $CaminhoIniciar + '" -Bandeja'
        if (-not (Test-Path -LiteralPath $chave)) { [void](New-Item -Path $chave -Force) }
        [void](New-ItemProperty -Path $chave -Name $nome -Value $comando -PropertyType String -Force)
    } else {
        Remove-ItemProperty -Path $chave -Name $nome -ErrorAction SilentlyContinue
    }
}

function Start-ProcessoOculto([string]$Programa, [string]$Argumentos) {
    # Abre um processo sem nenhuma janela de console (nem piscando).
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $Programa
    $psi.Arguments = $Argumentos
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    return [System.Diagnostics.Process]::Start($psi)
}

# -----------------------------------------------------------------------------
#  Motor de backup
# -----------------------------------------------------------------------------

function Test-Ignorado([string]$Nome, [bool]$EhPasta) {
    if ($EhPasta) { $padroes = $script:PastasIgnoradas } else { $padroes = $script:ArquivosIgnorados }
    foreach ($padrao in $padroes) { if ($Nome -like $padrao) { return $true } }
    return $false
}

function Test-PastaLink([string]$Caminho) {
    # Atalhos de pasta (junções e links simbólicos) são pulados para não entrar
    # em voltas infinitas. Pastas do OneDrive/Google Drive não são puladas.
    $curto = Remove-PrefixoLongo $Caminho
    if ($curto.Length -lt 248) { $Caminho = $curto }
    try {
        $item = Get-Item -LiteralPath $Caminho -Force -ErrorAction Stop
        return [bool]$item.LinkType
    } catch {
        return $true
    }
}

function Add-ArquivosDaPasta {
    param(
        [string]$Raiz,
        [System.Collections.Generic.List[System.IO.FileInfo]]$Lista,
        $Sync,
        [System.Collections.Generic.List[string]]$Avisos,
        [switch]$LimparParciais
    )
    $pilha = New-Object System.Collections.Generic.Stack[string]
    $pilha.Push($Raiz)
    while ($pilha.Count -gt 0) {
        if ($Sync.Cancelar) { return }
        $pasta = $pilha.Pop()
        try {
            $itens = ([IO.DirectoryInfo]::new($pasta)).GetFileSystemInfos()
        } catch {
            $Avisos.Add('Pasta não pôde ser lida: ' + (Remove-PrefixoLongo $pasta) + ' (' + (Get-MensagemErro $_) + ')')
            continue
        }
        foreach ($item in $itens) {
            if ($item -is [IO.DirectoryInfo]) {
                if (Test-Ignorado $item.Name $true) { continue }
                if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -and (Test-PastaLink $item.FullName)) {
                    $Avisos.Add('Atalho de pasta ignorado: ' + (Remove-PrefixoLongo $item.FullName))
                    continue
                }
                $pilha.Push($item.FullName)
            } else {
                if ($LimparParciais -and $item.Name.EndsWith($script:SufixoParcial, [StringComparison]::OrdinalIgnoreCase)) {
                    try { $item.Attributes = [IO.FileAttributes]::Normal; $item.Delete() } catch { }
                    continue
                }
                if (Test-Ignorado $item.Name $false) { continue }
                $Lista.Add([IO.FileInfo]$item)
            }
        }
        $Sync.Lidos = $Lista.Count
    }
}

function Get-CaminhoRelativo([string]$Completo, [string]$Raiz) {
    return $Completo.Substring($Raiz.Length).TrimStart('\', '/')
}

function Get-ChaveBase([string]$Relativo, [IO.FileInfo]$Arquivo) {
    return $Relativo + '|' + $Arquivo.Length + '|' + $Arquivo.LastWriteTimeUtc.Ticks
}

function Copy-ArquivoSeguro([IO.FileInfo]$Origem, [string]$Destino) {
    # Copia primeiro para um arquivo temporário e só então dá o nome final.
    # Se a cópia for interrompida, nunca fica um arquivo pela metade no backup.
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($Destino))
    $temp = $Destino + $script:SufixoParcial
    if ([IO.File]::Exists($temp)) { [IO.File]::SetAttributes($temp, [IO.FileAttributes]::Normal); [IO.File]::Delete($temp) }
    [IO.File]::Copy($Origem.FullName, $temp, $true)
    try { [IO.File]::SetLastWriteTimeUtc($temp, $Origem.LastWriteTimeUtc) } catch { }
    if ([IO.File]::Exists($Destino)) {
        [IO.File]::SetAttributes($Destino, [IO.FileAttributes]::Normal)
        [IO.File]::Delete($Destino)
    }
    [IO.File]::Move($temp, $Destino)
}

function Write-Historico {
    param(
        [string]$Arquivo, [string]$Nome, [string]$Origem, [string]$Destino, $Resultado,
        [System.Collections.Generic.List[string]]$Copiados,
        [System.Collections.Generic.List[string]]$Erros,
        [System.Collections.Generic.List[string]]$Avisos
    )
    if ([string]::IsNullOrWhiteSpace($Arquivo)) { return }
    try {
        $nl = [Environment]::NewLine
        $sb = New-Object System.Text.StringBuilder
        $quando = ([datetime]$Resultado.Inicio).ToString('dd/MM/yyyy HH:mm')
        if ($Resultado.Status -eq 'ok' -and $Resultado.Copiados -eq 0) {
            [void]$sb.Append("$quando  $Nome - $($Resultado.Mensagem)$nl")
        } else {
            [void]$sb.Append("$nl===== $quando  $Nome =====$nl")
            [void]$sb.Append("Origem : $Origem$nl")
            [void]$sb.Append("Destino: $Destino$nl")
            [void]$sb.Append("Resultado: $($Resultado.Mensagem)$nl")
            $limite = 3000
            if ($null -ne $Copiados -and $Copiados.Count -gt 0) {
                for ($i = 0; $i -lt [Math]::Min($limite, $Copiados.Count); $i++) { [void]$sb.Append('  ' + $Copiados[$i] + $nl) }
                if ($Copiados.Count -gt $limite) { [void]$sb.Append("  ... e mais $(Format-Numero ($Copiados.Count - $limite)) arquivo(s)$nl") }
            }
            if ($null -ne $Erros -and $Erros.Count -gt 0) {
                [void]$sb.Append("Problemas:$nl")
                for ($i = 0; $i -lt [Math]::Min(500, $Erros.Count); $i++) { [void]$sb.Append('  ! ' + $Erros[$i] + $nl) }
            }
            if ($null -ne $Avisos -and $Avisos.Count -gt 0) {
                [void]$sb.Append("Avisos:$nl")
                for ($i = 0; $i -lt [Math]::Min(100, $Avisos.Count); $i++) { [void]$sb.Append('  - ' + $Avisos[$i] + $nl) }
            }
        }
        # Mantém o histórico com no máximo ~3 MB (guarda a parte mais recente).
        if ([IO.File]::Exists($Arquivo) -and (New-Object IO.FileInfo $Arquivo).Length -gt 3MB) {
            $texto = [IO.File]::ReadAllText($Arquivo, [Text.Encoding]::UTF8)
            $corte = $texto.IndexOf("`n", [int]($texto.Length / 2))
            if ($corte -gt 0) {
                $texto = '(registros mais antigos foram apagados)' + $nl + $texto.Substring($corte + 1)
                [IO.File]::WriteAllText($Arquivo, $texto, (New-Object Text.UTF8Encoding($true)))
            }
        }
        [IO.File]::AppendAllText($Arquivo, $sb.ToString(), (New-Object Text.UTF8Encoding($true)))
    } catch {
        Write-LogErro "Falha ao gravar histórico: $(Get-MensagemErro $_)"
    }
}

function Invoke-Backup {
    <#
        Copia para $Destino os arquivos de $Origem que ainda não estão lá
        (modo 'novos') ou que são novos/modificados (modo 'alterados').
        Nunca apaga nada do destino.

        -ArquivoBase:   lista de arquivos que já existiam no "ponto de partida";
                        eles são ignorados (opção "só o que for adicionado").
        -RegistrarBase: em vez de copiar, só cria essa lista.
        -Sync:          hashtable compartilhada com o Painel (progresso e
                        pedido de cancelamento).
    #>
    param(
        [Parameter(Mandatory = $true)][string]$Origem,
        [string]$Destino = '',
        [string]$Modo = 'novos',
        [string]$ArquivoBase = '',
        [switch]$RegistrarBase,
        [string]$ArquivoHistorico = '',
        [string]$Nome = 'Backup',
        $Sync = $null
    )
    if ($null -eq $Sync) { $Sync = @{} }
    if ($null -eq $Sync['Cancelar']) { $Sync.Cancelar = $false }
    $Sync.Fase = 'Preparando'
    $Sync.Lidos = 0
    $Sync.Total = 0
    $Sync.Feitos = 0

    $res = [ordered]@{
        Status = 'ok'; Mensagem = ''; Copiados = 0; Novos = 0; Alterados = 0; Falhas = 0
        Ignorados = 0; Analisados = 0; Bytes = [long]0; Inicio = (Get-Date); Fim = $null
        Erros = @()
    }
    $copiados = New-Object System.Collections.Generic.List[string]
    $erros = New-Object System.Collections.Generic.List[string]
    $avisos = New-Object System.Collections.Generic.List[string]
    $origemN = Get-CaminhoNormalizado $Origem
    $destinoN = Get-CaminhoNormalizado $Destino

    try {
        # 1) Origem e destino estão acessíveis?
        if ($origemN -eq '' -or -not [IO.Directory]::Exists($origemN)) {
            $res.Status = 'indisponivel'
            $res.Mensagem = "A pasta de origem não está acessível agora ($origemN)."
            return [pscustomobject]$res
        }
        if (-not $RegistrarBase) {
            if ($destinoN -eq '') { throw 'Pasta de destino não definida.' }
            $raizDestino = [IO.Path]::GetPathRoot($destinoN)
            if ([string]::IsNullOrEmpty($raizDestino) -or -not [IO.Directory]::Exists($raizDestino)) {
                $res.Status = 'indisponivel'
                $res.Mensagem = "O destino ($raizDestino) não está disponível agora. O Google Drive está aberto e conectado?"
                return [pscustomobject]$res
            }
            if ((Test-CaminhoDentro $destinoN $origemN) -or (Test-CaminhoDentro $origemN $destinoN)) {
                throw 'A pasta de destino não pode ficar dentro da origem (nem o contrário).'
            }
            try { [void][IO.Directory]::CreateDirectory((Get-CaminhoLongo $destinoN)) }
            catch { throw "Não foi possível criar a pasta de destino ($destinoN): $(Get-MensagemErro $_)" }
        }
        $origemL = Get-CaminhoLongo $origemN
        $destinoL = Get-CaminhoLongo $destinoN

        # 2) Lê a origem.
        $Sync.Fase = 'Lendo a pasta de origem'
        $arquivosOrigem = New-Object 'System.Collections.Generic.List[System.IO.FileInfo]'
        Add-ArquivosDaPasta -Raiz $origemL -Lista $arquivosOrigem -Sync $Sync -Avisos $avisos
        $res.Analisados = $arquivosOrigem.Count
        if ($Sync.Cancelar) { throw [OperationCanceledException]::new() }

        if ($RegistrarBase) {
            $linhas = New-Object System.Collections.Generic.List[string]
            foreach ($f in $arquivosOrigem) { $linhas.Add((Get-ChaveBase (Get-CaminhoRelativo $f.FullName $origemL) $f)) }
            [IO.File]::WriteAllLines($ArquivoBase, $linhas.ToArray(), (New-Object Text.UTF8Encoding($false)))
            $res.Status = 'base'
            $res.Ignorados = $linhas.Count
            $res.Mensagem = 'Ponto de partida registrado: ' + (Format-Plural $linhas.Count 'arquivo que já existia será ignorado' 'arquivos que já existiam serão ignorados') + '.'
            return [pscustomobject]$res
        }

        # 3) Lê o que já está no backup.
        $Sync.Fase = 'Comparando com o backup'
        $arquivosDestino = New-Object 'System.Collections.Generic.List[System.IO.FileInfo]'
        Add-ArquivosDaPasta -Raiz $destinoL -Lista $arquivosDestino -Sync $Sync -Avisos $avisos -LimparParciais
        if ($Sync.Cancelar) { throw [OperationCanceledException]::new() }
        $noBackup = New-Object 'System.Collections.Generic.Dictionary[string,System.IO.FileInfo]' ([StringComparer]::OrdinalIgnoreCase)
        foreach ($f in $arquivosDestino) { $noBackup[(Get-CaminhoRelativo $f.FullName $destinoL)] = $f }
        $arquivosDestino = $null

        $base = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
        if ($ArquivoBase -ne '' -and [IO.File]::Exists($ArquivoBase)) {
            foreach ($linha in [IO.File]::ReadAllLines($ArquivoBase, [Text.Encoding]::UTF8)) { [void]$base.Add($linha) }
        }

        # 4) Decide o que copiar.
        $paraCopiar = New-Object System.Collections.Generic.List[object]
        foreach ($f in $arquivosOrigem) {
            $rel = Get-CaminhoRelativo $f.FullName $origemL
            $existente = $null
            if ($noBackup.TryGetValue($rel, [ref]$existente)) {
                if ($Modo -eq 'alterados') {
                    $diferenca = [Math]::Abs(($f.LastWriteTimeUtc - $existente.LastWriteTimeUtc).TotalSeconds)
                    if ($existente.Length -ne $f.Length -or $diferenca -gt 2) {
                        $paraCopiar.Add(@($rel, $f, $false))
                    }
                }
            } elseif ($base.Count -gt 0 -and $base.Contains((Get-ChaveBase $rel $f))) {
                $res.Ignorados++
            } else {
                $paraCopiar.Add(@($rel, $f, $true))
            }
        }
        $noBackup = $null

        # 5) Copia.
        $Sync.Fase = 'Copiando'
        $Sync.Total = $paraCopiar.Count
        $falhasSeguidas = 0
        foreach ($item in $paraCopiar) {
            if ($Sync.Cancelar) { throw [OperationCanceledException]::new() }
            $rel = [string]$item[0]
            $arquivo = [IO.FileInfo]$item[1]
            $ehNovo = [bool]$item[2]
            $Sync.Atual = $rel
            $ok = $false
            $mensagem = ''
            for ($tentativa = 1; $tentativa -le 2 -and -not $ok; $tentativa++) {
                try {
                    Copy-ArquivoSeguro $arquivo ([IO.Path]::Combine($destinoL, $rel))
                    $ok = $true
                } catch {
                    $mensagem = Get-MensagemErro $_
                    if ($tentativa -lt 2) { Start-Sleep -Seconds 2 }
                }
            }
            if ($ok) {
                $res.Copiados++
                $res.Bytes += $arquivo.Length
                if ($ehNovo) { $res.Novos++; $copiados.Add("+ $rel") } else { $res.Alterados++; $copiados.Add("~ $rel") }
                $falhasSeguidas = 0
            } else {
                $res.Falhas++
                $erros.Add("$rel - $mensagem")
                $falhasSeguidas++
                if ($falhasSeguidas -ge 25) {
                    $erros.Add('Muitas falhas seguidas; o backup foi interrompido e será tentado de novo depois.')
                    break
                }
            }
            $Sync.Feitos = $res.Copiados + $res.Falhas
        }

        # 6) Resumo.
        if ($res.Copiados -eq 0 -and $res.Falhas -eq 0) {
            if ($Modo -eq 'alterados') { $res.Mensagem = 'Nada novo ou modificado para copiar.' }
            else { $res.Mensagem = 'Nenhum arquivo novo.' }
        } else {
            $partes = New-Object System.Collections.Generic.List[string]
            if ($res.Novos -gt 0) { $partes.Add((Format-Plural $res.Novos 'arquivo novo' 'arquivos novos')) }
            if ($res.Alterados -gt 0) { $partes.Add((Format-Plural $res.Alterados 'modificado' 'modificados')) }
            if ($partes.Count -gt 0) {
                $res.Mensagem = ($partes -join ' e ') + ' copiado' + $(if ($res.Copiados -gt 1) { 's' } else { '' }) + ' (' + (Format-Tamanho $res.Bytes) + ')'
            }
            if ($res.Falhas -gt 0) {
                $textoFalha = Format-Plural $res.Falhas 'arquivo não pôde ser copiado' 'arquivos não puderam ser copiados'
                if ($res.Mensagem -ne '') { $res.Mensagem += "; $textoFalha" } else { $res.Mensagem = $textoFalha }
                if ($res.Copiados -gt 0) { $res.Status = 'parcial' } else { $res.Status = 'erro' }
            }
            $res.Mensagem += '.'
        }
    } catch [OperationCanceledException] {
        $res.Status = 'cancelado'
        $res.Mensagem = 'Cancelado.'
        if ($res.Copiados -gt 0) { $res.Mensagem = 'Cancelado depois de copiar ' + (Format-Plural $res.Copiados 'arquivo' 'arquivos') + '.' }
    } catch {
        $res.Status = 'erro'
        $res.Mensagem = Get-MensagemErro $_
    }

    $res.Fim = Get-Date
    if ($res.Copiados -gt 0 -or $res.Falhas -gt 0) {
        $res.Mensagem = $res.Mensagem.TrimEnd('.') + ' em ' + (Format-Duracao ($res.Fim - $res.Inicio)) + '.'
    }
    $res.Erros = [string[]]$erros.ToArray()
    $Sync.Fase = 'Concluído'
    if ($res.Status -ne 'indisponivel') {
        Write-Historico -Arquivo $ArquivoHistorico -Nome $Nome -Origem $origemN -Destino $destinoN -Resultado $res `
            -Copiados $copiados -Erros $erros -Avisos $avisos
    }
    return [pscustomobject]$res
}
