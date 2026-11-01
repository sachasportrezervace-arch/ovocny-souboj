# Ovocný souboj – deník

PŘEVZATO 1. 11. – kolo vylepšení, session ovocny-souboj (kolo); jiná session sem nepíše.
PŘEVZATO 31. 10. – dodělává session na účtu P, jiná session sem nepíše.

## 2026-11-01 – kolo vylepšení (Claude, session ovocny-souboj kolo)
- **Hotovo:** (1) Finále podle délky kola: 2 min 8 vln (8,6 s), 1 min 5 vln (5,8 s), kus za 1 bod (`Sim.finaleLen`, `finaleWaves`). Simulace 400 kol dvou Kuchtíků: podíl bodů z finále 1 min 54 % → 35 %, 2 min 35 % → 28 %, vedoucí hráč ho ztratí ~20 % kol. (2) Šťáva řezu: proud ve směru švihu, kapky z půlek, bílý záblesk řezu 110 ms, „ššk“ čepele a každý další kus v tahu zní výš. (3) Naschvály: žeton s ikonou v barvě odesílatele letí od odesílatele k cíli (příchozí na místo účinku, šmouha naskočí s dopadem), ikona u cedulky 0,9 s. (4) Nové: napětí v Do 50 (kdokoli 10 bodů od cíle) a Tři životy (kdokoli na posledním životě): rudé tepající okraje, tep hodin, zvuk tepu. (5) Bez slov přes plochu („Přesně!“, „Combo“, „křup“ pryč, jen čísla), malý prstenec přesného řezu. (6) Bomba se nepočítá, dokud se prst nehne > 12 px od dotyku.
- **Ověřeno (port 8801):** `sim.test.mjs` 25/25 · `kolize.cjs` 17/17 · `feel.cjs` 12/12 (1. běh 11/12: první naschvál po 20 s při souběžném design-eye, 2. běh čistý) · `float.cjs` 6/6 · `solo.cjs` 43/43 · `duel.cjs` 49/49 · `mody.cjs` 21/21 · `herna.cjs` 32/32 · `rozmanitost.cjs` 32/32 · `vyzva-b.cjs` 25/26 (jen známá chyba WebKitu u utnutých požadavků po `goto`, viz 31. 10.).
- **Design-eye:** 1. kolo „ještě ne“ (slova přes plochu, obří prstenec, malý žeton) → opraveno; 2. kolo „ano, profi indie hra“. Snímky `tests/shots/kolo-1-11`, `kolo-2-11/head`.
- **NEOVĚŘENO:** živý playtest dvou lidí a skutečný iPhone (pocit z finále a napětí jen ze simulace botů a snímků); půlka jablka působí šedě (design-eye, drobné); zlatá hvězda finále není plochý vektor.
- **Živě (push `30988d9..e42d52a`, Pages = HEAD podle md5 main.js):** `solo.cjs` 43/43 · `kolize.cjs` 17/17 · `herna.cjs` 3 běhy: 31/32, timeout 3. partie, 31/32 – pokaždé jen síťové časování mantledb (po reloadu nepřišel `vysledek` do limitu; stejné jako 31. 10.), lokálně 32/32; protokol Herny se dnes neměnil.
- **Dál:** slupka půlky u světlé dužiny (`src/scene.js` `slice`), plochá hvězda finále.

## 2026-10-31 noc – NASAZENO napojení na Hernu 2ff83f2 (Claude, účet P)
- Push `4bff4f9..2ff83f2`, Pages = HEAD (md5 main.js).
- Živě: `node tests/herna.cjs <URL>` exit 0, 32/32 (1. běh 31/32: po reloadu zakladatele přišel `stav konec` až po kontrole – časování, ne chyba protokolu) · `solo.cjs` exit 0, 43/43 · `vyzva-b.cjs` exit 0, 26/26.
- Herně posláno: protokol v1, parametry a dokument mantledb. NEOVĚŘENO: skutečná Herna ve dvou prohlížečích, skutečný iPhone.

