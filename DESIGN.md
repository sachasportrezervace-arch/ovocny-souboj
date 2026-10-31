# Ovocný souboj – design (popis postaveného světa)

Svět: zelinářský stánek na večerním trhu. Obloha za stánkem je soumrak, nahoře pruhovaná markýza, pod ní šňůra
žárovek, dole dřevěné bedny s natištěnými nápisy. Skóre se píše na křídové cedulky zavěšené pod markýzou, menu je
papírová visačka na provázku.

## Barvy (`:root` v index.html)
- obloha `--sky-top #14223D` → `--sky-mid #27406B` → záře u obzoru `--sky-glow #D9825A` (jediný přechod, má úlohu: světlo)
- markýza `--awning #C8372D` / `--linen #F1E6D0`, tlačítka v barvě markýzy s lněným textem
- dřevo `--wood #9A6236`, `--wood-dark #5E3A20`; křída `--board #23302B`, `--chalk #F2F0E6`
- hráči: x meruňková `#FF9A4D`, o mátová `#5FE0C3`. Barva hráče značí jen jeho cedulku, čepel a jeho naschvály
  (pruh na podstrčené bombě, šmouha, ikona v oznámení). Nic jiného ji nepoužívá.

## Písmo (Google Fonts, latin-ext, česká diakritika ověřena renderem)
- Bungee: nadpisy, čísla skóre v pevných buňkách, tlačítka, nápisy na bednách
- Caveat Brush: křída (jména na cedulkách, oznámení naschválů, sázka)
- Figtree 400/600/800: drobné UI a vstupy

## 3D (three.js r170, `src/scene.js`)
Low-poly koule 12×9 s barvami vrcholů a toon rampou o 3 stupních, černý obrys (zadní stěny ×1,07). Celé ovoce = 1 geometrie
(slupka + stopka + list sloučené), řez = polokoule + disk s texturou dužiny 128 px. Kapky a jiskry v jednom `Points`
(pool 320, při omezeném pohybu 160). Max ~27 draw calls při plné obrazovce. Adaptivní pixel ratio (2 → 1,5 → 1) při
průměrném snímku nad 22 ms.

## Pohyb
- jeden autorský moment: naschvál přiletí jako visačka z boku soupeřovy cedulky a cedulka zabliká jeho barvou
- čísla skóre se překlápějí po buňkách (split-flap), odpočet 3-2-1 vyskočí
- `prefers-reduced-motion`: bez otřesu kamery, bez stékání šmouhy, bez překlápění, poloviční počet částic, prolínání místo skoků

## Pravidla textu
Tykání, neutrální slovesa místo rodu (Radka „posílá“, kolo „bere“ Mark). Sabotáže vždy podepsané jménem.
