# Segurança do Atlas Concursos

## Como reportar uma falha
Encontrou uma vulnerabilidade? **Não abra uma issue pública.** Use o botão
"Report a vulnerability" na aba *Security* do repositório (ou o e-mail de contato
configurado no site). Respondemos em até 7 dias.

## Como o site se protege
| Camada | Proteção |
|---|---|
| Arquitetura | Site estático: não há servidor, banco de dados nem senhas de usuários para serem roubados. |
| Dados dos usuários | Ficam no navegador de cada pessoa. Na sincronização opcional (Firebase), cada conta só lê e grava o próprio documento (regras no README). |
| Injeção de código (XSS) | Todo texto é escapado antes de ir para a tela; links aceitam apenas `http(s)` (bloqueia `javascript:`); backups importados são higienizados. |
| Política de conteúdo (CSP) | Só scripts do próprio site e dos serviços autorizados (Google Fonts, AdSense, Firebase). Bloqueia plugins, `<base>` e formulários externos. |
| Clickjacking | `X-Frame-Options: DENY` / `frame-ancestors 'none'` (Cloudflare/Netlify) e bloqueio em JavaScript no domínio oficial. |
| Transporte | HTTPS obrigatório, HSTS e `upgrade-insecure-requests`. |
| Privacidade | `Referrer-Policy` restrita, `Permissions-Policy` desliga câmera, microfone, localização e pagamento. |
| Painel administrador | Não tem senha guardada no site: cada alteração é autenticada pelo GitHub com um token pessoal de escopo mínimo, mantido só na sessão do navegador. A página não é indexada. |
| Cadeia de dependências | Sem npm em produção; a única biblioteca externa (QR Code, MIT) está versionada no repositório. Dependabot acompanha as GitHub Actions. |
| Monitoramento | Verificação semanal dos links e Radar diário de editais pelo GitHub Actions. |

## Checklist do responsável
- [ ] Autenticação em dois fatores (2FA) no GitHub, Google, Registro.br e gov.br.
- [ ] Token do painel: *fine-grained*, só este repositório, permissão **Contents: Read and write**, validade de no máximo 90 dias.
- [ ] Ativar em *Settings → Code security*: **Secret scanning**, **Push protection** e **Dependabot alerts**.
- [ ] Proteger a branch `main` (*Settings → Branches*): exigir PR para mudanças de código.
- [ ] Domínio com bloqueio de transferência no Registro.br.
