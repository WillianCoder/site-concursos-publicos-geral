# =============================================================================
#  Backup Automático - Painel
#  Janela principal + ícone perto do relógio do Windows. Enquanto o programa
#  estiver aberto (mesmo escondido no ícone), ele confere a agenda e faz os
#  backups na hora certa, sem abrir nenhuma janela preta.
# =============================================================================
param(
    [switch]$Bandeja,             # inicia escondido (usado ao ligar o Windows)
    [string]$CapturarTelas = ''   # modo de teste: salva imagens das telas e sai
)

$ErrorActionPreference = 'Continue'
$script:PastaApp = $PSScriptRoot
. ([IO.Path]::Combine($script:PastaApp, 'Nucleo.ps1'))
$script:TextoNucleo = [IO.File]::ReadAllText([IO.Path]::Combine($script:PastaApp, 'Nucleo.ps1'), [Text.Encoding]::UTF8)
$script:ModoCaptura = ($CapturarTelas -ne '')

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
try {
    Add-Type -Namespace BackupAuto -Name Win32 -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
[DllImport("user32.dll")] public static extern bool AllowSetForegroundWindow(int processId);
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
'@
} catch { }

# --- Só pode haver um painel aberto. Se já houver, ele é trazido para a frente.
$script:Mutex = $null
$script:EventoMostrar = $null
if (-not $script:ModoCaptura) {
    $criado = $false
    $script:Mutex = [System.Threading.Mutex]::new($true, 'Local\BackupAutomatico_Painel', [ref]$criado)
    if (-not $criado) {
        try { [void][BackupAuto.Win32]::AllowSetForegroundWindow(-1) } catch { }
        try { [void][System.Threading.EventWaitHandle]::OpenExisting('Local\BackupAutomatico_Mostrar').Set() } catch { }
        exit 0
    }
    $script:EventoMostrar = [System.Threading.EventWaitHandle]::new($false, [System.Threading.EventResetMode]::AutoReset, 'Local\BackupAutomatico_Mostrar')
}

# --- Aparência (nítida em telas com zoom de 125%, 150%...)
try { [void][BackupAuto.Win32]::SetProcessDPIAware() } catch { }
[System.Windows.Forms.Application]::EnableVisualStyles()
try { [System.Windows.Forms.Application]::SetCompatibleTextRenderingDefault($false) } catch { }
try { [System.Windows.Forms.Application]::SetUnhandledExceptionMode([System.Windows.Forms.UnhandledExceptionMode]::CatchException) } catch { }
[System.Windows.Forms.Application]::add_ThreadException({ param($s, $e) Write-LogErro ('Erro na tela: ' + $e.Exception.ToString()) })

$grafico = [System.Drawing.Graphics]::FromHwnd([IntPtr]::Zero)
$script:Escala = [Math]::Max(1.0, $grafico.DpiX / 96.0)
$grafico.Dispose()
function S([double]$Pixels) { return [int][Math]::Round($Pixels * $script:Escala) }
function New-Cor([int]$R, [int]$G, [int]$B) { return [System.Drawing.Color]::FromArgb($R, $G, $B) }
function New-Margem([int]$Esq, [int]$Cima, [int]$Dir, [int]$Baixo) { return New-Object System.Windows.Forms.Padding($Esq, $Cima, $Dir, $Baixo) }

$script:Cores = @{
    Fundo      = New-Cor 243 246 250
    Cabecalho  = New-Cor 30 58 95
    SubTitulo  = New-Cor 191 205 224
    Destaque   = New-Cor 37 99 235
    Realce     = New-Cor 219 234 254
    Texto      = New-Cor 30 41 59
    TextoSuave = New-Cor 100 116 139
    Borda      = New-Cor 203 213 225
    Ok         = New-Cor 21 128 61
    Aviso      = New-Cor 180 83 9
    Erro       = New-Cor 185 28 28
    Pausado    = New-Cor 148 163 184
    Branco     = [System.Drawing.Color]::White
}
$script:FonteBase    = New-Object System.Drawing.Font('Segoe UI', 10)
$script:FontePequena = New-Object System.Drawing.Font('Segoe UI', 9)
$script:FonteNegrito = New-Object System.Drawing.Font('Segoe UI Semibold', 10)
$script:FonteTitulo  = New-Object System.Drawing.Font('Segoe UI Semibold', 17)
$script:FonteVazio   = New-Object System.Drawing.Font('Segoe UI', 12)

# -----------------------------------------------------------------------------
#  Utilidades de tela
# -----------------------------------------------------------------------------

function New-IconeApp {
    # Desenha o ícone do programa: círculo azul com uma seta para cima.
    $bmp = New-Object System.Drawing.Bitmap(64, 64)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    $fundo = New-Object System.Drawing.SolidBrush($script:Cores.Destaque)
    $g.FillEllipse($fundo, 2, 2, 60, 60)
    $pontos = [System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF(32, 10)), (New-Object System.Drawing.PointF(51, 30)),
        (New-Object System.Drawing.PointF(39, 30)), (New-Object System.Drawing.PointF(39, 43)),
        (New-Object System.Drawing.PointF(25, 43)), (New-Object System.Drawing.PointF(25, 30)),
        (New-Object System.Drawing.PointF(13, 30)))
    $g.FillPolygon([System.Drawing.Brushes]::White, $pontos)
    $g.FillRectangle([System.Drawing.Brushes]::White, 17, 47, 30, 6)
    $g.Dispose()
    $fundo.Dispose()
    return [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
}

function New-Rotulo([string]$Texto, $Fonte = $null, $Cor = $null) {
    $l = New-Object System.Windows.Forms.Label
    $l.Text = $Texto
    $l.AutoSize = $true
    if ($null -ne $Fonte) { $l.Font = $Fonte }
    if ($null -ne $Cor) { $l.ForeColor = $Cor }
    $l.Margin = New-Margem 0 (S 4) (S 8) (S 4)
    return $l
}

function New-Botao([string]$Texto, [switch]$Primario, [switch]$Perigo) {
    $b = New-Object System.Windows.Forms.Button
    $b.Text = $Texto
    $b.AutoSize = $true
    $b.AutoSizeMode = [System.Windows.Forms.AutoSizeMode]::GrowAndShrink
    $b.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $b.UseVisualStyleBackColor = $false
    $b.Cursor = [System.Windows.Forms.Cursors]::Hand
    $b.Padding = New-Margem (S 10) (S 5) (S 10) (S 5)
    $b.Margin = New-Margem 0 0 (S 8) (S 6)
    $b.FlatAppearance.BorderSize = 1
    if ($Primario) {
        $b.BackColor = $script:Cores.Destaque
        $b.ForeColor = $script:Cores.Branco
        $b.FlatAppearance.BorderColor = $script:Cores.Destaque
        $b.Font = $script:FonteNegrito
    } else {
        $b.BackColor = $script:Cores.Branco
        $b.ForeColor = $script:Cores.Texto
        $b.FlatAppearance.BorderColor = $script:Cores.Borda
        if ($Perigo) { $b.ForeColor = $script:Cores.Erro }
    }
    return $b
}

function New-Fluxo([switch]$Vertical) {
    $f = New-Object System.Windows.Forms.FlowLayoutPanel
    $f.AutoSize = $true
    $f.AutoSizeMode = [System.Windows.Forms.AutoSizeMode]::GrowAndShrink
    $f.WrapContents = $false
    $f.Margin = New-Margem 0 0 0 0
    if ($Vertical) { $f.FlowDirection = [System.Windows.Forms.FlowDirection]::TopDown }
    return $f
}

function Add-Coluna($Tabela, [string]$Tipo, [float]$Valor = 0) {
    [void]$Tabela.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]$Tipo, $Valor)))
}

function Add-Linha($Tabela, [string]$Tipo, [float]$Valor = 0) {
    [void]$Tabela.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]$Tipo, $Valor)))
}

function Get-JanelaDona {
    if ($null -ne $script:Janela -and $script:Janela.Visible) { return $script:Janela }
    return $null
}

function Show-Mensagem([string]$Texto, [string]$Icone = 'Information', $Dono = $null) {
    if ($script:ModoCaptura) { Write-Host "[mensagem] $Texto"; return }
    if ($null -eq $Dono) { $Dono = Get-JanelaDona }
    if ($null -ne $Dono) {
        [void][System.Windows.Forms.MessageBox]::Show($Dono, $Texto, 'Backup Automático', 'OK', $Icone)
    } else {
        [void][System.Windows.Forms.MessageBox]::Show($Texto, 'Backup Automático', 'OK', $Icone)
    }
}

function Confirm-Pergunta([string]$Texto, $Dono = $null, [string]$Icone = 'Question') {
    if ($script:ModoCaptura) { return $true }
    if ($null -eq $Dono) { $Dono = Get-JanelaDona }
    if ($null -ne $Dono) {
        $r = [System.Windows.Forms.MessageBox]::Show($Dono, $Texto, 'Backup Automático', 'YesNo', $Icone)
    } else {
        $r = [System.Windows.Forms.MessageBox]::Show($Texto, 'Backup Automático', 'YesNo', $Icone)
    }
    return ($r -eq [System.Windows.Forms.DialogResult]::Yes)
}

function Invoke-Seguro([scriptblock]$Acao) {
    # Qualquer erro numa ação da tela vira uma mensagem amigável (e vai pro log).
    try { & $Acao }
    catch {
        Write-LogErro ("Ação: " + $_.Exception.ToString())
        Show-Mensagem ("Algo deu errado:`n`n" + (Get-MensagemErro $_)) 'Error'
    }
}

