# Módy a vylepšení – návrh a výběr (2026-10-31)

Hrají dva lidé, každý na svém mobilu, jinde, většinou večer s otevřeným chatem. Sync jde přes mantledb.sh: soupeř se čte
co 400 ms, takže zpoždění je ~0,5 s. Proto u každého nápadu řeším, jestli zůstane férový, když každý vidí soupeře o půl
vteřiny pozadu.

## Nápady

1. **Do 50 bodů (závod).** Kdo první nasbírá 50 bodů, vyhrává a kolo končí oběma.
   *Proč je to zábavné pro dva na mobilu:* soupeřovo živé skóre se z čísla v rohu stane cílovou páskou. Vidíš, že Radka má 42
   a ty 38, a musíš riskovat combo přes bombu. Kolo trvá 35–50 s, takže se hodí do chvilky mezi zprávami.
   *Férovost:* rozhoduje čas dosažení cíle na vlastních hodinách kola (start obou se liší o ~0,1 s), ne to, kdo se dřív
   ozve na server. Když se oba dostanou do cíle v okně zpoždění, vyhraje rychlejší čas.

2. **Tři životy (kdo vydrží déle).** Každý propadlý kus ovoce nebo seknutá bomba bere život. Tři pryč a končíš. Vyhrává ten,
   kdo vydrží déle. Když vydrží oba až do konce (2 min), rozhodne skóre.
   *Proč:* úplně jiná dovednost než na čas. Nejde o rychlost, ale o pozornost a nervy, a tempo pořád zrychluje. Soupeřovy
   životy vidíš na jeho cedulce, takže víš, kdy přitlačit naschválem. Šmouha nebo mráz tu najednou můžou rozhodnout.
   *Férovost:* porovnává se čas smrti na vlastních hodinách. Kdo přežije soupeře, tomu kolo skončí samo ve chvíli, kdy jeho
   hodiny přejdou soupeřův čas.

3. **Zrcadlo (jedna sdílená plocha, kdo sebere víc).** Oba vidí stejné kusy a kus patří tomu, kdo ho sekne první.
   *Proč by to bavilo:* přímý souboj o každý kus, „vyfouknul jsi mi meloun“.
   *Proč ne teď:* při zpoždění ~0,5 s a letu ovoce ~2 s by oba často sekli stejný kus a pak by jednomu body zpětně zmizely.
   Pocit by byl laggy a nespravedlivý. Potřebovalo by to WebSocket/WebRTC, ne polling.

4. **Mistr nože (zen na přesnost).** Bez bomb a naschválů, body dává jen řez „Přesně!“.
   *Proč:* klidnější varianta na večer, staví na unikátním prvku hry (přesný řez).
   *Proč ne teď:* je to jen jiné nastavení bodování na čas. Dva lidé, co se teprve poznávají, chtějí spíš napětí a škádlení
   než tichou disciplínu. Dobrý kandidát na další kolo.

5. **Power-upy (zpomalení času, dvojité body, magnet).** Vzácné kusy s dočasným efektem.
   *Proč:* momenty „wow“ a zvrat na poslední chvíli.
   *Proč ne:* každý efekt potřebuje ukazatel v HUD (Mark chce minimální HUD). Navíc se kříží s měřičem naschválu, který už
   twist dělá. Víc systémů neznamená víc zábavy.

6. **Turnaj na 3 kola / sezónní ovoce (dýně na Halloween).** Turnaj už ve hře byl a Mark ho vrátil na jedno kolo. Sezónní
   ovoce je kosmetika bez herního dopadu. Hezké, ale „cool“ to neudělá.

## Výběr: Na čas + Do 50 bodů + Tři životy

- **Každý mód testuje jinou dovednost.** Na čas = výdrž a objem, Do 50 = sprint a riziko, Tři životy = pozornost a nervy.
  Odveta v jiném módu tak působí jako nová hra, ne jako opakování.
- **Všechny tři jsou férové při zpoždění ~0,5 s.** Rozhodují vlastní hodiny kola, ne pořadí zápisů na server. Zrcadlo tohle
  nesplní.
