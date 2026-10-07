# Backup Automático

Programinha para Windows 10/11 que copia, de tempos em tempos, **os arquivos novos** de uma pasta
para outra pasta, por exemplo uma pasta do seu **Google Drive**. Você arrasta a pasta, escolhe a
frequência (minutos, horas, dias, semanas, meses ou anos) e ele cuida do resto sozinho.

- Não precisa instalar nada: usa o PowerShell, que já vem no Windows.
- Copia **só o que é novo**. O que já está no backup não é copiado de novo.
- **Nunca apaga nada** do backup, nem quando você apaga o arquivo da pasta original.
- Fica num ícone perto do relógio e abre sozinho quando o Windows liga.
- Dá para ter vários backups (várias pastas), cada um com a sua frequência.

---

## 1. Como começar

1. Baixe a pasta `backup-automatico` e coloque num lugar fixo, por exemplo `Documentos\backup-automatico`.
   (Se veio num `.zip`: clique com o botão direito no `.zip` > **Propriedades** > marque **Desbloquear** > **OK**, e só depois extraia.)
2. Dê dois cliques em **`Backup Automatico.bat`**.
   - Se aparecer o aviso azul "O Windows protegeu o seu computador", clique em **Mais informações** > **Executar assim mesmo**.
     Isso acontece com qualquer programa baixado da internet que não seja de uma empresa conhecida.
3. O painel abre. Pronto para usar.

> Deixe o **Google Drive para computador** aberto e conectado. O programa encontra sozinho a pasta
> `Meu Drive` (normalmente `G:\Meu Drive`).

## 2. Como criar um backup (vincular uma pasta)

1. Abra o **Explorador de Arquivos**, pegue a pasta que você quer proteger e **arraste para dentro do painel**.
   (Também funciona clicando em **+ Adicionar pasta**, ou arrastando a pasta para cima do arquivo `Backup Automatico.bat`.)
2. Na janela que abre, confira:
   - **Copiar a pasta**: a pasta que você arrastou.
   - **Para a pasta**: para onde copiar. O botão **Usar meu Google Drive** já preenche
     `G:\Meu Drive\Backup Automático`. Você também pode arrastar qualquer pasta do Google Drive para esse campo.
     Com "Criar a subpasta..." marcado, cada backup fica numa subpasta com o nome da pasta original.
   - **Frequência**: por exemplo "A cada **1 semanas**", "A cada **12 horas**", "A cada **1 meses**", "A cada **1 anos**".
   - **Começar em**: dia e hora do primeiro backup. Os seguintes seguem a frequência.
     Exemplo: começando numa sexta às 18:00, "a cada 1 semana" = **toda sexta às 18:00**.
   - **O que copiar**:
     - *Só arquivos novos* (recomendado): copia o que ainda não está no backup.
     - *Novos e também os modificados*: além dos novos, atualiza no backup os arquivos que você alterou.
   - **Arquivos que já existem**:
     - *Copiar também*: o primeiro backup leva tudo o que já existe na pasta. Depois, só os novos.
     - *Ignorar*: o programa anota o que já existe hoje e, daqui pra frente, copia **somente o que for adicionado**.
3. Clique em **Salvar**.

## 3. O dia a dia

| Quero... | Faço assim |
|---|---|
| Fazer o backup agora, sem esperar | Selecione o backup e clique em **Fazer backup agora** |
| Parar por um tempo | **Pausar** (depois, **Retomar**) |
| Mudar frequência, pasta, horário | **Editar** (ou dois cliques no backup) |
| Desvincular uma pasta | **Remover**. Os arquivos que já estão no backup **não** são apagados |
| Ver o que foi copiado | **Ver histórico** (lista cada arquivo copiado em cada backup) |
| Abrir a pasta do backup | **Abrir backup** |
| Fechar o painel | Clique no **X**: ele só esconde. Os backups continuam acontecendo |
| Abrir de novo | Clique no ícone azul perto do relógio (pode estar na setinha **^**) |
| Desligar o programa de vez | Botão direito no ícone azul > **Sair do Backup Automático** |