function Select-Pasta([string]$Descricao, [string]$Inicial, $Dono) {
    $fb = New-Object System.Windows.Forms.FolderBrowserDialog
    $fb.Description = $Descricao
    $fb.ShowNewFolderButton = $true
    if ($Inicial -and [IO.Directory]::Exists($Inicial)) { $fb.SelectedPath = $Inicial }
    $ok = ($fb.ShowDialog($Dono) -eq [System.Windows.Forms.DialogResult]::OK)
    $caminho = $fb.SelectedPath
    $fb.Dispose()
    if ($ok) { return $caminho }
    return $null
}

function Open-Pasta([string]$Caminho) {
    if ($Caminho -and [IO.Directory]::Exists($Caminho)) {
        Start-Process -FilePath 'explorer.exe' -ArgumentList ('"' + $Caminho + '"')
    } else {
        Show-Mensagem "Esta pasta não existe ou não está acessível agora:`n`n$Caminho`n`n(Ela é criada no primeiro backup.)" 'Warning'
    }
}

$script:CacheDrive = @{ Caminho = $null; Quando = [datetime]::MinValue }
function Get-GoogleDrive([switch]$Atualizar) {
    if ($Atualizar -or ((Get-Date) - $script:CacheDrive.Quando).TotalSeconds -gt 60) {
        $script:CacheDrive.Caminho = Find-GoogleDrive
        $script:CacheDrive.Quando = Get-Date
    }
    return $script:CacheDrive.Caminho
}

function Save-ConfiguracaoSegura {
    try { Save-Configuracao $script:Cfg }
    catch {
        Write-LogErro "Falha ao salvar configuração: $(Get-MensagemErro $_)"
        Show-Mensagem ("Não consegui salvar as configurações:`n`n" + (Get-MensagemErro $_)) 'Error'
    }
}

function Show-Notificacao([string]$Titulo, [string]$Texto, [string]$Tipo = 'Info') {
    if (-not $script:Cfg.notificacoes -or $null -eq $script:IconeBandeja) { return }
    if ($Texto.Length -gt 250) { $Texto = $Texto.Substring(0, 247) + '...' }
    if ($Titulo.Length -gt 60) { $Titulo = $Titulo.Substring(0, 57) + '...' }
    try { $script:IconeBandeja.ShowBalloonTip(8000, $Titulo, $Texto, [System.Windows.Forms.ToolTipIcon]$Tipo) } catch { }
}

# -----------------------------------------------------------------------------
#  Estado
# -----------------------------------------------------------------------------

$script:Cfg = Read-Configuracao
$script:Fila = New-Object System.Collections.Generic.List[string]
$script:Execucao = $null
$script:Saindo = $false
$script:AvisoBandejaMostrado = $false
$script:Tiques = 0
$script:AgendaLiberadaEm = (Get-Date).AddSeconds(3)
if ($Bandeja) { $script:AgendaLiberadaEm = (Get-Date).AddSeconds(90) }  # dá tempo do Google Drive conectar
$script:Icone = New-IconeApp
$script:SoltasPendentes = New-Object System.Collections.Generic.List[string]

function Find-Trabalho([string]$Id) {
    foreach ($t in $script:Cfg.trabalhos) { if ($t.id -eq $Id) { return $t } }
    return $null
}

function Test-Executando($Trabalho) {
    return ($null -ne $script:Execucao -and $script:Execucao.Id -eq $Trabalho.id)
}

# -----------------------------------------------------------------------------
#  Janela principal
# -----------------------------------------------------------------------------

$script:Janela = New-Object System.Windows.Forms.Form
$Janela.Text = 'Backup Automático'
$Janela.Icon = $script:Icone
$Janela.Font = $script:FonteBase
$Janela.BackColor = $script:Cores.Fundo
$Janela.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::None
$Janela.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$Janela.Size = New-Object System.Drawing.Size([Math]::Min((S 1120), [int]($area.Width * 0.95)), [Math]::Min((S 640), [int]($area.Height * 0.92)))
$Janela.MinimumSize = New-Object System.Drawing.Size([Math]::Min((S 780), $area.Width), [Math]::Min((S 460), $area.Height))

$raiz = New-Object System.Windows.Forms.TableLayoutPanel
$raiz.Dock = [System.Windows.Forms.DockStyle]::Fill
$raiz.ColumnCount = 1
$raiz.RowCount = 4
$raiz.Margin = New-Margem 0 0 0 0
Add-Coluna $raiz 'Percent' 100
Add-Linha $raiz 'AutoSize'
Add-Linha $raiz 'AutoSize'
Add-Linha $raiz 'Percent' 100
Add-Linha $raiz 'AutoSize'
$Janela.Controls.Add($raiz)

# Cabeçalho
$cabecalho = New-Object System.Windows.Forms.TableLayoutPanel
$cabecalho.Dock = [System.Windows.Forms.DockStyle]::Fill
$cabecalho.AutoSize = $true
$cabecalho.AutoSizeMode = [System.Windows.Forms.AutoSizeMode]::GrowAndShrink
$cabecalho.BackColor = $script:Cores.Cabecalho
$cabecalho.Padding = New-Margem (S 22) (S 14) (S 22) (S 14)
$cabecalho.Margin = New-Margem 0 0 0 0
$cabecalho.ColumnCount = 2
Add-Coluna $cabecalho 'Percent' 100
Add-Coluna $cabecalho 'AutoSize'
$lblTitulo = New-Rotulo 'Backup Automático' $script:FonteTitulo $script:Cores.Branco
$lblTitulo.Margin = New-Margem 0 0 0 0
$script:LblSubtitulo = New-Rotulo 'Arraste uma pasta para esta janela e ela passa a ter backup automático.' $script:FonteBase $script:Cores.SubTitulo
$LblSubtitulo.Margin = New-Margem (S 2) (S 2) 0 0
$script:LblDrive = New-Rotulo '' $script:FonteBase $script:Cores.Branco
$LblDrive.Anchor = [System.Windows.Forms.AnchorStyles]::Right
$LblDrive.TextAlign = [System.Drawing.ContentAlignment]::MiddleRight
$cabecalho.Controls.Add($lblTitulo, 0, 0)
$cabecalho.Controls.Add($LblSubtitulo, 0, 1)
$cabecalho.Controls.Add($LblDrive, 1, 0)
$cabecalho.SetRowSpan($LblDrive, 2)
$raiz.Controls.Add($cabecalho, 0, 0)

# Barra de botões
$barra = New-Object System.Windows.Forms.FlowLayoutPanel
$barra.Dock = [System.Windows.Forms.DockStyle]::Fill
$barra.AutoSize = $true
$barra.AutoSizeMode = [System.Windows.Forms.AutoSizeMode]::GrowAndShrink
$barra.WrapContents = $true
$barra.Padding = New-Margem (S 14) (S 12) (S 14) (S 4)
$barra.Margin = New-Margem 0 0 0 0
$script:BtnAdicionar = New-Botao '+  Adicionar pasta' -Primario
$script:BtnAgora = New-Botao 'Fazer backup agora'
$BtnAgora.MinimumSize = New-Object System.Drawing.Size((S 160), 0)
$script:BtnEditar = New-Botao 'Editar'
$script:BtnPausar = New-Botao 'Pausar'
$BtnPausar.MinimumSize = New-Object System.Drawing.Size((S 90), 0)
$script:BtnAbrirDestino = New-Botao 'Abrir backup'
$script:BtnHistorico = New-Botao 'Ver histórico'
$script:BtnRemover = New-Botao 'Remover' -Perigo
$barra.Controls.AddRange(@($BtnAdicionar, $BtnAgora, $BtnEditar, $BtnPausar, $BtnAbrirDestino, $BtnHistorico, $BtnRemover))
$raiz.Controls.Add($barra, 0, 1)

# Lista de backups (e o aviso de "arraste aqui" quando está vazia)
$areaLista = New-Object System.Windows.Forms.Panel
$areaLista.Dock = [System.Windows.Forms.DockStyle]::Fill
$areaLista.Padding = New-Margem (S 16) (S 4) (S 16) (S 6)
$areaLista.Margin = New-Margem 0 0 0 0

$script:Lista = New-Object System.Windows.Forms.ListView
$Lista.Dock = [System.Windows.Forms.DockStyle]::Fill
$Lista.View = [System.Windows.Forms.View]::Details
$Lista.FullRowSelect = $true
$Lista.MultiSelect = $false
$Lista.HideSelection = $false
$Lista.HeaderStyle = [System.Windows.Forms.ColumnHeaderStyle]::Nonclickable
$Lista.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
$Lista.ShowItemToolTips = $true
$Lista.Font = $script:FonteBase
$alturaLinha = New-Object System.Windows.Forms.ImageList
$alturaLinha.ImageSize = New-Object System.Drawing.Size(1, (S 30))
$Lista.SmallImageList = $alturaLinha
try {
    $prop = $Lista.GetType().GetProperty('DoubleBuffered', [Reflection.BindingFlags]'NonPublic,Instance')
    $prop.SetValue($Lista, $true, $null)
} catch { }
$script:Colunas = @(
    @{ Titulo = 'Situação';       Fixa = 118 },
    @{ Titulo = 'Nome';           Parte = 0.17 },
    @{ Titulo = 'Copiar de';      Parte = 0.25 },
    @{ Titulo = 'Para';           Parte = 0.25 },
    @{ Titulo = 'Frequência';     Fixa = 118 },
    @{ Titulo = 'Último backup';  Parte = 0.33 },
    @{ Titulo = 'Próximo backup'; Fixa = 168 }
)
foreach ($c in $script:Colunas) { [void]$Lista.Columns.Add($c.Titulo, (S 100)) }

