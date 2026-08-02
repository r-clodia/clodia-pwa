# Asset di brand

`logo-master.png` è **l'unica sorgente** del marchio. Tutto ciò che sta in
`static/` con il logo dentro è generato da qui:

```sh
pip install 'Pillow>=10,<12'
python3 scripts/gen-brand-assets.py          # rigenera static/
python3 scripts/gen-brand-assets.py --check  # verifica (gira in CI)
```

Cosa produrre, con quali dimensioni e su quale fondo sta in `assets.json`;
lo script è uguale in tutti i repo che servono il marchio, cambia solo il
manifest.

## Perché una pipeline e non i file a mano

Un'immagine caricata in chat che diventa asset servito dalla UI attraversa un
confine di fiducia (clodia-platform#101). Il master arriva da `gpt-image` e porta
un chunk `caBX` (manifest C2PA, ~25 KB: provenance, certificati, `instanceID`) che
non ha ragione di finire in produzione. Ogni output viene quindi **ridecodificato
e riscritto da zero**, mai copiato: sopravvivono solo `IHDR`/`IDAT`/`IEND`.
`--check` fa fallire la CI se un asset viene aggiornato a mano scavalcando il
re-encode, o se un PNG committato reintroduce metadata o byte dopo `IEND`.

## Icone opache, non trasparenti

`manifest.webmanifest` dichiara le icone `purpose: "any maskable"`: il sistema
operativo le ritaglia in una forma propria, quindi devono essere a fondo pieno e
con il contenuto dentro la safe zone. La pipeline le compone su `#101116` (lo
stesso `theme_color` del manifest) con il ritratto all'80% del lato — prima erano
PNG a fondo trasparente, che come maskable vengono resi male.

## Se il master cambia

Le finestre di ritaglio in `assets.json` sono coordinate fisse sul master. Lo
script confronta il bounding box del contenuto con `geometry.content_bbox` e
**fallisce** se non combacia, invece di produrre favicon ritagliate a caso: in
quel caso ricalcola la geometria prima di rigenerare.
