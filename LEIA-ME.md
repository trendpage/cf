# Guia CFTV Prático: site blog + checkout (Netlify + MedusaPay)

## Estrutura

```
index.html                     fachada (home)
blog/index.html                blog no formato Edoc (mais buscados + guias rápidos)
blog/*.html                    8 artigos com CTAs
checkout.html                  3 perguntas → oferta com extras → dados → PIX
acesso.html                    entrega: libera os PDFs só com pagamento confirmado
assets/config.js               e-mail, WhatsApp, razão social/CNPJ (só nas páginas legais) e Google Ads
lib/catalog.js                 PRODUTO, EXTRAS, PREÇOS E ARQUIVOS DE ENTREGA
lib/medusa.js                  integração MedusaPay
netlify/functions/*.mjs        APIs: create-pix, check-status, recovery, access, webhook
netlify.toml                   configuração da Netlify
materiais/                     PDFs de entrega (já comprimidos, todos abaixo de 25 MB)
```

## Variáveis de ambiente na Netlify (Site configuration → Environment variables)

| Variável | Obrigatória | Valor |
|---|---|---|
| MEDUSAPAY_API_KEY | sim | chave `mk_live_...` |
| MEDUSAPAY_BASE_URL | não | `https://api.medusapayoficial.pro/api/v1` |
| ACCESS_SECRET | sim | texto longo e aleatório (protege o link de acesso) |
| SITE_URL | não | se vazio, usa o endereço do próprio site na Netlify |
| QSTASH_TOKEN, QSTASH_URL | para SMS | mesmas do Upstash |
| RECOVERY_SECRET | recomendado | texto aleatório |
| RECOVERY_DELAY | não | padrão `90s` |
| INTEGRAX_AUTOMATION_URL | para SMS | URL da automação |
| DELIVERY_SMS | não | `on` envia `pix_paid` com o link de acesso para quem pagou |

Depois de salvar as variáveis: Deploys → Trigger deploy → Deploy site.

## Antes de subir campanha

1. Conferir `lib/medusa.js` (endpoint, campos enviados e resposta) com o create-pix do site oficial.
2. Preencher `assets/config.js`.
3. Fazer uma compra real de teste: PIX gera, redireciona para o acesso, os PDFs abrem.

## Leitura dos resultados

Cada PIX gerado grava uma linha `[venda]` nos logs da função create-pix (Netlify → Logs → Functions) com valor, itens, respostas do quiz, artigo e campanha.