$script:Vazio = New-Object System.Windows.Forms.Label
$Vazio.Dock = [System.Windows.Forms.DockStyle]::Fill
$Vazio.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
$Vazio.Font = $script:FonteVazio
$Vazio.ForeColor = $script:Cores.TextoSuave
$Vazio.BackColor = $script:Cores.Branco
$Vazio.Text = "Nenhuma pasta com backup ainda.`n`nArraste para cá a pasta que você quer proteger`n(do Explorador de Arquivos ou da Área de Trabalho)`n`nou clique em  `"+  Adicionar pasta`"."
$Vazio.Add_Paint({
    param($s, $e)
    $caneta = New-Object System.Drawing.Pen($script:Cores.Borda, [float](S 2))
    $caneta.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
    $e.Graphics.DrawRectangle($caneta, (S 6), (S 6), $s.ClientSize.Width - (S 13), $s.ClientSize.Height - (S 13))
    $caneta.Dispose()
})
$Vazio.Add_Resize({ $this.Invalidate() })
$areaLista.Controls.Add($Lista)
$areaLista.Controls.Add($Vazio)
$raiz.Controls.Add($areaLista, 0, 2)

# Rodapé
$rodape = New-Object System.Windows.Forms.TableLayoutPanel
$rodape.Dock = [System.Windows.Forms.DockStyle]::Fill
$rodape.AutoSize = $true
$rodape.AutoSizeMode = [System.Windows.Forms.AutoSizeMode]::GrowAndShrink
$rodape.ColumnCount = 3
$rodape.Padding = New-Margem (S 16) 0 (S 16) (S 8)
$rodape.Margin = New-Margem 0 0 0 0
Add-Coluna $rodape 'Percent' 100
Add-Coluna $rodape 'AutoSize'
Add-Coluna $rodape 'AutoSize'
$script:LblStatus = New-Object System.Windows.Forms.Label
$LblStatus.AutoSize = $false
$LblStatus.AutoEllipsis = $true
$LblStatus.Dock = [System.Windows.Forms.DockStyle]::Fill
$LblStatus.TextAlign = [System.Drawing.ContentAlignment]::MiddleLeft
$LblStatus.ForeColor = $script:Cores.TextoSuave
$LblStatus.Height = S 26
$script:ChkIniciar = New-Object System.Windows.Forms.CheckBox
$ChkIniciar.Text = 'Iniciar junto com o Windows'
$ChkIniciar.AutoSize = $true
$ChkIniciar.Anchor = [System.Windows.Forms.AnchorStyles]::Right
$ChkIniciar.Checked = [bool]$script:Cfg.iniciarComWindows
$script:ChkAvisos = New-Object System.Windows.Forms.CheckBox
$ChkAvisos.Text = 'Mostrar notificações'
$ChkAvisos.AutoSize = $true
$ChkAvisos.Anchor = [System.Windows.Forms.AnchorStyles]::Right
$ChkAvisos.Checked = [bool]$script:Cfg.notificacoes
$ChkAvisos.Margin = New-Margem (S 16) (S 3) 0 (S 3)
$rodape.Controls.Add($LblStatus, 0, 0)
$rodape.Controls.Add($ChkIniciar, 1, 0)
$rodape.Controls.Add($ChkAvisos, 2, 0)
$raiz.Controls.Add($rodape, 0, 3)

# Menu do botão direito na lista
$script:MenuLista = New-Object System.Windows.Forms.ContextMenuStrip
$script:MiAgora = $MenuLista.Items.Add('Fazer backup agora')
$script:MiEditar = $MenuLista.Items.Add('Editar...')
$script:MiPausar = $MenuLista.Items.Add('Pausar')
[void]$MenuLista.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
$script:MiAbrirOrigem = $MenuLista.Items.Add('Abrir a pasta de origem')
$script:MiAbrirDestino = $MenuLista.Items.Add('Abrir a pasta de backup')
$script:MiHistorico = $MenuLista.Items.Add('Ver histórico')
[void]$MenuLista.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
$script:MiRemover = $MenuLista.Items.Add('Remover (desvincular)')
$Lista.ContextMenuStrip = $MenuLista

# -----------------------------------------------------------------------------
#  Ícone perto do relógio
# -----------------------------------------------------------------------------

$script:IconeBandeja = New-Object System.Windows.Forms.NotifyIcon
$IconeBandeja.Icon = $script:Icone
$IconeBandeja.Text = 'Backup Automático'
$script:MenuBandeja = New-Object System.Windows.Forms.ContextMenuStrip
$script:MbAbrir = $MenuBandeja.Items.Add('Abrir o painel')
$MbAbrir.Font = New-Object System.Drawing.Font($MenuBandeja.Font, [System.Drawing.FontStyle]::Bold)
$script:MbTodos = $MenuBandeja.Items.Add('Fazer backup de tudo agora')
[void]$MenuBandeja.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
$script:MbSair = $MenuBandeja.Items.Add('Sair do Backup Automático')
$IconeBandeja.ContextMenuStrip = $MenuBandeja
if (-not $script:ModoCaptura) { $IconeBandeja.Visible = $true }

# -----------------------------------------------------------------------------
#  Atualização da tela
# -----------------------------------------------------------------------------

function Update-LarguraColunas {
    $disponivel = $Lista.ClientSize.Width - 2
    $fixas = 0
    foreach ($c in $script:Colunas) { if ($c.Fixa) { $fixas += (S $c.Fixa) } }
    $resto = [Math]::Max((S 360), $disponivel - $fixas)
    for ($i = 0; $i -lt $script:Colunas.Count; $i++) {
        $c = $script:Colunas[$i]
        if ($c.Fixa) { $largura = S $c.Fixa } else { $largura = [int]($resto * $c.Parte) }
        if ($Lista.Columns[$i].Width -ne $largura) { $Lista.Columns[$i].Width = $largura }
    }
}

function Get-Situacao($t) {
    if (Test-Executando $t) { return @('Executando', $script:Cores.Destaque) }
    if ($script:Fila.Contains($t.id)) { return @('Na fila', $script:Cores.Destaque) }
    if (-not $t.ativo) { return @('Pausado', $script:Cores.Pausado) }
    if ($t.ultimoStatus -eq 'erro') { return @('Erro', $script:Cores.Erro) }
    if ($t.ultimoStatus -eq 'indisponivel') { return @('Aguardando', $script:Cores.Aviso) }
    if ($t.ultimoStatus -eq 'parcial') { return @('Atenção', $script:Cores.Aviso) }
    return @('Ativo', $script:Cores.Ok)
}

function Get-TextoProgresso {
    $e = $script:Execucao
    if ($null -eq $e) { return '' }
    $s = $e.Sync
    if ($e.Tipo -eq 'base') { return 'Anotando os arquivos que já existem... ' + (Format-Numero ([long]$s.Lidos)) }
    if ($s.Cancelar) { return 'Cancelando...' }
    switch ([string]$s.Fase) {
        'Lendo a pasta de origem' { return 'Lendo a pasta... ' + (Format-Plural ([long]$s.Lidos) 'arquivo' 'arquivos') }
        'Comparando com o backup' { return 'Comparando com o backup...' }
        'Copiando' {
            if ([long]$s.Total -eq 0) { return 'Conferindo...' }
            return 'Copiando ' + (Format-Numero ([long]$s.Feitos)) + ' de ' + (Format-Numero ([long]$s.Total)) + '...'
        }
    }
    return 'Preparando...'
}

function Get-TextoUltimo($t) {
    if (Test-Executando $t) { return (Get-TextoProgresso) }
    if (@('erro', 'indisponivel', 'base') -contains $t.ultimoStatus) { return $t.ultimoResumo }
    $ultima = ConvertFrom-TextoData $t.ultimaExecucao
    if ($null -eq $ultima) {
        if (Test-BaseNecessaria $t) { return 'Preparando o ponto de partida...' }
        return 'Ainda não fez backup'
    }
    return (Format-DataAmigavel $ultima) + '  ·  ' + $t.ultimoResumo
}

function Get-TextoProximo($t) {
    if (-not $t.ativo) { return 'Pausado' }
    if (Test-Executando $t) { return 'Agora' }
    $p = Get-ProximaExecucao $t
    if ($p -le (Get-Date)) { return 'Em instantes' }
    return (Format-DataAmigavel $p)
}

function Get-TrabalhoSelecionado {
    if ($Lista.SelectedItems.Count -eq 0) { return $null }
    return (Find-Trabalho ([string]$Lista.SelectedItems[0].Tag))
}

function Update-Lista {
    $selecionado = $null
    if ($Lista.SelectedItems.Count -gt 0) { $selecionado = [string]$Lista.SelectedItems[0].Tag }
    $Lista.BeginUpdate()
    $Lista.Items.Clear()
    foreach ($t in $script:Cfg.trabalhos) {
        $situacao = Get-Situacao $t
        $item = New-Object System.Windows.Forms.ListViewItem(('●  ' + $situacao[0]))
        $item.UseItemStyleForSubItems = $false
        $item.Tag = $t.id
        $item.ForeColor = $situacao[1]
        [void]$item.SubItems.Add($t.nome)
        [void]$item.SubItems.Add($t.origem)
        [void]$item.SubItems.Add((Get-DestinoFinal $t))
        [void]$item.SubItems.Add((Format-Frequencia $t.intervaloValor $t.intervaloUnidade))
        [void]$item.SubItems.Add((Get-TextoUltimo $t))
        [void]$item.SubItems.Add((Get-TextoProximo $t))
        for ($i = 1; $i -lt $item.SubItems.Count; $i++) {
            if ($t.ativo) { $item.SubItems[$i].ForeColor = $script:Cores.Texto } else { $item.SubItems[$i].ForeColor = $script:Cores.Pausado }
        }
        if ($t.ultimoStatus -eq 'erro' -and -not (Test-Executando $t)) { $item.SubItems[5].ForeColor = $script:Cores.Erro }
        $item.ToolTipText = "$($t.nome)`nDe: $($t.origem)`nPara: $(Get-DestinoFinal $t)`n$($t.ultimoResumo)"
        [void]$Lista.Items.Add($item)
        if ($t.id -eq $selecionado) { $item.Selected = $true }
    }
    if ($Lista.SelectedItems.Count -eq 0 -and $Lista.Items.Count -eq 1) { $Lista.Items[0].Selected = $true }
    $Lista.EndUpdate()
    $vazia = ($Lista.Items.Count -eq 0)
    $Vazio.Visible = $vazia
    $Lista.Visible = -not $vazia
    Update-Botoes
    Update-Status
}

