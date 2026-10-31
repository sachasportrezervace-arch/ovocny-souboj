# Ovocný souboj – deník

## 2026-10-31 (Claude, nová deska, přesný řez, měřič naschválu, tempo)
Hotovo lokálně (NEPUSHNUTO):
- Pozadí: pryč kopce, okénka, bedny, markýza, žárovky. Jedna tmavá dřevěná deska (canvas `#board`, kresba let, suky, zámky prken, viněta), jemné mizející skvrny šťávy (`#stains`). Ovoce má světlý obrys, bomba oranžový. Cedulky HUD bez provázků u horní hrany, visačka přibitá hřebíčkem. DESIGN.md přepsán.
- Share karta: Poslat/Kopírovat stejná výška (měřeno offsetem, visačka je pootočená), zpráva jako text bez posuvníku, nadpis „Pošli výzvu, ať Radka ví“ s balance, bez emoji.
- Přesný řez: přímka tahu ve vnitřní čtvrtině poloměru = +2 body (`Sim.POINTS.precise`), „Přesně!“, prstenec jisker, ting, haptika; `__ovs.precise`, log `precise`.
- Twist (na přání Marka): měřič naschválu na vlastní cedulce (řez +1, přesný +3, karambola +5, plný 18 pošle šmouhu/mráz/bombu), zaručená karambola ve 4–6 s, přesně rozseknutý led vrací mráz („Odraženo!“). Nápověda to říká v jednom odstavci.
- Tempo (`node tests/tempo.mjs 120`, 8 semínek) před -> po: ovoce/s po čtvrtinách 0,95/1,20/1,57/1,45 -> 0,95/1,12/1,40/2,08; bomby 20,1 % -> 8,4 % kusů; naráz vidět prům. 4,8 (max 14) -> 4,2 (max 13); vlny 4+ 7,6 -> 8,9 za kolo, ale nově jako řada v jednom tahu; gravitace 15 -> 17 (svižnější let), výška vrcholu 2…8 -> 2,2…7.
- Testy: sim 9/9, duel 49/49 (Chromium desktop + WebKit iPhone 13), feel.cjs (60 s, nový). Screenshoty `tests/shots/feel-*` a `duel` sady.
- feel 60 s (A desktop / B iPhone): první naschvál doručen po 6–8 s, zpoždění ~0,9 s, šmouha 2–10 s a nikdy nezakryje skóre, naráz vidět prům. ~3, max 9–10, přesných řezů 4–20 na stranu.
Neověřeno: skutečný telefon; v testu se SW vykreslením (~20–26 fps) desktopový bot sekal výrazně hůř než iPhone bot (skóre se liší o desítky bodů, je to artefakt bota, ne hry); lidský pocit z hranice 25 % poloměru a z četnosti naschválů (měřič 18) je třeba ověřit Markem.

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

## 2026-10-31 odpoledne – jedno kolo, fullscreen, layouty, design review
Commity 6c7083a + f8cdc02 nasazené na Pages. Jedno kolo 1/2 min (výchozí 2), fullscreen / iOS „Přidat na plochu“ + manifest, mobil na výšku, vlastní desktop, 13 nálezů design-eye opraveno.
Živě: `node tests/duel.cjs https://sachasportrezervace-arch.github.io/ovocny-souboj/` 42/42 (Chromium desktop 1440×900 + WebKit iPhone 13), skew 149 ms, naschvály 2/2 (prům. 379 ms). `perf.cjs <URL> 4 1`: 60 fps, 1% low 59,5, max 21 draw calls.
Neověřeno: skutečný telefon (vibrace, standalone, váha Figtree 800 v Safari), stav „soupeř nedohrál“ bez testu. Fullscreen ikona na desktopu leží nad nápisem bedny (na dřevěném podkladu).
