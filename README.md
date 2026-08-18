# Lembretes NYC Digital

App de lembretes com login para 2 usuários (você e seu chefe). Lembretes podem ser
pessoais (um cria para o outro ou para si) ou da empresa (visíveis para os dois).

Stack: Next.js (App Router) + Neon Postgres + cookie de sessão assinado (sem libs de auth).

## 1. Criar o banco no Neon

1. Crie um projeto em https://neon.tech
2. Copie a connection string (formato `postgres://user:pass@host/db?sslmode=require`)
3. No SQL editor do Neon, rode o conteúdo de [`schema.sql`](schema.sql)

## 2. Configurar variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```
DATABASE_URL=postgres://...
SESSION_SECRET=qualquer-string-aleatoria-longa
```

## 3. Criar os dois usuários

```bash
npm install
DATABASE_URL="sua-connection-string" node scripts/create-user.mjs joao "senha-forte" "João"
DATABASE_URL="sua-connection-string" node scripts/create-user.mjs chefe "outra-senha" "Nome do Chefe"
```

(sem `DATABASE_URL` no ambiente, o script só imprime o SQL para você colar manualmente)

## 4. Rodar localmente

```bash
npm run dev
```

## 5. Deploy na Vercel

1. Suba este repositório para o GitHub
2. Importe o repo em https://vercel.com/new
3. Em Settings → Environment Variables, adicione `DATABASE_URL` e `SESSION_SECRET`
4. Deploy
