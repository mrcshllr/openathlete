# OpenAthlete auf meiner Synology

Dieser Branch (`selfhost`, Standardbranch des Forks) ist die ganze Quelle
meiner eigenen Instanz: das `main` von
[openathleteorg/openathlete](https://github.com/openathleteorg/openathlete) mit
meinen Änderungen obendrauf. Images und NAS hängen nur an diesem Fork.

| Was | Wo |
| --- | --- |
| Bauplan: jede Nacht und bei jedem Push | [`.github/workflows/selfhost.yml`](../.github/workflows/selfhost.yml) |
| Eigene Änderungen | Commits auf `selfhost` |
| Images | `ghcr.io/mrcshllr/openathlete-api:selfhost`, `ghcr.io/mrcshllr/openathlete-web:selfhost` |
| Dateien für das NAS | [`synology/`](synology) |

## Auf dem NAS

Eine Aufgabe im DSM-Aufgabenplaner, Benutzer `root`, täglich 05:00 (nach dem
nächtlichen Build). Sie richtet beim ersten Lauf ein und macht danach jede
Nacht Backup und Update:

```sh
curl -fsSL https://raw.githubusercontent.com/mrcshllr/openathlete/selfhost/selfhost/synology/install.sh | sh -s /volume1/docker/openathlete && /volume1/docker/openathlete/update.sh; tail -n 30 /volume1/docker/openathlete/update.log
```

Die Oberfläche läuft auf `http://192.168.1.4:9999`, öffentlich über den
Cloudflare Tunnel unter `https://training.marcushaller.de`. Einstellungen in
`/volume1/docker/openathlete/.env`.

| Skript | Zweck |
| --- | --- |
| `install.sh` | legt den Ordner an, holt die Skripte, erzeugt `.env` mit neuen Geheimnissen |
| `update.sh` | Backup, neueste Compose-Datei und Images holen, neu starten |
| `backup.sh` | Datenbank sichern (`backups/`, die letzten 14 bleiben) |
| `restore.sh` | eine Sicherung zurückspielen |
| `strava-webhook.sh` | Strava einmalig mitteilen, wohin es neue Aktivitäten meldet |

## Eigene Änderungen

Eine Änderung kommt direkt auf `selfhost`, als Commit oder über einen Pull
Request gegen `selfhost`. Jeder Push baut neue Images, das NAS holt sie beim
nächsten Lauf seiner Aufgabe (05:00). Was auch dem Hauptprojekt nützt, geht
zusätzlich als Pull Request dorthin, von einem eigenen Branch ab dessen `main`.

Datenbank-Migrationen bekommen einen Zeitstempel nach der neuesten vorhandenen.
Löst das Hauptprojekt dasselbe später anders, muss meine Migration von Hand an
seine angepasst werden: das zeigt sich als Konflikt oder als fehlgeschlagener
Start der API, das Backup der Nacht liegt in `backups/`.

## Dem Hauptprojekt folgen

Jede Nacht führt der Bauplan das `main` des Hauptprojekts in `selfhost`
zusammen (ein Merge, meine Änderungen bleiben) und baut das Ergebnis. Was das
Hauptprojekt inzwischen selbst übernommen hat, fällt dabei von allein weg.

Gibt es einen Konflikt, schlägt der Lauf fehl und nichts ändert sich, weder
am Branch noch auf dem NAS. Dann von Hand:

```sh
git checkout selfhost && git pull
git fetch https://github.com/openathleteorg/openathlete main
git merge FETCH_HEAD        # Konflikte lösen, committen
git push
```

GitHub verbietet seinem eigenen Token einen Push, der Workflow-Dateien
ändert, und das Hauptprojekt ändert seine gelegentlich. Damit der nächtliche
Merge dann nicht scheitert: ein persönliches Token (classic, Rechte `repo` und
`workflow`) als Repository-Secret `SYNC_TOKEN` hinterlegen. Ohne es bleibt in
so einer Nacht alles beim Alten, bis der Merge von Hand gepusht ist.

## Lizenz

OpenAthlete steht unter der AGPL-3.0. Der Quellcode jeder Version hier ist
öffentlich: der Branch `selfhost` dieses Forks; jedes Image nennt seinen Commit
in den Labels `org.opencontainers.image.revision` und `...description`.
