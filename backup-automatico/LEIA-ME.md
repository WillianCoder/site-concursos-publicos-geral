# Backup Automático

Programa para Windows 10/11 que faz **backups automáticos de qualquer pasta, para qualquer lugar**:
outro disco, pendrive, HD externo, pasta da rede ou nuvem (Google Drive, OneDrive, Dropbox...).

- **Um único arquivo:** `BackupAutomatico.exe`. Não precisa instalar mais nada.
- **Só o que é novo:** copia os arquivos que ainda não estão no backup. Nada é copiado duas vezes.
- **Nunca apaga nada do backup**, nem quando você apaga o arquivo da pasta original.
- **Quando você quiser:** a cada N minutos, horas, dias, semanas, meses ou anos (ex.: toda sexta às 18:00).
- **Tema claro, escuro ou automático** (segue o Windows).
- **Fica perto do relógio** com um ícone que gira enquanto copia, e abre sozinho com o Windows.
- **Planos:** grátis (sem conta), **Pro** (com conta, pago via Pix) e o **modo administrador** (você).

---

## 1. Para quem usa

1. Dê dois cliques em **BackupAutomatico.exe**.
   - Se aparecer o aviso azul "O Windows protegeu o seu computador", clique em **Mais informações → Executar assim mesmo**.
2. Na primeira vez, escolha **Instalar (recomendado)**. Isso coloca o programa na sua pasta de programas, cria atalhos e faz ele abrir com o Windows. Não pede senha de administrador.
3. **Arraste uma pasta** para a janela (ou clique em **Adicionar pasta**).
4. Escolha para onde copiar (há atalhos para Google Drive, OneDrive, pendrives e discos), a frequência e o horário. Clique em **Salvar**.

Pronto: o primeiro backup começa na hora e os próximos acontecem sozinhos.

### Botões de cada backup

| Botão | O que faz |
|---|---|
| **Fazer backup agora** | Copia agora, sem esperar o horário (vira **Cancelar** enquanto copia) |
| ⏸ | Pausa ou retoma este backup |
| ✎ | Edita a pasta, o destino, a frequência... |
| ⋯ | Abrir a pasta de origem, abrir o backup, ver o histórico ou **remover** (os arquivos que já estão no backup ficam lá) |

Fechar a janela no **X** só esconde o programa: ele continua cuidando dos backups perto do relógio.
Para fechar de vez: botão direito no ícone → **Sair**.

### Grátis × Pro

| | Grátis | Pro |
|---|---|---|
| Backups automáticos de verdade | ✓ | ✓ |
| Quantidade de pastas | limite definido pelo administrador (padrão: 2) | ilimitadas |
| Copiar também arquivos modificados | | ✓ |
| Copiar só o que for adicionado daqui pra frente | | ✓ |
| Ignorar arquivos/pastas por nome (ex.: `*.tmp`, `Cache`) | | ✓ |
| Backups a cada poucos minutos | | ✓ |

Para assinar o Pro: **Seja Pro → entre (ou crie sua conta) → escolha o plano → pague o Pix (QR Code ou copia e cola) → "Já paguei"**.
Assim que o pagamento é confirmado pelo administrador, o Pro aparece na conta (botão **Ver se já foi liberado**).

Quem quiser só apoiar o projeto pode usar o botão **Apoiar** (♥), que mostra um Pix de doação.

---

## 2. Para você (administrador)

O programa usa as **mesmas contas do site** (Firebase), configuradas no **Painel do Administrador do site** (`admin.html`).

### Ligar as contas (uma vez)

1. No painel do site, aba **Avançado**, siga o passo a passo **"Ativar as contas (Firebase)"**:
   crie o projeto no Firebase, ative login por e-mail/senha, crie o banco Firestore e preencha o **e-mail do administrador**.
2. **Publique as regras do Firestore** que o painel mostra. Elas já incluem as regras do Backup Automático,
   e são elas que garantem que **só a sua conta** altera o Pix, os preços e as licenças.
3. Clique em **Salvar e publicar**. O programa lê essa configuração do site sozinho, sem precisar de um .exe novo.

### Entrar como administrador

