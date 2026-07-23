# Kontrola cen — appka pro terén

Produkční verze appky napojená na Supabase. Zatím bez offline režimu (viz
poznámka níže) — ten se doplní jako další krok, jakmile ověříte základní
provoz naostro.

## Spuštění lokálně

Vyžaduje Node.js 18+.

```bash
npm install
npm run dev
```

Otevře se na `http://localhost:5173`. Přihlaste se e-mailem a heslem účtu,
který jste vytvořili v Supabase (Authentication → Users) a který má řádek
v tabulce `users`.

Přístupové údaje k Supabase jsou už vyplněné v souboru `.env` (Project URL
a Publishable key, oba jsou bezpečné ke sdílení — nejsou to hesla).

## Nasazení na Vercel

1. Nahrajte tuhle složku jako repozitář na GitHub (přes GitHub Desktop nebo
   `git init && git add . && git commit -m "init" && git push` — pokud
   nevíte jak, dejte vědět, rozepíšu to krok za krokem).
2. Na vercel.com → *Add New* → *Project* → vyberte repozitář.
3. Vercel framework rozpozná automaticky (Vite). Před nasazením přidejte
   v *Environment Variables*:
   - `VITE_SUPABASE_URL` = `https://romdrfedpconfvnwoikw.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (Publishable key z Supabase)
4. *Deploy*. Appka dostane adresu typu `kontrola-cen.vercel.app`, později
   se dá napojit vlastní doména.

## Přidání dalších uživatelů

Zatím ručně přes Supabase (admin panel na to zatím není hotový):
1. Authentication → Users → *Add user* → zadat e-mail a heslo.
2. Zkopírovat User UID.
3. SQL Editor:
   ```sql
   insert into users (id, full_name, role)
   values ('UID_UŽIVATELE', 'Jméno pracovníka', 'field');
   ```

## Co appka zatím neřeší (plánováno dál)

- **Offline režim** — ukládání lokálně bez signálu a doplatek na server po
  připojení. Appka teď při ztrátě signálu zápis ceny neuloží.
- **Admin panel** — přidávání produktů, prodejen a uživatelů se zatím dělá
  ručně přes Supabase rozhraní / SQL.
- **PWA ikony** — `manifest.webmanifest` je připravený, ale bez ikon; appka
  půjde přidat na plochu, ale bez vlastní ikony (zatím systémová
  zástupná). Doplní se spolu s finálním designem.
