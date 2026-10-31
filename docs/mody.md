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