function Update-Progresso {
    if ($null -eq $script:Execucao) { return }
    $texto = Get-TextoProgresso
    foreach ($item in $Lista.Items) {
        if ([string]$item.Tag -eq $script:Execucao.Id -and $item.SubItems[5].Text -ne $texto) { $item.SubItems[5].Text = $texto }
    }
    Update-Status
}

function Update-Botoes {
    $t = Get-TrabalhoSelecionado
    $tem = ($null -ne $t)
    foreach ($b in @($BtnAgora, $BtnEditar, $BtnPausar, $BtnAbrirDestino, $BtnHistorico, $BtnRemover)) { $b.Enabled = $tem }
    if ($tem) {
        if ($t.ativo) { $BtnPausar.Text = 'Pausar' } else { $BtnPausar.Text = 'Retomar' }
        if (Test-Executando $t) { $BtnAgora.Text = 'Cancelar backup' } else { $BtnAgora.Text = 'Fazer backup agora' }
        $MiPausar.Text = $BtnPausar.Text
        $MiAgora.Text = $BtnAgora.Text
    }
}

function Update-Status {
    if ($null -ne $script:Execucao) {
        $texto = 'Fazendo backup de “' + $script:Execucao.Nome + '”: ' + (Get-TextoProgresso)
        $dica = 'Backup Automático - copiando “' + $script:Execucao.Nome + '”'
    } elseif ($script:Cfg.trabalhos.Count -eq 0) {
        $texto = 'Nenhuma pasta vinculada ainda.'
        $dica = 'Backup Automático'
    } else {
        $proximo = $null
        $quando = $null
        foreach ($t in $script:Cfg.trabalhos) {
            if (-not $t.ativo) { continue }
            $p = Get-ProximaExecucao $t
            if ($null -eq $quando -or $p -lt $quando) { $quando = $p; $proximo = $t }
        }
        if ($null -eq $proximo) {
            $texto = 'Todos os backups estão pausados.'
        } else {
            $texto = 'Tudo certo. Próximo backup: “' + $proximo.nome + '”, ' + (Get-TextoProximo $proximo).ToLower() + '.'
        }
        $dica = 'Backup Automático - tudo certo'
    }
    if ($LblStatus.Text -ne $texto) { $LblStatus.Text = $texto }
    if ($dica.Length -gt 63) { $dica = $dica.Substring(0, 60) + '...' }
    if ($IconeBandeja.Text -ne $dica) { $IconeBandeja.Text = $dica }
}

function Update-Drive {
    $drive = Get-GoogleDrive -Atualizar
    if ($drive) {
        $LblDrive.Text = "Google Drive encontrado`n$drive"
        $LblDrive.ForeColor = $script:Cores.Branco
    } else {
        $LblDrive.Text = "Google Drive não encontrado`n(abra o Google Drive para computador)"
        $LblDrive.ForeColor = New-Cor 253 230 138
    }
}

function Show-Janela {
    if (-not $Janela.Visible) { $Janela.Show() }
    if ($Janela.WindowState -eq [System.Windows.Forms.FormWindowState]::Minimized) { $Janela.WindowState = [System.Windows.Forms.FormWindowState]::Normal }
    $Janela.TopMost = $true
    $Janela.TopMost = $false
    $Janela.Activate()
    try { [void][BackupAuto.Win32]::SetForegroundWindow($Janela.Handle) } catch { }
    Update-Drive
    Update-Lista
}

function Set-RealceSoltar([bool]$Ativo) {
    if ($Ativo) {
        $Vazio.BackColor = $script:Cores.Realce
        $Lista.BackColor = $script:Cores.Realce
        $LblSubtitulo.Text = 'Solte a pasta para criar o backup dela.'
    } else {
        $Vazio.BackColor = $script:Cores.Branco
        $Lista.BackColor = $script:Cores.Branco
        $LblSubtitulo.Text = 'Arraste uma pasta para esta janela e ela passa a ter backup automático.'
    }
}

# -----------------------------------------------------------------------------
#  Janela de criar/editar um backup
# -----------------------------------------------------------------------------