## 2026-10-31 noc – napojení na Hernu, protokol v1 (Claude, subagent; lokálně, NEPUSHNUTO)
- **Hotovo:** `<meta name="herna-protokol" content="1">`; `#herna=1&m&r&seat&names&zaklada` přeskočí výzvu i setup (zakladatel `zaklada=1` založí dokument `ovocny-souboj-<r>/hra` se jmény, sedí na x; druhý `zaklada=0` ukazuje „Čeká se, až hra naskočí…“, polluje a sedne si na volné místo; reload sedne podle `meta.hx` = sedadlo Herny, které drží x). Jména: `seat=s` hraje za `names[s]`. Skryto: sdílení, „Zkusit sám“, „Poslat odkaz“, „Poslat výsledek do chatu“, tlačítko celé obrazovky a nápověda k ploše. Předsíň „Můžete hrát“ má volbu módu první partie a „Jak se hraje“ (úvodní obrazovka se přeskakuje). Na výsledku je vedle „Odveta“ sekundární „Jiná hra“.
- **Zprávy rodiči:** `pripraveno` (po načtení), `stav` ceka/hraje/konec (ceka = předsíň, čekání na soupeře; hraje = odpočet, kolo, čekání na dohrání soupeře; konec = výsledek), `vysledek` `{partie: "<r>:<n>", vitez: sedadlo Herny | null}` jednou na partii (partie = souboj `Sim.mOf(go)`, i odveta; remíza = null), `jina-hra`. Bez platného `herna=1` (neplatné `r`, chybějící `seat`) se hra chová jako dřív; zprávy jdou jen při `window.parent !== window`.
- **Ověřeno (port 8801):** `node tests/herna.cjs http://127.0.0.1:8801/` exit 0, 32/32 (Chromium desktop 1440×900 + WebKit iPhone 13 @1×, hra v iframe rodiče se lištou 48 px; 3 partie včetně remízy, seat=1 zakládá, diakritika ve jménech, reload, jina-hra, bez herna=1) · `sim.test.mjs` exit 0, 25/25 · `vyzva-b.cjs` exit 0, 26/26 · `solo.cjs` exit 0, 43/43 · `duel.cjs` 49/49 exit 0 (1. a 2. běh jeden náhodný FAIL bota: 0 naschvál, 0 přesných řezů; 3. běh čistý) · `mody.cjs` 21/21 exit 0 (1. běh 19/20: zpoždění sítě 3,1 s u konce 3 životů; 2. běh čistý).
- **Design-eye (1 kolo, rendery desktop + iPhone):** „ano“, bez blokujících nálezů.
- **Zbývá / NEOVĚŘENO:** push dělá hlavní session; živý test v Herně (dva prohlížeče, skutečná Herna) a `node tests/herna.cjs <Pages URL>` po nasazení; skutečný iPhone; chování při současném `zaklada=1` u obou hráčů (protokol to nepředpokládá); Herna sama (potvrzení při `hraje`) jen z její strany.

## 2026-10-31 noc – NASAZENO sólo 0fbf02e (Claude, účet P)
- Push `681ddd9..0fbf02e`, Pages servírují HEAD (md5 main.js).
- Lokálně na finálním kódu: sim 25/25, duel 49/49, mody 21/21, solo 43/43, vyzva-b 26/26 (2. běh; 1. běh 25/26).
- Živě: `node tests/solo.cjs <URL>` exit 0, 43/43. `node tests/vyzva-b.cjs <URL>` exit 1, 25/26 – jediný FAIL „bez chyb v konzoli“: WebKit hlásí „access control checks“ u mantledb dotazů místnosti, kterou B právě opustil přes `B.goto` (test ř. 69/104). Jde o utnuté rozběhnuté požadavky při navigaci, CORS hlavičky mantledb jsou v pořádku (ověřeno curl: ACAO *). Hra funguje (zbylých 25 kontrol včetně synchronizace prošlo).
- Dál (volitelné): v `tests/vyzva-b.cjs` ignorovat konzolové chyby utnutých požadavků po `goto`; ověřit na skutečném iPhonu; landscape a reduced motion.