- **Žádný nový HUD prvek navíc kromě životů.** Cíl je napsaný v hodinách a životy jsou tři tečky na cedulce. Jinak zůstává
  stejné skóre, stejný měřič naschválu a stejná sázka.
- **Mód se mění bez nového odkazu.** Na výsledku je řada „Odveta v módu“, kterou může přepnout kdokoli z dvojice. Oba ji
  vidí živě a odveta se rozjede v tom módu.

Výběr je čistý: na zakládací visačce jedna řada čipů (1 min, 2 min, Do 50, 3 životy) a pod ní jedna věta s pravidlem.
Během hry nepřibyly žádné hlášky.

## Pravidla pro Marka (pár vět na mód)

- **1 min / 2 min (na čas):** Sekáte stejné ovoce. Když dojde čas, vyhrává vyšší skóre. Bomba −10.
- **Do 50 bodů:** Kdo první nasbírá 50 bodů, vyhrává a oběma hned skončí kolo. Bomba −10 tě vrátí zpátky, takže combo přes
  bombu je risk. Hodiny ukazují, jak dlouho už závodíte. Když do 1:30 nikdo cíl nedá, rozhodne vyšší skóre.
- **Tři životy:** Propadlý kus ovoce nebo seknutá bomba bere jeden život (tečky pod skóre, svoje i soupeřovy). Tempo pořád
  zrychluje. Vyhrává, kdo vydrží déle. Hodiny ukazují tvoji výdrž. Když vydržíte oba celé 2 minuty, rozhodne skóre.
- **Ve všech módech:** přesný řez dává +2, měřič naschválu posílá soupeři šmouhu, mráz nebo bombu, sázka a série platí přes
  módy.

## Proti stereotypu (2026-10-31, večer)
Cíl: tři kola za sebou se musí lišit, ale férově. Všechno náhodné se bere ze semínka kola, takže oba hráči mají totéž.

- **Zvláštnost kola** (`Sim.MODS`, ikona v hodinách a krátce velká při odpočtu, bez textu):
  - *Zlaté ovoce:* pár vzácných zlatých kusů za 5 bodů.
  - *Řady:* zhruba co 9 s letí řada 5–6 kusů, kterou jde vzít jedním tahem na combo.
  - *Obří meloun:* pomalý velký meloun na 4 řezy, každý řez bod, poslední +6.
  - *Měsíční tíže:* všechno letí pomaleji a výš, kusů je o třetinu méně.
  - Další kolo má vždy jinou zvláštnost i jinou desku než předchozí (`Sim.pickSeed`).
- **Desky a roční období** (`Sim.THEMES`): ořech, břidlice, piknikový ubrus, modré kachle, podzim (listí), zima (jinovatka a vločky), jaro (květy třešně). Všechny tmavé a klidné, ať vynikne ovoce.
- **Šance na návrat:** kdo je o 10 a víc bodů pozadu (ve třech životech: kdo má méně životů), nabíjí měřič naschválu dvakrát rychleji. Pozná se to jen na měřiči (tlustší, běžící pruhy, záře). Vypne se, až je rozdíl pod 5 bodů, takže se zpožděním ~0,5 s nebliká.
- **Stopy čepele** za výhry v sérii: 1 výhra jiskry, 2 dvojitá čepel, 3 zlatá a delší, 4+ duha s hvězdou. Vzorek je pod skóre na výsledku, nová krátce vyskočí.

## Finále kola („jak v Ninja Fruitu na konci“)
- Posledních ~8,6 s kola **na čas** je fontána: 8 vln po ~1 s, střídá se vějíř přes celou šířku a řada na combo. Žádné bomby a žádné naschvály, kus za 2 body, v poslední vlně tři zlaté.
- Ohlášení bez textu: deska se rozsvítí teplým světlem, hodiny zezlátnou, zazní fanfára a krátce vyskočí zlatý znak (hvězda s ovocem). První vlna plave pomalu jako nádech.
- **Do 50 bodů** finále nemá (nemá pevný konec), **Tři životy** taky ne (kolo končí smrtí, ne časem).

