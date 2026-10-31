# Předávka – módy (2026-10-31)

**Hotovo:** commit `2f2f40e` (lokálně). Obsahuje tři módy (Na čas 1/2 min, Do 50 bodů, Tři životy), výběr čipy na zakládací
visačce i na výsledku („Odveta v módu“), návrh a zdůvodnění v `docs/mody.md` a test `tests/mody.cjs`.
Testy lokálně: sim 12/12, duel 49/49, mody 21/21 (Chromium desktop 1440×900 + WebKit iPhone 13).

**Jak to funguje:** meta `g.md/g.rl/g.tg` = mód příští odvety, `g.gm/g.gl` = mód a délka spuštěného kola, `g.mh` = módy
odehraných kol. V seat dokumentu je `f` = {klíč: ms cíle/smrti} a `lv` = živé životy. Vítěz se počítá v `Sim.winnerOf`.
Závod: soupeř po přečtení mého `f` ukončí kolo. Tři životy: přeživší končí, až jeho hodiny přejdou soupeřův čas.
`?kolo=N` zkrátí kolo každého módu a `?cil=N` změní cíl (jen pro testy).

**Další krok:** design-eye ve 3 kolech (subagent, zápis do `docs/worklog.md`). Pak push
(`git -c credential.helper= -c credential.helper='!gh auth git-credential' push`), počkat na Pages (curl `src/main.js`
obsahuje `loseLife`) a spustit živě `node tests/mody.cjs https://sachasportrezervace-arch.github.io/ovocny-souboj/`
a `node tests/duel.cjs <URL>`.

**Otevřené:** lidský pocit z tempa tří životů a z cíle 50 nikdo neověřil (boti dají 15 bodů za ~8–11 s). Pokud je závod
moc krátký nebo dlouhý, mění se `Sim.TARGET`.