## 2026-10-31 večer (Claude, subagent: sólo režim „Zkusit sám“)
- **Hotovo (lokálně, NEPUSHNUTO):** tlačítko „Zkusit sám“ na zakládací visačce (desktop vedle „Připravit výzvu“, mobil pod ním) a adresa `#solo`; lobby „Trénink proti Kuchtíkovi“ s výběrem módu; bot Kuchtík v novém `src/bot.js` (stejný rozpis kola jako hráč, tedy módy, zvláštnosti, desky i finále jako v ostré hře; míří na 50–68 % kusů, combo, měřič, naschvály oběma směry, ve třech životech chybuje s tempem, mírné dorovnání obtížnosti); na výsledku „Znovu“ + „Vyzvat soupeře“ (návrat na visačku, adresa bez `#solo`), nadpis „Vyhráváš!“ / „Vyhrává Kuchtík“, bez „chce odvetu“, bez čepele a sdílení; v hodinách nenápadné „trénink“ místo série.
- **Lokální:** `room.solo` (žádná místnost, `pollPlan` → `null`, `commit()` slučuje metadata v paměti, `localWriter`); do localStorage nejde `ovs-seat/wins/seen-*`; nic do mantledb. Pojistka `introMine` a výzva pro dva nedotčeny (změny v main.js jsou za `room.solo`).
- **Ověřeno (port 8801, exit 0):** `node tests/sim.test.mjs` 25/25 (+4 testy bota) · `node tests/solo.cjs` 43/43 (Chromium desktop `#solo` + WebKit iPhone 13 @1× tlačítkem; kolo na čas, závod, tři životy, naschvály oběma směry, 0 požadavků na mantledb zachycených i zahozených, úložiště, přechod do výzvy) · `mody.cjs` 21/21 · `duel.cjs` 49/49 · `vyzva-b.cjs` 26/26 · `rozmanitost.cjs` 32/32 · `kolize.cjs` 17/17. Poznámka: regresní série běžela před poslední úpravou textů sólo výsledku („Vyhráváš!“, bez „chce odvetu“; za `room.solo`), `solo.cjs` a `sim.test.mjs` běžely i po ní.
- **Design-eye (2 kola):** 1. kolo „ještě ne“ (blokující: „Souboj bere Ty“ při výchozím jménu, „chce odvetu“ v sólu), opraveno; 2. kolo: obě opravy potvrzeny, jediný nález (červený useknutý nápis pod kartou) byl snímek zachycený během doznívajícího „Konec!“, po úpravě testu (počká 1,1 s) pryč. Verdikt po opravách: ano.
- **Zbývá / NEOVĚŘENO:** push dělá hlavní session; živý test `#solo` na Pages (po pushi: `node tests/solo.cjs https://sachasportrezervace-arch.github.io/ovocny-souboj/`); skutečný iPhone (60 snímků/s) a pocit z obtížnosti bota (kalibrováno jen simulací a testovacím botem, ne člověkem); `?kolo=` zkracuje kola jen v testech.

## 2026-10-31 noc – NASAZENO 681ddd9 (Claude, účet P)
- Push `81eb345..681ddd9` na main, Pages servírují HEAD (md5 main.js, sim.js, index.html = HEAD).
- Živě na https://sachasportrezervace-arch.github.io/ovocny-souboj/: `node tests/rozmanitost.cjs <URL>` exit 0, 32/32 · `node tests/vyzva-b.cjs <URL>` exit 0, 26/26 (první běh 21/26 během přepínání verzí na Pages, druhý čistý).
- Lokálně před pushem: sim 21/21, kolize 17/17, duel 49/49, mody 21/21 (2×), vyzva-b 26/26, rozmanitost 32/32; design-eye „profi indie hra“.
- Dál: sólo režim (`HRY-SOLO-2026-10-31.md`) rozdělaný subagentem, nasadí se zvlášť.