No programa: **Entrar → use o e-mail de administrador** (o mesmo do site, com o e-mail confirmado).
Aparece a etiqueta **Administrador** e o botão **Administrador** no topo. Você tem acesso a tudo, sem limites.

No **Painel do administrador**:

- **Pix e preços:** chave Pix, nome, cidade, valores de doação, mensagem, limite de pastas grátis,
  até 3 planos Pro (nome, valor e meses; 0 meses = vitalício) e contato. **Salvar e publicar** vale na hora para todos os programas.
- **Pedidos:** quem clicou em "Já paguei". **Confira o Pix no app do banco** (o código do pedido vem na descrição) e clique em **Liberar Pro** ou **Recusar**.
- **Licenças:** quem tem Pro, até quando, e os botões **+1 mês**, **+1 ano**, **Vitalícia** e **Revogar**.

### Segurança: o que protege o quê

- **O seu Pix, os preços e as licenças ficam no servidor (Firestore)**, não dentro do programa.
  As regras do servidor só aceitam alterações da conta de administrador com e-mail confirmado.
  Mesmo que alguém abra o .exe por dentro, não consegue mudar o seu Pix nem se dar o Pro no servidor.
- **O programa não guarda nenhuma senha ou chave secreta.** A "apiKey" do Firebase não é segredo: ela só identifica o projeto.
- A sessão de cada pessoa fica salva **criptografada pelo Windows** (só aquele usuário daquele computador consegue ler).
- Nenhum programa instalado no computador de outra pessoa é 100% impossível de modificar.
  Alguém muito experiente poderia alterar a **própria cópia** para destravar recursos Pro só na máquina dele.
  Isso **não afeta** o seu Pix, os preços, os pedidos nem as licenças dos outros, que continuam protegidos no servidor.
- O código-fonte está no repositório do GitHub. Se preferir que ninguém veja o código, o caminho é movê-lo para um **repositório privado**.

---

## 3. Perguntas comuns

**O computador estava desligado na hora do backup. E agora?**
Assim que ligar, o backup atrasado acontece (cerca de 1 minuto e meio depois de entrar no Windows). Os seguintes voltam ao dia e horário de sempre.

**O destino estava desconectado (pendrive, HD externo, rede).**
O backup fica "Aguardando" e tenta de novo a cada 10 minutos, até o destino voltar.

**Um arquivo estava aberto e não foi copiado.**
Ele vai no próximo backup. O cartão mostra "Atenção" e o histórico lista o arquivo.

**Quais arquivos são ignorados?**
Temporários que não servem para nada no backup: `desktop.ini`, `Thumbs.db`, `~$...` do Office, `*.tmp` e as pastas temporárias do Google Drive.

**Um backup pode copiar arquivo pela metade?**
Não. Cada arquivo é copiado com nome provisório e só ganha o nome certo quando termina.

**Eu usava a versão anterior (scripts).**
É só abrir o `BackupAutomatico.exe`: ele lê as mesmas configurações e o histórico, fecha a versão antiga e assume o lugar dela no início do Windows.

**Onde ficam as configurações?**
Em `%LOCALAPPDATA%\BackupAutomatico` (Configurações → Abrir a pasta).

**Como desinstalar?**
Configurações → **Desinstalar**, ou pelo Windows: Configurações → Aplicativos → Backup Automático.

---

## 4. Para desenvolvedores

- `src/`: o programa (C#, .NET Framework 4.8, Windows Forms). `src/Nucleo` tem a lógica sem tela (cópia, agenda, contas, Pix, QR Code); `src/Interface` tem as janelas.
- `testes-cs/`: testes do núcleo (`dotnet run -c Release --project testes-cs`).
- `ferramentas/gerar_icones.py`: gera os ícones (`python3 ferramentas/gerar_icones.py src/Recursos`).
- Compilar: `dotnet build -c Release src` (funciona no Windows e no Linux) → `src/bin/Release/BackupAutomatico.exe`.
- O GitHub Actions (`.github/workflows/backup-automatico.yml`) roda os testes no Windows, compila o .exe, abre o programa em modo de teste, faz um backup de verdade e guarda imagens das telas.