## Kolize (2026-10-31)
- Řez se počítá jako průnik úsečky tahu s pohybujícím se kusem (`Sim.sweptDist`), takže rychlý švih ani kus uletělý mezi snímky se nepřeskočí.
- Ovoce má zásahovou zónu 1,28 × poloměr + 9 px, bomba jen 60 % poloměru: počítá se, jen když čepel projde blízko jejího středu.
- Rozpis: bomba se nikdy nesejde s jiným kusem blíž než 0,6 součtu poloměrů (posune se v čase nebo do vedlejší dráhy, jinak uvolní místo nebo vypadne). Bomba v řadě má kolem sebe mezeru navíc. Bomba je vždy vpředu, ovoce ve čtyřech hloubkách.
- Dva kusy vyhozené skoro naráz, které by se letem schovaly jeden za druhý, se rozestoupí do vedlejší dráhy (`spreadOut`); řady na combo letí souběžně a rozestup drží. Všechno deterministicky, oba hráči mají stejný rozpis.
- Ovoce neodplouvá z obrazovky bokem (`Sim.keepIn`, `Sim.KEEP_X` 0,84): vodorovný posun se zkrátí tak, aby kus padal nejdál 0,84 půlky šířky od středu. Dřív ~3 % kusů vyjelo bokem a ve třech životech to byl život za nic (nalezeno z dat pádu v `tests/mody.cjs`). Bomby se neořezávají.
- Regresní testy: `node tests/sim.test.mjs` a `node tests/kolize.cjs <URL>` (Chromium desktop + WebKit iPhone 13).

## Sólo: „Zkusit sám“ (2026-10-31)
Zadání Marka: hry jdou zapnout i sólo na test (Herna na to odkazuje adresou `#solo`).
- **Vstup:** na zakládací visačce tlačítko „Zkusit sám“ pod „Připravit výzvu“ (na desktopu vedle ní, tišší), nebo adresa `…/#solo`. Přijde lobby „Trénink proti Kuchtíkovi“ s výběrem módu (1 min, 2 min, Do 50, 3 životy) a „Jdu do toho“.
- **Soupeř Kuchtík** (`src/bot.js`, čistá logika, testuje ji `tests/sim.test.mjs`): hraje stejný rozpis kola jako hráč, tedy stejné zvláštnosti (zlaté ovoce, řady, obří meloun, měsíční tíže), desky, finále a módy se losují jako v ostré hře. Míří na 50–68 % kusů (podle kola), strhává combo, nabíjí měřič a posílá naschvály (šmouha, mráz, bomba, nikdy ve finále); naschvály od hráče na něj působí (šmouha mu zhorší míření, mráz chce dva řezy, bomba mu občas sebere body nebo život). Ve třech životech chybuje tím častěji, čím je tempo rychlejší. Kdo vede, tomu se bot o chlup zlepší (a opačně), ať je souboj těsný. Jeho živé skóre a životy jsou na cedulce jako u skutečného hráče.
- **Po kole:** po kole „Znovu“ (nové kolo s jinou zvláštností a deskou, mód jde přepnout) a „Vyzvat soupeře“ (návrat na zakládací visačku, adresa bez `#solo`). Žádné „Poslat výsledek do chatu“.
- **Lokální:** v sólu `room.solo`: žádná místnost, odkaz ani zápis do mantledb (`pollPlan` vrací `null`, `commit` slučuje metadata jen v paměti, zápisy do `room.w` zůstávají v paměti), nic se nepočítá do série, čepelí ani titulů, do localStorage nejde `ovs-seat-*`, `ovs-wins-*` ani `ovs-seen-*`. „Trénink“ je v hodinách místo série (`trénink`), žádný nový text přes hrací plochu.
- **Testy:** `node tests/solo.cjs <URL>` (Chromium desktop `#solo`, WebKit iPhone 13 tlačítkem; celé kolo na čas, závod, tři životy, naschvály oběma směry, 0 požadavků na mantledb, úložiště, přechod do výzvy), bot v `tests/sim.test.mjs`.