## 2026-10-31 večer (Claude, subagent: tři životy + design-eye 2. kolo)
- **Příčina pádu „tři životy“ (z dat):** (1) headless WebKit bez GPU kreslil iPhone při DPR 3 jen ~6 snímků/s (změřeno i na starším commitu b131589, závisí jen na DPR: @1× 50, @2× 16, @3× 6), bot viděl zastaralé polohy; (2) ve hře ~3 % kusů vyjelo bokem z obrazovky (`spreadOut` posune `u`, `vu` zůstane, kus plul k okraji až mimo displej, bot pak začínal tah mimo viewport). Dvě další varianty selhání: zpoždění `oppF` přes mantledb.sh až 5,7 s (síť, mimo hru).
- **Opravy:** `Sim.keepIn`/`KEEP_X` v `src/sim.js` (bez bomb), bomba hledá místo i v širším rozsahu drah; `tests/sim.test.mjs` +2 regresní testy (okraj, dosažitelnost prvních 15 s); `tests/mody.cjs`: tah bota nezačíná mimo displej a B jede na deviceScaleFactor 1 (komentář v kódu).
- **Design-eye 2. kolo:** nakonec „ano, profi indie hra“. Opraveno: kiwi olivové (vypadalo jako brambora), květy jara a vločky zimy menší na mobilu, bez moaré rastru na ubrusu, pruhovaná dráha měřiče při dohánění, větší vzorek čepele.
- **Ověřeno (port 8801, exit 0):** sim.test 21/21 · kolize 17/17 · duel 49/49 · mody 21/21 (2×) · vyzva-b 26/26 · rozmanitost 32/32.
- **Zbývá / NEOVĚŘENO:** push dělá hlavní session; živé ověření na Pages; skutečný iPhone (60 snímků/s) a tempo tří životů; design-eye neviděl landscape 844×390 a reduced motion; ostatní testy (duel, vyzva-b, rozmanitost) pořád jedou na WebKit @3× (pomalé, ale prošly).

## 2026-10-31 ~19:30 PŘEDÁVKA (Claude, session na účtu P, kontext plný) – Ovocný souboj: kolize, finále, rozmanitost
- **Hotovo (lokálně, NEPUSHNUTO):** commity `3db56cb` (WIP po přerušení), `f2a4116` + poslední commit „Design-eye opravy…“ (viz `git log`).
  - Kolize: švih jako úsečka proti pohybujícímu se kusu (`Sim.sweptDist`), ovoce 1,28 r + 9 px, bomba 60 % r. Bomba v rozpisu nikdy blíž než 0,6 součtu poloměrů (`clearBombs`), bomba v řadě má mezeru navíc, kusy vyhozené naráz se rozestoupí (`spreadOut`, `row` u řad). Finále nepouští staré kusy, které by v něm visely > 1,5 s.
  - Finále (kolo na čas ≥ 45 s, posledních 8,6 s): bez textu, teplé světlo, zlatý rámeček hodin, velký zlatý znak, fanfára.
  - Desky: + zima, jaro (roční období: podzim, zima, jaro). Ikona kola v HUD opravena (`toggleAttribute("hidden")`), 34/44/24 px a při nástupu pulzne. Obří meloun ve třech životech nebere život.
  - `docs/mody.md` (sekce Proti stereotypu, Finále, Kolize), `PRODUCT.md`.