A coluna **Situação** mostra:

- **Ativo**: tudo certo, esperando o próximo horário.
- **Executando** / **Na fila**: copiando agora / vai copiar em seguida.
- **Aguardando**: a pasta de origem ou o Google Drive não estava disponível. Ele tenta de novo a cada 10 minutos.
- **Atenção**: alguns arquivos não puderam ser copiados (por exemplo, estavam abertos). Eles vão no próximo backup.
- **Erro**: veja a mensagem na coluna "Último backup". Ele tenta de novo em 30 minutos.
- **Pausado**: não copia até você clicar em **Retomar**.

## 4. Perguntas comuns

**O computador estava desligado na hora do backup. E agora?**
Assim que o computador ligar, o backup atrasado é feito (cerca de 1 minuto e meio depois de entrar no
Windows, para dar tempo do Google Drive conectar). Os seguintes voltam ao dia e horário de sempre.

**Preciso deixar o painel aberto?**
Não precisa deixar a janela aberta, mas o programa precisa estar rodando (o ícone azul perto do relógio).
Com **Iniciar junto com o Windows** marcado (vem marcado), ele abre sozinho, escondido, toda vez que você liga o computador.

**O Google Drive não faz isso sozinho?**
O Google Drive para computador consegue *sincronizar* pastas do computador, mas sincronização é
espelho: se você apaga um arquivo no computador, ele some do Drive também (vai para a lixeira), e não dá
para escolher "uma vez por semana". Este programa faz **cópias de segurança**: copia na frequência que
você escolher e nunca apaga nada do backup.

**Quais arquivos são ignorados?**
Arquivos temporários que não servem para nada no backup: `desktop.ini`, `Thumbs.db`, arquivos `~$...`
do Office (que existem só enquanto o documento está aberto), arquivos `.tmp` e as pastas temporárias do Google Drive.

**Um backup pode copiar arquivo pela metade?**
Não. Cada arquivo é copiado primeiro com um nome provisório e só ganha o nome certo quando termina.
Se o computador desligar no meio, o resto provisório é limpo no próximo backup.

**Posso mover a pasta do programa?**
Pode. Depois de mover, abra uma vez pelo `Backup Automatico.bat` para ele atualizar o "iniciar com o Windows".

**Onde ficam as configurações e o histórico?**
Em `%LOCALAPPDATA%\BackupAutomatico` (cole isso na barra de endereço do Explorador de Arquivos).
O arquivo `config.json` guarda os backups; a pasta `historico` guarda o registro de cada um.

**Como desinstalar?**
Botão direito no ícone azul > **Sair**. Depois apague a pasta do programa e a pasta
`%LOCALAPPDATA%\BackupAutomatico`. Para tirar do início do Windows antes de apagar, desmarque
**Iniciar junto com o Windows** no painel.

## 5. Para quem é curioso (detalhes técnicos)

- `Backup Automatico.bat`: atalho que abre o programa (`app\Iniciar.ps1`).
- `app\Iniciar.ps1`: abre o painel sem janela preta; se ele já estiver aberto, só traz para a frente.
- `app\Painel.ps1`: a janela, o ícone perto do relógio e a agenda (confere a cada 5 segundos o que está na hora).
- `app\Nucleo.ps1`: configuração, cálculo da agenda e o motor de cópia (roda em segundo plano, um backup por vez).
- `testes\Testar.ps1`: testes automáticos do núcleo:
  `powershell -NoProfile -ExecutionPolicy Bypass -File testes\Testar.ps1`

O backup compara a pasta de origem com a pasta de destino pelo caminho de cada arquivo: o que não
existe no destino é copiado (e, no modo "modificados", também o que mudou de tamanho ou de data).
Funciona com caminhos longos (mais de 260 caracteres), acentos e pastas de rede.