function Show-DialogoTrabalho {
    param($Trabalho = $null, [string]$OrigemInicial = '')
    $novo = ($null -eq $Trabalho)
    $drive = Get-GoogleDrive -Atualizar
    if ($novo) {
        $nomeInicial = ''
        if ($OrigemInicial) { $nomeInicial = Get-NomePasta $OrigemInicial }
        $Trabalho = New-Trabalho @{ origem = $OrigemInicial; nome = $nomeInicial }
        if ($drive) { $Trabalho.destinoBase = [IO.Path]::Combine($drive, 'Backup Automático') }
    }
    $estado = @{ NomeEditado = (-not $novo); Valores = $null }
    $larguraCampo = S 440

    $dlg = New-Object System.Windows.Forms.Form
    if ($novo) { $dlg.Text = 'Novo backup' } else { $dlg.Text = 'Editar backup' }
    $dlg.Font = $script:FonteBase
    $dlg.BackColor = $script:Cores.Branco
    $dlg.Icon = $script:Icone
    $dlg.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::None
    $dlg.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
    $dlg.MaximizeBox = $false
    $dlg.MinimizeBox = $false
    $dlg.ShowInTaskbar = $false
    $dlg.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterParent
    if ($null -eq (Get-JanelaDona)) { $dlg.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen }

    $g = New-Object System.Windows.Forms.TableLayoutPanel
    $g.AutoSize = $true
    $g.AutoSizeMode = [System.Windows.Forms.AutoSizeMode]::GrowAndShrink
    $g.ColumnCount = 3
    $g.Location = New-Object System.Drawing.Point((S 20), (S 16))
    Add-Coluna $g 'AutoSize'
    Add-Coluna $g 'Absolute' $larguraCampo
    Add-Coluna $g 'AutoSize'

    function New-Titulo([string]$Texto) {
        $l = New-Rotulo $Texto $script:FonteNegrito $script:Cores.Texto
        $l.Anchor = [System.Windows.Forms.AnchorStyles]::Left
        $l.Margin = New-Margem 0 (S 6) (S 14) (S 6)
        return $l
    }
    function New-Dica([string]$Texto) {
        $l = New-Rotulo $Texto $script:FontePequena $script:Cores.TextoSuave
        $l.MaximumSize = New-Object System.Drawing.Size(($larguraCampo + (S 110)), 0)
        $l.Margin = New-Margem 0 0 0 (S 6)
        return $l
    }
    function New-Caixa {
        $c = New-Object System.Windows.Forms.TextBox
        $c.Anchor = [System.Windows.Forms.AnchorStyles]'Left, Right'
        $c.Margin = New-Margem 0 (S 5) (S 6) (S 5)
        $c.AllowDrop = $true
        return $c
    }

    # Nome
    $txtNome = New-Caixa
    $txtNome.Text = $Trabalho.nome
    $txtNome.AllowDrop = $false
    $g.Controls.Add((New-Titulo 'Nome do backup'), 0, 0)
    $g.Controls.Add($txtNome, 1, 0)

    # Origem
    $txtOrigem = New-Caixa
    $txtOrigem.Text = $Trabalho.origem
    $btnOrigem = New-Botao 'Escolher...'
    $btnOrigem.Margin = New-Margem 0 (S 2) 0 (S 2)
    $g.Controls.Add((New-Titulo 'Copiar a pasta'), 0, 1)
    $g.Controls.Add($txtOrigem, 1, 1)
    $g.Controls.Add($btnOrigem, 2, 1)
    $dicaOrigem = New-Dica 'A pasta que você quer proteger. Dica: dá para arrastar uma pasta para dentro destes campos.'
    $g.Controls.Add($dicaOrigem, 1, 2)
    $g.SetColumnSpan($dicaOrigem, 2)

    # Destino
    $txtDestino = New-Caixa
    $txtDestino.Text = $Trabalho.destinoBase
    $btnDestino = New-Botao 'Escolher...'
    $btnDestino.Margin = New-Margem 0 (S 2) 0 (S 2)
    $g.Controls.Add((New-Titulo 'Para a pasta'), 0, 3)
    $g.Controls.Add($txtDestino, 1, 3)
    $g.Controls.Add($btnDestino, 2, 3)
    $fluxoDestino = New-Fluxo
    $btnDrive = New-Botao 'Usar meu Google Drive'
    $btnDrive.Margin = New-Margem 0 (S 2) (S 12) (S 2)
    if (-not $drive) { $btnDrive.Enabled = $false; $btnDrive.Text = 'Google Drive não encontrado' }
    $chkSub = New-Object System.Windows.Forms.CheckBox
    $chkSub.AutoSize = $true
    $chkSub.Checked = [bool]$Trabalho.criarSubpasta
    $chkSub.Anchor = [System.Windows.Forms.AnchorStyles]::Left
    $chkSub.Margin = New-Margem 0 (S 7) 0 (S 2)
    $fluxoDestino.Controls.AddRange(@($btnDrive, $chkSub))
    $g.Controls.Add($fluxoDestino, 1, 4)
    $g.SetColumnSpan($fluxoDestino, 2)
    $lblFinal = New-Dica ''
    $lblFinal.Margin = New-Margem 0 (S 4) 0 (S 10)
    $g.Controls.Add($lblFinal, 1, 5)
    $g.SetColumnSpan($lblFinal, 2)

    # Frequência
    $fluxoFreq = New-Fluxo
    $lblCada = New-Rotulo 'A cada'
    $lblCada.Anchor = [System.Windows.Forms.AnchorStyles]::Left
    $lblCada.Margin = New-Margem 0 (S 7) (S 6) 0
    $num = New-Object System.Windows.Forms.NumericUpDown
    $num.Minimum = 1
    $num.Maximum = 999
    $num.Value = [Math]::Max(1, [Math]::Min(999, [int]$Trabalho.intervaloValor))
    $num.Width = S 70
    $num.Margin = New-Margem 0 (S 4) (S 6) (S 4)
    $cmb = New-Object System.Windows.Forms.ComboBox
    $cmb.DropDownStyle = [System.Windows.Forms.ComboBoxStyle]::DropDownList
    $cmb.Width = S 130
    $cmb.Margin = New-Margem 0 (S 4) 0 (S 4)
    foreach ($u in $script:Unidades) { [void]$cmb.Items.Add($u) }
    $cmb.SelectedItem = $Trabalho.intervaloUnidade
    $fluxoFreq.Controls.AddRange(@($lblCada, $num, $cmb))
    $g.Controls.Add((New-Titulo 'Frequência'), 0, 6)
    $g.Controls.Add($fluxoFreq, 1, 6)
    $g.SetColumnSpan($fluxoFreq, 2)

    # Início
    $fluxoInicio = New-Fluxo
    $dtp = New-Object System.Windows.Forms.DateTimePicker
    $dtp.Format = [System.Windows.Forms.DateTimePickerFormat]::Custom
    $dtp.CustomFormat = 'dd/MM/yyyy   HH:mm'
    $dtp.Width = S 180
    $dtp.Margin = New-Margem 0 (S 4) (S 8) (S 4)
    $inicio = ConvertFrom-TextoData $Trabalho.inicio
    if ($null -eq $inicio) { $inicio = Get-Date }
    $dtp.Value = $inicio
    $btnAgoraData = New-Botao 'Agora'
    $btnAgoraData.Margin = New-Margem 0 (S 2) 0 (S 2)
    $fluxoInicio.Controls.AddRange(@($dtp, $btnAgoraData))
    $g.Controls.Add((New-Titulo 'Começar em'), 0, 7)
    $g.Controls.Add($fluxoInicio, 1, 7)
    $g.SetColumnSpan($fluxoInicio, 2)
    $dicaInicio = New-Dica 'O primeiro backup acontece nesse dia e horário. Os próximos seguem a frequência escolhida (ex.: toda semana, no mesmo dia e hora).'
    $g.Controls.Add($dicaInicio, 1, 8)
    $g.SetColumnSpan($dicaInicio, 2)

    # O que copiar
    $fluxoModo = New-Fluxo -Vertical
    $rbNovos = New-Object System.Windows.Forms.RadioButton
    $rbNovos.Text = 'Só arquivos novos (os que ainda não estão no backup)'
    $rbNovos.AutoSize = $true
    $rbNovos.Margin = New-Margem 0 (S 5) 0 (S 1)
    $rbAlterados = New-Object System.Windows.Forms.RadioButton
    $rbAlterados.Text = 'Arquivos novos e também os que foram modificados'
    $rbAlterados.AutoSize = $true
    $rbAlterados.Margin = New-Margem 0 (S 1) 0 (S 6)
    if ($Trabalho.modo -eq 'alterados') { $rbAlterados.Checked = $true } else { $rbNovos.Checked = $true }
    $fluxoModo.Controls.AddRange(@($rbNovos, $rbAlterados))
    $tituloModo = New-Titulo 'O que copiar'
    $tituloModo.Anchor = [System.Windows.Forms.AnchorStyles]'Top, Left'
    $g.Controls.Add($tituloModo, 0, 9)
    $g.Controls.Add($fluxoModo, 1, 9)
    $g.SetColumnSpan($fluxoModo, 2)

    # Arquivos que já existem
    $fluxoExist = New-Fluxo -Vertical
    $rbTudo = New-Object System.Windows.Forms.RadioButton
    $rbTudo.Text = 'Copiar também (o primeiro backup leva o que já existe)'
    $rbTudo.AutoSize = $true
    $rbTudo.Margin = New-Margem 0 (S 5) 0 (S 1)
    $rbIgnorar = New-Object System.Windows.Forms.RadioButton
    $rbIgnorar.Text = 'Ignorar: copiar só o que for adicionado daqui pra frente'
    $rbIgnorar.AutoSize = $true
    $rbIgnorar.Margin = New-Margem 0 (S 1) 0 (S 6)
    if ($Trabalho.ignorarExistentes) { $rbIgnorar.Checked = $true } else { $rbTudo.Checked = $true }
    $fluxoExist.Controls.AddRange(@($rbTudo, $rbIgnorar))
    $tituloExist = New-Titulo 'Arquivos que já existem'
    $tituloExist.Anchor = [System.Windows.Forms.AnchorStyles]'Top, Left'
    $g.Controls.Add($tituloExist, 0, 10)
    $g.Controls.Add($fluxoExist, 1, 10)
    $g.SetColumnSpan($fluxoExist, 2)

    # Ligado / pausado
    $chkAtivo = New-Object System.Windows.Forms.CheckBox
    $chkAtivo.Text = 'Backup ligado (desmarque para pausar)'
    $chkAtivo.AutoSize = $true
    $chkAtivo.Checked = [bool]$Trabalho.ativo
    $chkAtivo.Margin = New-Margem 0 (S 4) 0 (S 8)
    $g.Controls.Add($chkAtivo, 1, 11)
    $g.SetColumnSpan($chkAtivo, 2)

    # Resumo
    $lblPrevia = New-Rotulo '' $script:FonteNegrito $script:Cores.Destaque
    $lblPrevia.MaximumSize = New-Object System.Drawing.Size(($larguraCampo + (S 260)), 0)
    $lblPrevia.Margin = New-Margem 0 (S 6) 0 (S 12)
    $g.Controls.Add($lblPrevia, 0, 12)
    $g.SetColumnSpan($lblPrevia, 3)

    # Botões
    $fluxoBotoes = New-Fluxo
    $fluxoBotoes.FlowDirection = [System.Windows.Forms.FlowDirection]::RightToLeft
    $fluxoBotoes.Anchor = [System.Windows.Forms.AnchorStyles]::Right
    $btnSalvar = New-Botao 'Salvar' -Primario
    $btnSalvar.MinimumSize = New-Object System.Drawing.Size((S 110), 0)
    $btnSalvar.Margin = New-Margem 0 0 0 0
    $btnCancelar = New-Botao 'Cancelar'
    $btnCancelar.MinimumSize = New-Object System.Drawing.Size((S 100), 0)
    $btnCancelar.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    $fluxoBotoes.Controls.AddRange(@($btnSalvar, $btnCancelar))
    $g.Controls.Add($fluxoBotoes, 0, 13)
    $g.SetColumnSpan($fluxoBotoes, 3)

    $dlg.Controls.Add($g)
    $dlg.AcceptButton = $btnSalvar
    $dlg.CancelButton = $btnCancelar

    function Get-ValoresDialogo {
        $d = $dtp.Value
        return @{
            nome              = $txtNome.Text.Trim()
            origem            = Get-CaminhoNormalizado $txtOrigem.Text
            destinoBase       = Get-CaminhoNormalizado $txtDestino.Text
            criarSubpasta     = $chkSub.Checked
            modo              = $(if ($rbAlterados.Checked) { 'alterados' } else { 'novos' })
            intervaloValor    = [int]$num.Value
            intervaloUnidade  = [string]$cmb.SelectedItem
            inicio            = ConvertTo-TextoData ($d.Date.AddHours($d.Hour).AddMinutes($d.Minute))
            ativo             = $chkAtivo.Checked
            ignorarExistentes = $rbIgnorar.Checked
        }
    }

    function Update-Previa {
        $v = Get-ValoresDialogo
        $nomeOrigem = 'Nome da pasta'
        if ($v.origem) { $nomeOrigem = Get-NomePasta $v.origem }
        $chkSub.Text = 'Criar a subpasta “' + $nomeOrigem + '” dentro dela'
        $temp = New-Trabalho $v
        $final = Get-DestinoFinal $temp
        if ($final -eq '') {
            $lblFinal.Text = 'Escolha a pasta para onde os arquivos serão copiados (por exemplo, uma pasta do seu Google Drive).'
            $lblFinal.ForeColor = $script:Cores.TextoSuave
        } else {
            $raizDestino = ''
            try { $raizDestino = [IO.Path]::GetPathRoot($final) } catch { }
            if ($raizDestino -and [IO.Directory]::Exists($raizDestino)) {
                $lblFinal.Text = 'Os arquivos ficarão em:  ' + $final
                $lblFinal.ForeColor = $script:Cores.Ok
            } else {
                $lblFinal.Text = 'Os arquivos ficarão em:  ' + $final + "`n(esse local não está acessível agora)"
                $lblFinal.ForeColor = $script:Cores.Aviso
            }
        }
        if (-not $v.ativo) {
            $lblPrevia.Text = 'Backup pausado: nada será copiado até você ligá-lo de novo.'
            return
        }
        if (-not $novo) {
            $temp.ultimaExecucao = $Trabalho.ultimaExecucao
            $temp.aguardarAte = $null
        }
        $proxima = Get-ProximaExecucao $temp
        if ($proxima -le (Get-Date)) { $quando = 'logo depois de salvar' } else { $quando = Format-DataAmigavel $proxima }
        $texto = 'Próximo backup: ' + $quando + '.  Depois: ' + (Format-Frequencia $v.intervaloValor $v.intervaloUnidade).ToLower() + '.'
        if ($v.ignorarExistentes) { $texto += "`nAntes disso, o programa anota os arquivos que já existem para ignorá-los." }
        $lblPrevia.Text = $texto
    }

    $txtNome.Add_KeyPress({ $estado.NomeEditado = $true })
    $txtOrigem.Add_TextChanged({
        if (-not $estado.NomeEditado) {
            $o = Get-CaminhoNormalizado $txtOrigem.Text
            if ($o) { $txtNome.Text = Get-NomePasta $o }
        }
        Update-Previa
    })
    $txtDestino.Add_TextChanged({ Update-Previa })
    $chkSub.Add_CheckedChanged({ Update-Previa })
    $num.Add_ValueChanged({ Update-Previa })
    $cmb.Add_SelectedIndexChanged({ Update-Previa })
    $dtp.Add_ValueChanged({ Update-Previa })
    $chkAtivo.Add_CheckedChanged({ Update-Previa })
    $rbIgnorar.Add_CheckedChanged({ Update-Previa })
    $btnAgoraData.Add_Click({ $dtp.Value = (Get-Date -Second 0 -Millisecond 0) })
    $btnDrive.Add_Click({
        $d = Get-GoogleDrive -Atualizar
        if ($d) { $txtDestino.Text = [IO.Path]::Combine($d, 'Backup Automático'); $chkSub.Checked = $true }
    })
    $btnOrigem.Add_Click({
        $p = Select-Pasta 'Escolha a pasta que você quer proteger com backup:' $txtOrigem.Text $dlg
        if ($p) { $txtOrigem.Text = $p }
    })
    $btnDestino.Add_Click({
        $inicial = $txtDestino.Text
        if (-not [IO.Directory]::Exists($inicial)) { $inicial = Get-GoogleDrive }
        $p = Select-Pasta 'Escolha para onde os arquivos serão copiados (por exemplo, uma pasta do seu Google Drive):' $inicial $dlg
        if ($p) { $txtDestino.Text = $p }
    })
    foreach ($caixa in @($txtOrigem, $txtDestino)) {
        $caixa.Add_DragEnter({
            param($s, $e)
            if ($e.Data.GetDataPresent([System.Windows.Forms.DataFormats]::FileDrop)) { $e.Effect = [System.Windows.Forms.DragDropEffects]::Copy }
        })
        $caixa.Add_DragDrop({
            param($s, $e)
            $itens = @($e.Data.GetData([System.Windows.Forms.DataFormats]::FileDrop))
            if ($itens.Count -gt 0) {
                $p = [string]$itens[0]
                if ([IO.File]::Exists($p) -and -not [IO.Directory]::Exists($p)) { $p = [IO.Path]::GetDirectoryName($p) }
                $s.Text = $p
            }
        })
    }
    $btnSalvar.Add_Click({
        Invoke-Seguro {
            $v = Get-ValoresDialogo
            $temp = New-Trabalho $v
            $problemas = Test-Trabalho $temp
            if ($problemas.Count -gt 0) {
                Show-Mensagem (($problemas -join "`n`n")) 'Warning' $dlg
                return
            }
            $raizDestino = [IO.Path]::GetPathRoot((Get-DestinoFinal $temp))
            if (-not [IO.Directory]::Exists($raizDestino)) {
                $pergunta = "O destino ($raizDestino) não está acessível agora.`n`nSe for o Google Drive, confira se ele está aberto. O backup vai esperar o destino voltar.`n`nSalvar mesmo assim?"
                if (-not (Confirm-Pergunta $pergunta $dlg 'Warning')) { return }
            }
            foreach ($outro in $script:Cfg.trabalhos) {
                if ($outro.id -ne $Trabalho.id -and (Get-DestinoFinal $outro) -eq (Get-DestinoFinal $temp) -and (Get-CaminhoNormalizado $outro.origem) -ne $v.origem) {
                    $pergunta = "O backup `"$($outro.nome)`" já copia outra pasta para este mesmo destino:`n`n$(Get-DestinoFinal $temp)`n`nOs arquivos das duas pastas vão se misturar. Continuar mesmo assim?"
                    if (-not (Confirm-Pergunta $pergunta $dlg 'Warning')) { return }
                }
            }
            $estado.Valores = $v
            $dlg.DialogResult = [System.Windows.Forms.DialogResult]::OK
            $dlg.Close()
        }
    })
    $dlg.Add_Load({
        $tam = $g.PreferredSize
        $dlg.ClientSize = New-Object System.Drawing.Size(($tam.Width + (S 40)), ($tam.Height + (S 32)))
    })
    $dlg.Add_Shown({
        if ($script:ModoCaptura) {
            [System.Windows.Forms.Application]::DoEvents()
            Save-Captura $dlg 'dialogo.png'
            $dlg.Close()
        }
    })

    Update-Previa
    $tam = $g.PreferredSize
    $dlg.ClientSize = New-Object System.Drawing.Size(($tam.Width + (S 40)), ($tam.Height + (S 32)))
    [void]$dlg.ShowDialog((Get-JanelaDona))
    $dlg.Dispose()
    return $estado.Valores
}

# -----------------------------------------------------------------------------
#  Ações
# -----------------------------------------------------------------------------

function New-TrabalhoInterativo([string]$Origem = '') {
    Update-Drive
    $valores = Show-DialogoTrabalho -OrigemInicial $Origem
    if ($null -eq $valores) { return }
    $t = New-Trabalho $valores
    [void]$script:Cfg.trabalhos.Add($t)
    Save-ConfiguracaoSegura
    Update-Lista
    foreach ($item in $Lista.Items) { $item.Selected = ([string]$item.Tag -eq $t.id) }
    $script:AgendarAgora = $true
}

function Edit-Trabalho($t) {
    if ($null -eq $t) { return }
    $valores = Show-DialogoTrabalho -Trabalho $t
    if ($null -eq $valores) { return }
    $origemMudou = (Get-CaminhoNormalizado $t.origem) -ne $valores.origem
    foreach ($k in $valores.Keys) { $t.$k = $valores[$k] }
    if ($origemMudou -or -not $t.ignorarExistentes) {
        $t.baseRegistradaEm = $null
        try { [IO.File]::Delete((Get-ArquivoBase $t.id)) } catch { }
    }
    $t.aguardarAte = $null
    if ($t.ultimoStatus -eq 'indisponivel' -or $t.ultimoStatus -eq 'erro') { $t.ultimoStatus = $null; $t.ultimoResumo = '' }
    Save-ConfiguracaoSegura
    Update-Lista
    $script:AgendarAgora = $true
}

function Remove-Trabalho($t) {
    if ($null -eq $t) { return }
    $texto = "Remover o backup `"$($t.nome)`"?`n`nO programa deixa de copiar esta pasta. Nada é apagado: os arquivos que já estão no backup continuam lá."
    if (-not (Confirm-Pergunta $texto)) { return }
    if (Test-Executando $t) { $script:Execucao.Sync.Cancelar = $true }
    [void]$script:Fila.Remove($t.id)
    [void]$script:Cfg.trabalhos.Remove($t)
    foreach ($arq in @((Get-ArquivoBase $t.id), (Get-ArquivoHistorico $t.id))) { try { [IO.File]::Delete($arq) } catch { } }
    Save-ConfiguracaoSegura
    Update-Lista
}

function Switch-Pausa($t) {
    if ($null -eq $t) { return }
    $t.ativo = -not $t.ativo
    Save-ConfiguracaoSegura
    Update-Lista
    if ($t.ativo) { $script:AgendarAgora = $true }
}

function Start-BackupManual($t) {
    if ($null -eq $t) { return }
    if (Test-Executando $t) {
        if (Confirm-Pergunta "Cancelar o backup de `"$($t.nome)`" que está em andamento?`n`nO que já foi copiado fica no backup; o resto será copiado mais tarde.") {
            $script:Execucao.Sync.Cancelar = $true
            Update-Progresso
        }
        return
    }
    if (-not $script:Fila.Contains($t.id)) { $script:Fila.Add($t.id) }
    $script:AgendaLiberadaEm = Get-Date
    Invoke-Agendador
    Update-Lista
}

function Start-BackupTodos {
    foreach ($t in $script:Cfg.trabalhos) {
        if ($t.ativo -and -not (Test-Executando $t) -and -not $script:Fila.Contains($t.id)) { $script:Fila.Add($t.id) }
    }
    $script:AgendaLiberadaEm = Get-Date
    Invoke-Agendador
    Update-Lista
}

function Open-Historico($t) {
    if ($null -eq $t) { return }
    $arq = Get-ArquivoHistorico $t.id
    if (-not [IO.File]::Exists($arq)) {
        Show-Mensagem "Ainda não há histórico para `"$($t.nome)`". Ele aparece depois do primeiro backup."
        return
    }
    Start-Process -FilePath 'notepad.exe' -ArgumentList ('"' + $arq + '"')
}

function Add-PastaArrastada([string]$Caminho) {
    $c = Get-CaminhoNormalizado $Caminho
    if ($c -eq '') { return }
    if (-not [IO.Directory]::Exists($c)) {
        if ([IO.File]::Exists($c)) {
            Show-Mensagem "`"$([IO.Path]::GetFileName($c))`" é um arquivo.`n`nArraste uma PASTA: o programa faz backup de tudo o que estiver dentro dela." 'Warning'
        } else {
            Show-Mensagem "Não encontrei a pasta:`n`n$c" 'Warning'
        }
        return
    }
    foreach ($t in $script:Cfg.trabalhos) {
        if ((Get-CaminhoNormalizado $t.origem) -eq $c) {
            if (Confirm-Pergunta "Esta pasta já tem backup (`"$($t.nome)`").`n`nQuer abrir as configurações dele?") { Edit-Trabalho $t }
            return
        }
    }
    New-TrabalhoInterativo $c
}

function Read-PastasPendentes {
    # Pastas arrastadas para cima do "Backup Automatico.bat".
    $arq = Get-ArquivoPendentes
    if (-not [IO.File]::Exists($arq)) { return }
    $linhas = @()
    try { $linhas = [IO.File]::ReadAllLines($arq, [Text.Encoding]::UTF8); [IO.File]::Delete($arq) } catch { return }
    foreach ($l in $linhas) {
        if ($l.Trim() -ne '') {
            Show-Janela
            Invoke-Seguro { Add-PastaArrastada $l.Trim() }
        }
    }
}

function Invoke-SoltasPendentes {
    $itens = $script:SoltasPendentes.ToArray()
    $script:SoltasPendentes.Clear()
    foreach ($p in $itens) { Invoke-Seguro { Add-PastaArrastada $p } }
}

function Exit-App {
    if ($null -ne $script:Execucao) {
        $msg = "Há um backup em andamento (`"$($script:Execucao.Nome)`").`n`nSe sair agora ele é interrompido e continua numa próxima vez. Sair mesmo assim?"
    } else {
        $volta = ''
        if ($script:Cfg.iniciarComWindows) { $volta = ' (ou até ligar o computador de novo)' }
        $msg = "Se sair, os backups automáticos ficam parados até você abrir o programa de novo$volta.`n`nSair mesmo assim?"
    }
    if (-not (Confirm-Pergunta $msg)) { return }
    $script:Saindo = $true
    $Timer.Stop()
    if ($null -ne $script:Execucao) {
        $script:Execucao.Sync.Cancelar = $true
        try { [void]$script:Execucao.PS.BeginStop($null, $null) } catch { }
    }
    $IconeBandeja.Visible = $false
    $Janela.Close()
    $script:Contexto.ExitThread()
}

# -----------------------------------------------------------------------------
#  Agenda: escolhe e executa os backups (um por vez, em segundo plano)
# -----------------------------------------------------------------------------

function Start-Tarefa($t, [string]$Tipo, [bool]$Manual = $false) {
    if ($Tipo -eq 'backup' -and $t.ignorarExistentes -and -not [IO.File]::Exists((Get-ArquivoBase $t.id))) {
        $t.baseRegistradaEm = $null
    }
    if ($Tipo -eq 'backup' -and (Test-BaseNecessaria $t)) {
        $Tipo = 'base'
        if ($Manual -and -not $script:Fila.Contains($t.id)) { $script:Fila.Insert(0, $t.id) }
    }
    $sync = [hashtable]::Synchronized(@{ Cancelar = $false; Fase = 'Preparando'; Lidos = 0; Total = 0; Feitos = 0 })
    $parametros = @{
        Origem           = $t.origem
        Destino          = (Get-DestinoFinal $t)
        Modo             = $t.modo
        Nome             = $t.nome
        ArquivoHistorico = (Get-ArquivoHistorico $t.id)
        Sync             = $sync
    }
    if ($t.ignorarExistentes) { $parametros.ArquivoBase = Get-ArquivoBase $t.id }
    if ($Tipo -eq 'base') { $parametros.RegistrarBase = $true }
    $ps = [PowerShell]::Create()
    try {
        [void]$ps.AddScript($script:TextoNucleo)
        [void]$ps.Invoke()
        $ps.Commands.Clear()
        [void]$ps.AddCommand('Invoke-Backup').AddParameters($parametros)
        $handle = $ps.BeginInvoke()
    } catch {
        $ps.Dispose()
        throw
    }
    $script:Execucao = @{
        Id = $t.id; Nome = $t.nome; Tipo = $Tipo; Manual = $Manual
        PS = $ps; Handle = $handle; Sync = $sync; Inicio = (Get-Date)
    }
    Update-Lista
}

function Complete-Tarefa {
    $e = $script:Execucao
    $res = $null
    $msgErro = ''
    try {
        $saida = $e.PS.EndInvoke($e.Handle)
        foreach ($o in $saida) { if ($null -ne $o -and $null -ne $o.PSObject.Properties['Status']) { $res = $o } }
        if ($null -eq $res -and $e.PS.Streams.Error.Count -gt 0) { $msgErro = Get-MensagemErro $e.PS.Streams.Error[0] }
    } catch { $msgErro = Get-MensagemErro $_ }
    try { $e.PS.Dispose() } catch { }
    $script:Execucao = $null
    if ($null -eq $res) {
        if ($msgErro -eq '') { $msgErro = 'O backup terminou de forma inesperada.' }
        Write-LogErro "Backup $($e.Nome): $msgErro"
        $res = [pscustomobject]@{ Status = 'erro'; Mensagem = $msgErro; Copiados = 0; Falhas = 0 }
    }

    $t = Find-Trabalho $e.Id
    if ($null -eq $t) { Update-Lista; return }   # foi removido enquanto rodava
    $agora = Get-Date
    $statusAnterior = $t.ultimoStatus
    switch ([string]$res.Status) {
        'base' {
            $t.baseRegistradaEm = ConvertTo-TextoData $agora
            $t.aguardarAte = $null
            $t.ultimoStatus = 'base'
            $t.ultimoResumo = $res.Mensagem
        }
        'indisponivel' {
            $t.aguardarAte = ConvertTo-TextoData $agora.AddMinutes(10)
            $t.ultimoStatus = 'indisponivel'
            $t.ultimoResumo = 'Aguardando: ' + $res.Mensagem
        }
        'erro' {
            $t.aguardarAte = ConvertTo-TextoData $agora.AddMinutes(30)
            $t.ultimoStatus = 'erro'
            $t.ultimoResumo = $res.Mensagem
        }
        'cancelado' {
            $t.aguardarAte = ConvertTo-TextoData $agora.AddHours(2)
            $t.ultimoStatus = 'cancelado'
            $t.ultimoResumo = $res.Mensagem + ' Tenta de novo ' + (Format-DataAmigavel $agora.AddHours(2)) + '.'
        }
        default {
            $t.ultimaExecucao = ConvertTo-TextoData $e.Inicio
            $t.aguardarAte = $null
            $t.ultimoStatus = [string]$res.Status
            $t.ultimoResumo = $res.Mensagem
            $t.ultimosCopiados = [long]$res.Copiados
            $t.totalCopiados = [long]$t.totalCopiados + [long]$res.Copiados
        }
    }
    if ($e.Tipo -eq 'base' -and $res.Status -ne 'base') { [void]$script:Fila.Remove($t.id) }
    Save-ConfiguracaoSegura

    $titulo = '“' + $t.nome + '”'
    switch ([string]$res.Status) {
        'erro' { if ($statusAnterior -ne 'erro' -or $e.Manual) { Show-Notificacao "Problema no backup $titulo" $res.Mensagem 'Error' } }
        'parcial' { Show-Notificacao "Backup $titulo com avisos" $res.Mensagem 'Warning' }
        'indisponivel' { if ($e.Manual -or $statusAnterior -ne 'indisponivel') { Show-Notificacao "Backup $titulo adiado" $res.Mensagem 'Warning' } }
        'ok' { if ($res.Copiados -gt 0 -or $e.Manual) { Show-Notificacao "Backup $titulo concluído" $res.Mensagem 'Info' } }
    }
    Update-Lista
}

function Invoke-Agendador {
    if ($null -ne $script:Execucao) { return }
    $agora = Get-Date
    if ($agora -lt $script:AgendaLiberadaEm) { return }
    # 1) Backups que precisam registrar o "ponto de partida".
    foreach ($t in $script:Cfg.trabalhos) {
        if (Test-BaseNecessaria $t) {
            $aguardar = ConvertFrom-TextoData $t.aguardarAte
            if ($null -eq $aguardar -or $aguardar -le $agora -or $script:Fila.Contains($t.id)) { Start-Tarefa $t 'base'; return }
        }
    }
    # 2) Pedidos de "Fazer backup agora".
    while ($script:Fila.Count -gt 0) {
        $id = $script:Fila[0]
        $script:Fila.RemoveAt(0)
        $t = Find-Trabalho $id
        if ($null -ne $t) { Start-Tarefa $t 'backup' $true; return }
    }
    # 3) O backup agendado mais atrasado.
    $escolhido = $null
    $menor = $null
    foreach ($t in $script:Cfg.trabalhos) {
        if (Test-BaseNecessaria $t) { continue }
        if (Test-BackupVencido $t $agora) {
            $p = Get-ProximaExecucao $t
            if ($null -eq $menor -or $p -lt $menor) { $menor = $p; $escolhido = $t }
        }
    }
    if ($null -ne $escolhido) { Start-Tarefa $escolhido 'backup' }
}

function Invoke-Ciclo {
    # Roda a cada segundo.
    $script:Tiques++
    if ($null -ne $script:EventoMostrar -and $script:EventoMostrar.WaitOne(0)) {
        Show-Janela
        Read-PastasPendentes
    }
    if ($null -ne $script:Execucao) {
        if ($script:Execucao.Handle.IsCompleted) { Complete-Tarefa } elseif ($Janela.Visible) { Update-Progresso }
    }
    if ($script:AgendarAgora -or ($script:Tiques % 5) -eq 0) {
        $script:AgendarAgora = $false
        Invoke-Agendador
    }
    if (($script:Tiques % 30) -eq 0 -and $Janela.Visible) { Update-Lista }
}

# -----------------------------------------------------------------------------
#  Eventos
# -----------------------------------------------------------------------------

function Get-TodosControles($Controle) {
    $Controle
    foreach ($filho in $Controle.Controls) { Get-TodosControles $filho }
}

foreach ($alvo in @(Get-TodosControles $Janela)) {
    $alvo.AllowDrop = $true
    $alvo.Add_DragEnter({
        param($s, $e)
        if ($e.Data.GetDataPresent([System.Windows.Forms.DataFormats]::FileDrop)) {
            $e.Effect = [System.Windows.Forms.DragDropEffects]::Copy
            Set-RealceSoltar $true
        } else {
            $e.Effect = [System.Windows.Forms.DragDropEffects]::None
        }
    })
    $alvo.Add_DragLeave({ Set-RealceSoltar $false })
    $alvo.Add_DragDrop({
        param($s, $e)
        Set-RealceSoltar $false
        foreach ($p in @($e.Data.GetData([System.Windows.Forms.DataFormats]::FileDrop))) { $script:SoltasPendentes.Add([string]$p) }
        # Abre a janela de configuração só depois que o Windows terminar o "soltar"
        # (senão o Explorador de Arquivos fica travado esperando).
        [void]$Janela.BeginInvoke([System.Windows.Forms.MethodInvoker]{ Invoke-SoltasPendentes })
    })
}

$BtnAdicionar.Add_Click({
    Invoke-Seguro {
        $p = Select-Pasta 'Escolha a pasta que você quer proteger com backup:' '' $Janela
        if ($p) { Add-PastaArrastada $p }
    }
})
$BtnAgora.Add_Click({ Invoke-Seguro { Start-BackupManual (Get-TrabalhoSelecionado) } })
$BtnEditar.Add_Click({ Invoke-Seguro { Edit-Trabalho (Get-TrabalhoSelecionado) } })
$BtnPausar.Add_Click({ Invoke-Seguro { Switch-Pausa (Get-TrabalhoSelecionado) } })
$BtnAbrirDestino.Add_Click({ Invoke-Seguro { $t = Get-TrabalhoSelecionado; if ($t) { Open-Pasta (Get-DestinoFinal $t) } } })
$BtnHistorico.Add_Click({ Invoke-Seguro { Open-Historico (Get-TrabalhoSelecionado) } })
$BtnRemover.Add_Click({ Invoke-Seguro { Remove-Trabalho (Get-TrabalhoSelecionado) } })

$MiAgora.Add_Click({ Invoke-Seguro { Start-BackupManual (Get-TrabalhoSelecionado) } })
$MiEditar.Add_Click({ Invoke-Seguro { Edit-Trabalho (Get-TrabalhoSelecionado) } })
$MiPausar.Add_Click({ Invoke-Seguro { Switch-Pausa (Get-TrabalhoSelecionado) } })
$MiAbrirOrigem.Add_Click({ Invoke-Seguro { $t = Get-TrabalhoSelecionado; if ($t) { Open-Pasta $t.origem } } })
$MiAbrirDestino.Add_Click({ Invoke-Seguro { $t = Get-TrabalhoSelecionado; if ($t) { Open-Pasta (Get-DestinoFinal $t) } } })
$MiHistorico.Add_Click({ Invoke-Seguro { Open-Historico (Get-TrabalhoSelecionado) } })
$MiRemover.Add_Click({ Invoke-Seguro { Remove-Trabalho (Get-TrabalhoSelecionado) } })
$MenuLista.Add_Opening({ param($s, $e) if ($null -eq (Get-TrabalhoSelecionado)) { $e.Cancel = $true } })

$Lista.Add_SelectedIndexChanged({ Update-Botoes })
$Lista.Add_DoubleClick({ Invoke-Seguro { Edit-Trabalho (Get-TrabalhoSelecionado) } })
$Lista.Add_KeyDown({
    param($s, $e)
    if ($e.KeyCode -eq [System.Windows.Forms.Keys]::Delete) { Invoke-Seguro { Remove-Trabalho (Get-TrabalhoSelecionado) } }
    elseif ($e.KeyCode -eq [System.Windows.Forms.Keys]::Enter) { Invoke-Seguro { Edit-Trabalho (Get-TrabalhoSelecionado) } }
})
$Lista.Add_Resize({ Update-LarguraColunas })
$Vazio.Add_DoubleClick({ Invoke-Seguro { $p = Select-Pasta 'Escolha a pasta que você quer proteger com backup:' '' $Janela; if ($p) { Add-PastaArrastada $p } } })

$ChkIniciar.Add_CheckedChanged({
    Invoke-Seguro {
        $script:Cfg.iniciarComWindows = $ChkIniciar.Checked
        Set-IniciarComWindows $ChkIniciar.Checked ([IO.Path]::Combine($script:PastaApp, 'Iniciar.ps1'))
        Save-ConfiguracaoSegura
        Update-Status
    }
})
$ChkAvisos.Add_CheckedChanged({ $script:Cfg.notificacoes = $ChkAvisos.Checked; Save-ConfiguracaoSegura })

$IconeBandeja.Add_MouseClick({ param($s, $e) if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) { Show-Janela } })
$IconeBandeja.Add_BalloonTipClicked({ Show-Janela })
$MbAbrir.Add_Click({ Show-Janela })
$MbTodos.Add_Click({ Invoke-Seguro { Start-BackupTodos } })
$MbSair.Add_Click({ Invoke-Seguro { Exit-App } })

$Janela.Add_FormClosing({
    param($s, $e)
    if (-not $script:Saindo -and $e.CloseReason -eq [System.Windows.Forms.CloseReason]::UserClosing) {
        # Fechar no "X" só esconde: o programa continua cuidando dos backups.
        $e.Cancel = $true
        $Janela.Hide()
        if (-not $script:AvisoBandejaMostrado) {
            $script:AvisoBandejaMostrado = $true
            $antes = $script:Cfg.notificacoes
            $script:Cfg.notificacoes = $true
            Show-Notificacao 'O Backup Automático continua ligado' 'Ele fica aqui, perto do relógio, e faz os backups na hora certa. Clique no ícone para abrir o painel.'
            $script:Cfg.notificacoes = $antes
        }
    }
})
$Janela.Add_Shown({ Update-LarguraColunas })

$script:Timer = New-Object System.Windows.Forms.Timer
$Timer.Interval = 1000
$Timer.Add_Tick({
    try { Invoke-Ciclo }
    catch { Write-LogErro ('Ciclo: ' + $_.Exception.ToString()) }
})

# -----------------------------------------------------------------------------
#  Modo de teste: gera imagens das telas e testa um backup de verdade
# -----------------------------------------------------------------------------

function Save-Captura($Form, [string]$Arquivo) {
    if (-not $script:ModoCaptura) { return }
    $caminho = [IO.Path]::Combine($CapturarTelas, $Arquivo)
    $bmp = New-Object System.Drawing.Bitmap($Form.Width, $Form.Height)
    try {
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CopyFromScreen($Form.Location, [System.Drawing.Point]::Empty, $Form.Size)
        $g.Dispose()
    } catch {
        $Form.DrawToBitmap($bmp, (New-Object System.Drawing.Rectangle(0, 0, $Form.Width, $Form.Height)))
    }
    $bmp.Save($caminho, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Imagem salva: $caminho"
}

function Wait-Tela([int]$Milissegundos) {
    $fim = (Get-Date).AddMilliseconds($Milissegundos)
    while ((Get-Date) -lt $fim) { [System.Windows.Forms.Application]::DoEvents(); Start-Sleep -Milliseconds 50 }
}

if ($script:ModoCaptura) {
    $codigo = 0
    try {
        [void][IO.Directory]::CreateDirectory($CapturarTelas)
        Update-Drive
        Update-Lista
        $Janela.Show()
        Wait-Tela 800
        Save-Captura $Janela 'painel.png'
        if ($script:Cfg.trabalhos.Count -gt 0) {
            $Lista.Items[0].Selected = $true
            Start-BackupManual $script:Cfg.trabalhos[0]
            $limite = (Get-Date).AddSeconds(60)
            while ($null -ne $script:Execucao -and (Get-Date) -lt $limite) {
                Invoke-Ciclo
                Wait-Tela 300
            }
            if ($null -ne $script:Execucao) { throw 'O backup de teste não terminou em 60 segundos.' }
            Update-Lista
            Wait-Tela 500
            Save-Captura $Janela 'painel-depois-do-backup.png'
            $t = $script:Cfg.trabalhos[0]
            Write-Host "Resultado do backup de teste: [$($t.ultimoStatus)] $($t.ultimoResumo)"
            if (@('ok', 'parcial', 'base') -notcontains $t.ultimoStatus) { $codigo = 1 }
        }
        [void](Show-DialogoTrabalho -OrigemInicial $env:TEMP)
        Write-Host 'Telas geradas com sucesso.'
    } catch {
        Write-Host ('ERRO: ' + $_.Exception.ToString())
        $codigo = 1
    }
    $IconeBandeja.Dispose()
    [Environment]::Exit($codigo)
}

# -----------------------------------------------------------------------------
#  Início
# -----------------------------------------------------------------------------

if ([IO.Path]::DirectorySeparatorChar -eq '\') {
    # Atualiza o "iniciar com o Windows" (caso a pasta do programa tenha mudado de lugar).
    try { Set-IniciarComWindows ([bool]$script:Cfg.iniciarComWindows) ([IO.Path]::Combine($script:PastaApp, 'Iniciar.ps1')) }
    catch { Write-LogErro "Iniciar com o Windows: $(Get-MensagemErro $_)" }
}
if (-not [IO.File]::Exists([IO.Path]::Combine((Get-PastaDados), 'config.json'))) { Save-ConfiguracaoSegura }

Update-Drive
Update-Lista
$script:Contexto = New-Object System.Windows.Forms.ApplicationContext
if (-not $Bandeja) {
    $Janela.Show()
    $Janela.Activate()
}
$Timer.Start()
Read-PastasPendentes
[System.Windows.Forms.Application]::Run($script:Contexto)

# Encerramento
try { $IconeBandeja.Dispose() } catch { }
try { if ($null -ne $script:Mutex) { $script:Mutex.ReleaseMutex(); $script:Mutex.Dispose() } } catch { }
[Environment]::Exit(0)