- **Ověřeno (port 8801):** `node tests/sim.test.mjs` 19/19 · `kolize.cjs` 17/17 (Chromium + WebKit iPhone dotyk) · `float` 6/6 · `feel` 12/12 · `vyzva-b` 26/26 · `duel` 49/49 (po úpravě testu: živé skóre 6 vzorků) · `rozmanitost.cjs` 32/32 (3 kola, liší se mod/deska/hash, finále u obou, body ve finále 18–97).
- **Selhává:** `node tests/mody.cjs http://127.0.0.1:8801/` 20/21 – „tři životy: Radce kolo skončilo samo do 2,5 s“: bot B na iPhonu ztratí 3 životy za ~7 s (padá i se zvláštností obri). Podezření: bot v `tests/mody.cjs` `botStep` filtruje `o.y < vp.height - 60`, nízké kusy nesekne; ověřit, jestli nejde o hru (kus vidět jen u spodního okraje).
- **Design-eye (1. kolo):** „ještě ne, blízko“. Blokující 1 (zlaté číslice hodin ve finále) a 2 (malá ikona) opraveny, nové rendery `tests/shots/rozmanitost-k1-finale-iphone.png` vypadají čitelně. Neblokující: kiwi a citron hůř rozlišitelné, velká tyrkysová šmouha naschválu, dlouhá nápověda na mobilu.
- **Další krok:** 1) opravit/vyřešit mody 3 životy → 21/21; 2) design-eye 2. kolo (verdikt „profi indie hra“); 3) push `git -c credential.helper= -c "credential.helper=!gh auth git-credential" push`, počkat na Pages, živě `node tests/vyzva-b.cjs https://sachasportrezervace-arch.github.io/ovocny-souboj/` + `rozmanitost.cjs`; 4) hlášení nadřazené session (URL, 3–5 bodů pro hráče, testy, NEOVĚŘENO).
- Commity bez podpisu AI (pravidlo převzetí). Server: `.claude/launch.json` port 8801.

## 2026-10-30 10:28-2026-10-31 17:28 - Zatím ne [compact]
- Model: claude-opus-5-5 · session `922eab0b` · 18 zadání <!-- kompas:922eab0b:compact -->
- **Zadání:**
  - Zatím ne
  - pojdme vymyslet nějakou dalšá zajimavou unikátní hru co mužeme hrát ve 2 něco ve stylu jako melo ICQ neco zabavneho s dobrým vizuálem jako nejaka mensi prohliz…
  - ok zkusime <pasted_content id="0170"> 1. Quarto, předělané na kafíčka (doporučuju) Málo známá hra, ale geniální. Je tu 16 hrnků a každý se liší ve 4 věcech: ve…
  - neodkáežem paralerne i nejakou jendoduchou cinskou / japonskou pro ne popularni hru co by davali smysl nebo neoc jineho ?
  - chbyi mi tam lehce v durhem oku vide tto bile jak to bylo (2. oko ) a proc oko neni prnvi bile? a jak bys dokazal tohle logo udelat jako SVG animace?
  - a mozna bych chtěl zkusit do designu zapojit orange splash a drops color
  - a co ještě taková kopie ninja fruit 1v1 s nějakým twistem ale pdoobným 3D vizuál jendoduchým
  - ze se to spusti a třeba minutu nebo 2 nebo ěnoc tkaoveho budem sekat a kdo bud emit vetsi skore nakonci
  - i ten jezkomec vylepsit vizuálně musi to byt dobrá grafika a ty postavičky musí vypadta dobře a mit i dobrou fyziku i reakce když se něco stane malem umrou neb…
  - a zamerit se na to aby to enbylo AI slop ale profi design vzdycky v kazde hře
  - … (5 dalších)
  - a kdzy zaklada hru z odkazu ona tak vyziva sama sebe podivej se na to
  - vsechny yt hru se pokousis dotahnout o level výš aby byli zabavné a ne tolik repetetivní
  - třeba nakonci ninja fruitu nekdy byl takový ten event kdy mužeš hromaud bodu nasekat
