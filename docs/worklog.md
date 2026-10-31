# Ovocný souboj – deník

## 2026-10-31 (Claude, opravy po design review)
Hotovo (lokálně, nepushnuto): iPhone setup se vejde i s CTA (jména vedle sebe, menší čipy, návod sbalený, hint jen na setup/přijetí/lobby), čeština bez nepřímého pádu jmen, desktop visačka 720 px ve dvou sloupcích uprostřed na provázku z markýzy (výzva, přijetí, výsledek také), HUD max 980 px, prázdný stav cedulky skrytý, výsledek jen „Souboj bere X“ + velká čísla, kontrast placeholderu, bez osiřelého špendlíku, tlačítka fs/zvuk na desktopu s dřevěným podkladem, telefon na šířku ve dvou sloupcích. Testy: sim 7/7, duel 42/42. Figtree 800 se načítá (document.fonts loaded); tence se kreslí jen v Playwright WebKitu, na skutečném iPhonu neověřeno.

## 2026-10-31 (Claude, 2. kolo: jedno kolo, mobil, desktop)
Hotovo (lokálně, NEPUSHNUTO, nasazení a design review dělá hlavní session):
- Jedno kolo místo nejlepší ze 3: délka 1/2 min (výchozí 2) v meta `g.rl`, `?kolo=N` (10–120 s) má přednost; K = zápas*10+1, odveta = další zápas; `Sim.matchState/series`, `schedule` škálovaný (karambola cca po 12 s). Texty, m:ss, HUD „Souboj č. N“ + série.
- Fullscreen tlačítko, iOS nápověda (Net.store `ovs-ioshint`), manifest + ikony (`icons/`, `tools/make-icons.cjs`), apple meta.
- Mobil: dvh/innerHeight, safe-area, zákaz zoomu a gest, panel scrolluje sám, cíle ≥ 44 px. Desktop: vlastní rozvržení, markýza/bedny v pixelech, omezené pole spawnu, kurzor.
- Stavy: chyba spojení s „Zkusit znovu“, soupeř 20 s po konci nedohrál (Počkat dál / Poslat odkaz), haptika (bomba, naschvál, konec kola, combo).
- Testy: `sim.test.mjs` 7/7, `duel.cjs` (Chromium desktop 1440×900 + WebKit iPhone 13) 32/32.
Neověřeno: skutečný iPhone/Android (fullscreen, vibrace, scroll panelu dotykem), landscape telefon jen z CSS, perf.cjs po změnách nespuštěn.

## 2026-10-31 (Claude, session od piskvorky-design)
Hotovo:
- Hra v `index.html` + `src/{sim,net,scene,main}.js`, three.js r170 připnutý v `vendor/three.module.min.js` (MIT, licence vedle).
- Směr (impeccable, seed b27f5df6): zelinářský stánek na večerním trhu, křídové cedulky, podepsané naschvály. Kontrakt v `.impeccable/surfaces/index-html.md`, produkt v `PRODUCT.md`.
- Sync: 3 dokumenty na mantledb.sh (meta `hra` + `x` + `o`, každý jeden zapisovatel), soupeř se během kola čte co 400 ms. Psaníčkových 3 s by nestačilo.
- Testy: `node tests/sim.test.mjs` 7/7; `node tests/duel.cjs http://127.0.0.1:8803/` lokálně 16/17 (jediný FAIL = 404 v konzoli, opraveno: o-dokument se při přijetí nečte, soupeř se nečte před přijetím). Skew startu 74/143 ms, naschvály 13/13, zpoždění prům. 648 ms.
- Po testu opraveno: zastaralé „ještě seká“ na výsledku, provázek visačky přes hodiny.

Dřívější plán: git init + repo `sachasportrezervace-arch/ovocny-souboj` + GitHub Pages (main /), počkat na build, `node tests/duel.cjs https://sachasportrezervace-arch.github.io/ovocny-souboj/` (cíl 17/17), změřit fps (Chromium, Pixel 7, CPU throttle 4×), DESIGN.md.
Lokální server: port 8803 (`.claude/launch.json` v react-apps, konfigurace „ovocny-souboj“). 8797 drží Polštářovka, 8765 Kafíčka.

Nasazeno: https://sachasportrezervace-arch.github.io/ovocny-souboj/ (repo sachasportrezervace-arch/ovocny-souboj, Pages main /).
Živá adresa: `node tests/duel.cjs https://sachasportrezervace-arch.github.io/ovocny-souboj/` 17/17 (Chromium Pixel 7 + WebKit iPhone 13),
skew startu 341/225 ms, naschvály 14/14, zpoždění prům. 1177 ms vč. 2,6s fronty. Výkon `node tests/perf.cjs <URL> 4 1`: 60 fps
průměr, 1% low 59,5 fps, CPU 4× zpomalené, Pixel 7 emulace, GPU AMD (D3D11), max 27 draw calls, 6 kusů naráz.
Neověřeno: softwarové vykreslení bez GPU (swiftshader + 4× CPU) test nedoběhl do startu kola; skutečný telefon.
Otevřené: případné vyladění obtížnosti (bomby ~20 % kusů), Mark ještě neviděl hru na svém mobilu.
