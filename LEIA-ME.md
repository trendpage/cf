# Guia CFTV Prático: site blog + checkout (MedusaPay)

## Estrutura

```
index.html                 fachada (home)
blog/index.html            lista de artigos
blog/*.html                8 artigos com CTAs (carreira, orçamento, instalação/diagnóstico)
checkout.html              3 perguntas → oferta com extras → dados → PIX
acesso.html                página de entrega (libera os PDFs só com pagamento confirmado)
assets/config.js           EMPRESA, CNPJ, CONTATO E GOOGLE ADS: único arquivo a editar
assets/style.css, blog.js  visual e preços dos CTAs
api/create-pix.js          GET catálogo e preços / POST gera o PIX
api/check-status/[id].js   polling do pagamento
api/recovery.js            SMS de recuperação (QStash → Integrax)
api/access.js              valida o link de acesso e o pagamento
api/webhook.js             postback da MedusaPay (opcional)
api/_lib/catalog.js        PRODUTOS, PREÇOS E ARQUIVOS DE ENTREGA
api/_lib/medusa.js         integração MedusaPay
materiais/                 PDFs de entrega (ver LEIA-ME.txt dentro da pasta)
termos-de-uso / politica-privacidade         páginas legais do blog e checkout
termos-uso / privacidade-termo               páginas legais da fachada
```

## Variáveis de ambiente na Vercel

| Variável | Obrigatória | Valor |
|---|---|---|
| MEDUSAPAY_API_KEY | sim | chave `mk_live_...` |
| MEDUSAPAY_BASE_URL | não | `https://api.medusapayoficial.pro/api/v1` |
| ACCESS_SECRET | sim | qualquer texto longo e aleatório (protege o link de acesso) |
| SITE_URL | sim | endereço do site, sem barra no final |
| QSTASH_TOKEN, QSTASH_URL | para SMS | mesmas do Upstash que você já usa |
| RECOVERY_SECRET | recomendado | texto aleatório |
| RECOVERY_DELAY | não | padrão `90s` |
| INTEGRAX_AUTOMATION_URL | para SMS | mesma Shared Variable |
| DELIVERY_SMS | não | `on` envia evento `pix_paid` com o link de acesso para quem pagou |

Depois de mudar variáveis: Redeploy.

## Antes de subir campanha

1. Comparar `api/_lib/medusa.js` (endpoint, campos do corpo e da resposta) com o create-pix do site que já roda na MedusaPay.
2. Preencher `assets/config.js` (razão social, CNPJ, e-mail, ID e label de conversão do Google Ads).
3. Trocar `https://SEU-PROJETO.vercel.app` em `sitemap.xml`, `robots.txt` e nas tags canonical pelo endereço real.
4. Subir os PDFs em `materiais/` com os nomes do LEIA-ME da pasta, e conferir se os textos dos extras em `api/_lib/catalog.js` batem com o que os PDFs entregam.
5. Fazer uma compra real de teste e conferir: PIX gera, a página redireciona para o acesso, os arquivos abrem.

## Leitura dos resultados

Cada PIX gerado grava nos logs da Vercel uma linha `[venda]` com valor, itens, respostas do quiz, artigo de origem e campanha.