- **Soubory:** `C:/Users/le artist/AppData/Roaming/Claude/scratch-workspaces/a6a7acfc-0a38-40ad-94ae-6ba230a3b53c/6a5adc0f-5814-4034-986e-41296f8d6841/scratch-2026-10-30-bcf3d5/piskvorky.html`, `C:/Users/le artist/AppData/Roaming/Claude/scratch-workspaces/a6a7acfc-0a38-40ad-94ae-6ba230a3b53c/6a5adc0f-5814-4034-986e-41296f8d6841/scratch-2026-10-30-bcf3d5/engine.js`, `C:/Users/le artist/AppData/Roaming/Claude/scratch-workspaces/a6a7acfc-0a38-40ad-94ae-6ba230a3b53c/6a5adc0f-5814-4034-986e-41296f8d6841/scratch-2026-10-30-bcf3d5/trener.src.html`, `C:/Users/le artist/AppData/Roaming/Claude/scratch-workspaces/a6a7acfc-0a38-40ad-94ae-6ba230a3b53c/6a5adc0f-5814-4034-986e-41296f8d6841/scratch-2026-10-30-bcf3d5/WORKLOG.md`, `C:/Users/le artist/.claude/projects/C--Users-le-artist-AppData-Roaming-Claude-scratch-workspaces-a6a7acfc-0a38-40ad-94ae-6ba230a3b53c-6a5adc0f-5814-4034-986e-41296f8d6841-scratch-2026-10-30-bcf3d5/memory/games-clean-vector-taste.md`
- **Poslední odpověď AI:** Všech pět her, které jsem právě obeslal, už rozdávání pestrosti rozplánovalo a pracuje na tom, nic z toho ale zatím není ve hře: - **Kafíčka:** každá partie dostane jinou sadu výherních řad, které se dvakrát po sobě neopakují. Poražený jednou za partii může vrátit podaný hrnek. Za výhry v sérii přibude titul u jména. - **Zvířátková šogi:** 4–5 různých férových rozestavení, ale první partie je vždy klasická. Přibude šance na návrat pro toho, kdo prohrává. - **Ježkomet:** náhodný modifikátor partie (vítr, noc, led nebo nízká gravitace), 3–4 mapy a šance na návrat. - **Ovocný souboj:** modifikátor kola, víc pozadí a ročních období, šance na návrat pro toho, kdo prohrává, a stopy čepele jako od…

## 2026-10-31 večer (Claude, módy + oprava „vyzývá sama sebe“, nasazeno)
- Hotovo, nasazeno a ověřeno živě:
  - `5645252`: oprava výzvy. Výzvu nejde přijmout pod jménem vyzyvatele, na intru je „Jsem {vyzyvatel}“ a setup nepustí stejná jména. Příčinu NEOVĚŘENO, nejpravděpodobnější je vlastní výzva otevřená v jiném úložišti.
  - `b131589`: módy Na čas / Do 50 bodů / Tři životy (`docs/mody.md`) a design review ve 2 kolech s verdiktem „profi indie hra“.
- Živě (Chromium desktop + WebKit iPhone 13): mody 21/21, duel 49/49 (skew 170 ms), vyzva-b 26/26. Lokálně navíc sim 12/12.
- Dál: Mark a Radka vyzkouší tempo tří životů a cíl 50 na skutečných telefonech (`Sim.TARGET`, `Sim.LIFE_MS`). Na iPhonu na šířku se setup scrolluje o ~10 px. `viewWatch` má „Jsem {zakladatel}“ jako hlavní tlačítko, takže se dá omylem převzít cizí sedadlo.
- Ostatní hry (Kafíčka, šogi, Ježkomet, Psaníčko) už mají pojistku `introMine`, jména se tam prohodit nemůžou (jen čtení kódu).

## 2026-10-31 (Claude, design review módů)
Design-eye proti „profi indie hra, plochý vektor, minimální HUD, žádné hlášky přes hru“ (desktop 1440×900 + WebKit iPhone 13, oba hráči).
- Kolo 1 (verdikt „skoro“): (1) HIGH výsledek tří životů ukazoval u vítěze i poraženého stejné „0:04 : 0:04“, vítěz nečitelný (přeživšímu končí kolo smrtí soupeře) → u přeživšího „+“ (`lvOf`/`big` ve `viewResult`). (2) MED čipy módu vypadaly stejně jako čipy sázek pod nimi → mód je spojený přepínač přes celou šířku (`.chips.seg`, setup i „Odveta v módu“, na výsledku už nezůstává prázdný pruh vpravo). (3) MED „×“ po propadlém kuse byl drobný šedý Figtree → Bungee 52 px se stínem jako ostatní plovoucí texty. (4) LOW pravidlo v čekárně bylo nejmenší text na visačce → u `h2` 17 px v inkoustu. (5) LOW tečky životů 10 → 12 px, pulz ztráty života jemnější (scale 1,55, ne 1,9, nepřekrývá sousední tečku).
- Kolo 2: verdikt „profi indie hra“, bez blokujících nálezů (jen LOW: na iPhonu na šířku se setup scrolluje, přepínač přidal ~10 px; hlášky „Přesně!“ a „Combo“ jsou starší twist, ne součást módů).
- Testy: v `tests/mody.cjs` dvě flaky kontroly (životy soupeře přeskočené mezi kroky bota → MutationObserver; hodiny závodu při rychlém cíli → snímek ve 4 s), přibyly jen snímky (lobby, „×“). Výsledky: sim 12/12, mody 21/21, duel 49/49.

