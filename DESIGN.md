# Ovocný souboj – design (popis postaveného světa)

Svět: tmavá dřevěná pracovní deska, nic jiného. Žádný stánek, markýza, kopce ani bedny. Na desce leží křídové cedulky se skóre
a hodinami, menu je papírová visačka přibitá hřebíčkem. Barevné ovoce a šťáva jsou jediná barva ve scéně.

## Barvy (`:root` v index.html)
- deska `--desk-hi #4A2E1B` / `--desk #2E1C10` / `--desk-lo #150C07` (kreslí `paintBoard` v main.js: prkna s kresbou let, suky, zámky, viněta)
- tlačítka `--tomato #C8372D` (lněný text), papír `--linen #F1E6D0`, dřevo `--wood*` jen na rámy cedulek, křída `--board #23302B`, `--chalk #F2F0E6`
- hráči: x meruňková `#FF9A4D`, o mátová `#5FE0C3`. Barva hráče značí jen jeho cedulku, měřič naschválu, čepel a jeho naschvály
  (pruh na podstrčené bombě, šmouha, ikona v oznámení). Nic jiného ji nepoužívá.

## Deska a kontrast ovoce
Deska je záměrně tmavá a klidná (jako ve Fruit Ninja: plocha, na které vynikne ovoce). Dřevo se kreslí jednou při resize do canvasu
(`#board`, pixel ratio nejvýš 1,5 a do 2,4 Mpx, žádné obrázky ani CDN), pod ovocem leží druhý canvas `#stains` s jemnými skvrnami
šťávy, které za ~4,5 s zmizí. Tmavé druhy (švestka, kiwi, melon, bomba) drží na desce **světlý obrys** (lněná `#F6EBD3`, zadní
stěna ×1,07); bomba má obrys teplý oranžový `#FF7A4D` a červený pás, takže nesplyne s fialovou švestkou.

## Písmo (Google Fonts, latin-ext, česká diakritika ověřena renderem)
- Bungee: nadpisy, čísla skóre v pevných buňkách, tlačítka
- Caveat Brush: křída (jména na cedulkách, oznámení naschválů, sázka, „Přesně!“)
- Figtree 400/600/800: drobné UI a vstupy

## 3D (three.js r170, `src/scene.js`)
Hladké koule 24×16 s hladkými normálami, barvami po vrcholech a toon rampou o 3 stupních (čistý cel-shading, ne fasety), světlý obrys (zadní stěny ×1,07, i na půlkách). Celé ovoce = 1 geometrie
(slupka + stopka + list sloučené), řez = polokoule + disk s texturou dužiny 128 px. Kapky, jiskry a prstenec přesného řezu v jednom
`Points` (pool 320, při omezeném pohybu 160). Max ~27 draw calls při plné obrazovce. Adaptivní pixel ratio (2 → 1,5 → 1).

## Twist a pocit ze hry
- **Přesně!** Tah, jehož přímka projde ve vnitřní čtvrtině poloměru ovoce (screen space, `cutTest`), dá +2 body, prstenec jisker,
  vyšší „ting“ a krátké zavibrování. Neplatí pro bomby a led.
- **Měřič naschválu** pod jménem na vlastní cedulce (`#chargeMe`): řez +1, přesný +3, karambola +5, plný (18) pošle soupeři šmouhu,
  mráz nebo bombu. Combo 3+ a karambola posílají hned. Přesně rozseknutý led vrací mráz odesílateli („Odraženo!“).
- Karambola je v každém kole zaručeně ve 4–6 s, takže první naschvál padne oběma do ~10 s.

## Pohyb
- naschvál přiletí jako visačka z boku soupeřovy cedulky a cedulka zabliká jeho barvou
- čísla skóre se překlápějí po buňkách (split-flap), odpočet 3-2-1 vyskočí
- `prefers-reduced-motion`: bez otřesu kamery, bez stékání šmouhy, bez překlápění, poloviční počet částic, prstenec jen 8 jisker

## Pravidla textu
Tykání, neutrální slovesa místo rodu (Radka „posílá“, kolo „bere“ Mark). Sabotáže vždy podepsané jménem. Zpráva do chatu bez emoji.

## Rozvržení podle zařízení
- Cedulky leží u horního okraje (`#hud` 10 px od hrany), bez provázků. `--top-h` je jen odstup panelu od cedulek.
- Mobil na výšku: plocha přes celou výšku (`--app-h` = `100dvh`, na iOS `innerHeight`), tělo přibité, plátno `touch-action: none`, panel se scrolluje samostatně. Dotykové cíle ≥ 44 px.
- Desktop (≥ 960×560): visačka 480/720 px uprostřed, cedulky s buňkami 48×64, vlastní kurzor. Spawn ovoce omezen na pole nejvýš 1,8× výška / 1900 px (`scene.fieldHalf`).
- Celá obrazovka: Fullscreen API, na iPhonu nápověda „Sdílet → Přidat na plochu“ + `manifest.webmanifest`.
- Share karta: Poslat a Kopírovat stejně vysoká tlačítka (52 px, jednořádkový popisek), zpráva jako text (ne textarea), celá vidět.