## 2026-10-31 noc (Claude, hlášky o naschvalech pryč)
Mark při hraní: hlášky („posílá bombu“, banner, „letí k soupeři“) překáží a dělají chaos. Odstraněno: banner `#banner`, texty `SAB` v `src/sim.js` (nahrazeno `SAB_TYPES`), „Náboj plný!…“, podtitulky u karamboly, comba, „Odraženo!“ (nyní „Přesně!“) a „bomba od <jméno>“. Naschvál samotný beze změny. Místo textu: bliknutí ikony naschválu na rohu soupeřovy cedulky (`#sabIcon`, 380 ms) a pulz měřiče u odesílatele (`#chargeMe.fire`, 360 ms); nic přes plochu, reduced-motion jen mění průhlednost. Testy: `feel.cjs` a `float.cjs` místo hlášek ověřují doručení (`got` + ikona bliknula, pulz u odesílatele, žádný text o naschvále, žádný banner).

## 2026-10-31 večer (Claude, design review 3 kola, push, živý test)
Design-eye (taste lens, desktop + iPhone, oba hráči), 3 kola:
- Kolo 1 (verdikt „skoro“, 15 nálezů): série a výsledek z pohledu druhého hráče (barvy čísel podle sedadla, „já“ vlevo i na kartě výsledku), ovoce místo fasetového low-poly hladké toon (hladké normály, 24×16, barvy po vrcholech, tmavší spodek jako tvar), kapky šťávy plochá 3–8 px kolečka bez odlesku a 8–14 na řez, plovoucí texty světlé s tmavým stínem a bez překryvu (`float()` hlídá HUD, jiné texty i banner), sázka čárkovaný razítkový rámeček bez náklonu a s mezerou, desktop výzva a přijetí jednosloupcově (480 px), setup s tlačítkem přes oba sloupce, KOPÍROVAT už neuříznuté, škála zaoblení 6/8/12, úvod přijetí ve Figtree, překlopení číslic 0,18 s, banner s min. šířkou, v menu už nevisí karambola pod visačkou. Překryv „+5“ a „Přesně!“ u karamboly opraven (`tests/float.cjs`).
- Kolo 2 (verdikt „skoro“): plovoucí text vs. banner naschvalu, kiwi nečitelné (světlejší, tmavé skvrny), meloun v setupu seděl na hraně tlačítka (mezera 14 px), čipy sázek na iPhonu v jednom řádku.
- Kolo 3: verdikt „profi indie hra“ (silné, bez blokujících nálezů). Drobnost: půlky ovoce bez obrysu, hned opraveno (světlý obrys i na půlkách). Zbývá: váha Figtree v Safari na skutečném iPhonu (headless WebKit kreslí tence, `document.fonts` hlásí 800).
Testy lokálně: sim 9/9, duel 49/49, feel 8/8, float 6/6.
Nasazeno: commit 580767b, https://sachasportrezervace-arch.github.io/ovocny-souboj/. Živě: duel 49/49 (Chromium desktop 1440×900 + WebKit iPhone 13, skew 82 ms), float 6/6, `perf.cjs <URL> 4 1`: 59,8 fps průměr, 1% low 59,5, max 32 draw calls, GPU AMD (D3D11), CPU 4× zpomalené, Pixel 7 emulace. `tests/perf.cjs` opraven (#msg je teď odstavec, ne textarea).

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
